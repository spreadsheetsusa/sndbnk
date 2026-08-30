import { browser } from '$app/env';

import { getPlayThresholds } from '#lib/player/play-thresholds.js';

/**
 * A track loaded into the global player. Carries everything the player bar
 * and waveforms need so playback survives navigation without refetching.
 *
 * @typedef {Object} PlayerTrack
 * @property {string} id
 * @property {string} [slug]
 * @property {string} title
 * @property {string | null} artist
 * @property {string | null} username
 * @property {string} uploaderName
 * @property {string} [mediaType]
 * @property {number | null} durationMs
 * @property {number | null} [bitrate]
 * @property {number | null} [sampleRate]
 * @property {number | null} [channels]
 * @property {string | null} [codec]
 * @property {boolean} hasCover
 * @property {string | null} [audioUrl]
 * @property {string | null} [coverUrl]
 * @property {number[] | null} waveform
 * @property {boolean} likedByViewer
 * @property {number} [playCount]
 */

const QUEUE_STORAGE_KEY = 'sndbnk:next-up';

/**
 * @param {unknown} value
 * @returns {value is PlayerTrack}
 */
function isPlayerTrack(value) {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (/** @type {{ id?: unknown }} */ (value).id) === 'string' &&
		typeof (/** @type {{ title?: unknown }} */ (value).title) === 'string'
	);
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isAbortError(err) {
	return err instanceof DOMException
		? err.name === 'AbortError'
		: err instanceof Error && err.name === 'AbortError';
}

/**
 * Global singleton audio player. Owns the single HTMLAudioElement so
 * playback persists across SvelteKit client-side navigations, and exposes
 * reactive state for the player bar and per-track waveforms.
 */
class Player {
	/** @type {PlayerTrack | null} */
	current = $state(null);
	/** "Next Up" queue, persisted to localStorage. @type {PlayerTrack[]} */
	queue = $state([]);
	playing = $state(false);
	/** Intent to play while media is still buffering / seeking to start. */
	loading = $state(false);
	currentTime = $state(0);
	duration = $state(0);
	/** Active saved playlist, if playback was started from one. @type {string | null} */
	playlistId = $state(null);

	/** Previously played tracks, most recent last. @type {PlayerTrack[]} */
	#history = [];
	/** Ordered members of the active playlist. @type {PlayerTrack[]} */
	#playlistTracks = [];
	/** Feed timeline continuum (not Next Up). @type {PlayerTrack[]} */
	#feedTracks = [];
	/** @type {HTMLAudioElement | null} */
	#audio = null;
	#raf = 0;
	/** Bumps on every load/pause/evict so stale media events cannot win. */
	#loadGen = 0;
	/** True while the current generation still wants playback. */
	#wantsPlay = false;
	/** @type {((this: HTMLAudioElement, ev: Event) => void) | null} */
	#pendingSeek = null;
	/** Track ids already counted as a play this browser session. */
	#recordedPlays = new Set();
	/** Accumulated ms spent actually playing the current track. */
	#playedMs = 0;
	/** performance.now() of the last playing tick; 0 while paused. */
	#lastTickWall = 0;
	#recordingPlay = false;

	constructor() {
		if (browser) {
			this.queue = this.#restoreQueue();
		}
	}

	/** @param {string} id */
	isCurrent(id) {
		return this.current?.id === id;
	}

	/**
	 * Play a track, optionally from a specific position (seconds).
	 * If the track is already current, this resumes/seeks instead.
	 * Clears playlist and feed continuum (use `playFromPlaylist` / `playFromFeed`).
	 *
	 * @param {PlayerTrack} track
	 * @param {number} [atSeconds]
	 */
	play(track, atSeconds) {
		this.#clearPlaylistContext();
		this.#clearFeedContext();
		this.#playTrack(track, atSeconds);
	}

	/**
	 * Play a member of a saved playlist and advance through its tracks on end.
	 *
	 * @param {string} playlistId
	 * @param {PlayerTrack[]} tracks
	 * @param {number} [index]
	 * @param {number} [atSeconds]
	 */
	playFromPlaylist(playlistId, tracks, index = 0, atSeconds) {
		if (!tracks.length) return;
		const i = Math.max(0, Math.min(index, tracks.length - 1));
		this.#clearFeedContext();
		this.playlistId = playlistId;
		this.#playlistTracks = tracks;
		this.#playTrack(tracks[i], atSeconds);
	}

	/**
	 * Play a feed track and advance through later loaded feed tracks on end.
	 * Does not touch Next Up — that queue stays user-owned and wins on advance.
	 *
	 * @param {PlayerTrack[]} tracks
	 * @param {number} [index]
	 * @param {number} [atSeconds]
	 */
	playFromFeed(tracks, index = 0, atSeconds) {
		if (!tracks.length) return;
		const i = Math.max(0, Math.min(index, tracks.length - 1));
		this.#clearPlaylistContext();
		this.#feedTracks = tracks;
		this.#playTrack(tracks[i], atSeconds);
	}

	/** @param {string} playlistId */
	isPlaylistCurrent(playlistId) {
		return this.playlistId === playlistId;
	}

	/** True when Skip can advance (Next Up head, or a later feed continuum track). */
	get hasNext() {
		if (this.queue.length > 0) return true;
		return this.#feedSuccessor() != null;
	}

	/**
	 * @param {PlayerTrack} track
	 * @param {number} [atSeconds]
	 */
	#playTrack(track, atSeconds) {
		const el = this.#ensureAudio();
		if (!el) return;

		const sameId = this.current?.id === track.id;
		const needsReload =
			sameId && (Boolean(el.error) || el.networkState === HTMLMediaElement.NETWORK_EMPTY);

		if (sameId && !needsReload) {
			if (atSeconds != null) this.seek(atSeconds);
			void this.#startPlayback();
			return;
		}

		if (this.current && !sameId) {
			this.#history.push(this.current);
		}

		const gen = ++this.#loadGen;
		this.#wantsPlay = true;
		this.loading = true;
		this.current = track;
		this.currentTime = atSeconds ?? 0;
		this.duration = (track.durationMs ?? 0) / 1000;
		this.#playedMs = 0;
		this.#lastTickWall = 0;

		this.#clearPendingSeek(el);
		el.pause();

		const src = track.audioUrl?.trim() || `/api/media/${track.id}/audio`;
		if (el.src !== new URL(src, location.href).href) {
			el.src = src;
		} else {
			el.load();
		}

		if (atSeconds != null && atSeconds > 0) {
			const seconds = atSeconds;
			/** @param {Event} _ev */
			const onMeta = (_ev) => {
				this.#pendingSeek = null;
				if (gen !== this.#loadGen) return;
				el.currentTime = seconds;
				this.currentTime = seconds;
			};
			this.#pendingSeek = onMeta;
			el.addEventListener('loadedmetadata', onMeta, { once: true });
		}

		void this.#startPlayback(gen);
	}

	/**
	 * @param {number} [gen]
	 */
	async #startPlayback(gen = this.#loadGen) {
		const el = this.#audio;
		if (!el) return;

		this.#wantsPlay = true;
		this.loading = true;

		try {
			await el.play();
			if (gen !== this.#loadGen) return;
			// `play` event also clears loading; belt-and-suspenders if it raced.
			if (!el.paused) this.loading = false;
		} catch (err) {
			if (gen !== this.#loadGen || isAbortError(err)) return;
			this.loading = false;
			this.#wantsPlay = false;
		}
	}

	/**
	 * @param {HTMLAudioElement} el
	 */
	#clearPendingSeek(el) {
		if (!this.#pendingSeek) return;
		el.removeEventListener('loadedmetadata', this.#pendingSeek);
		this.#pendingSeek = null;
	}

	#clearPlaylistContext() {
		this.playlistId = null;
		this.#playlistTracks = [];
	}

	#clearFeedContext() {
		this.#feedTracks = [];
	}

	/** @returns {PlayerTrack | null} */
	#feedSuccessor() {
		if (!this.current || this.#feedTracks.length === 0) return null;
		const idx = this.#feedTracks.findIndex((t) => t.id === this.current?.id);
		if (idx < 0) return null;
		return this.#feedTracks[idx + 1] ?? null;
	}

	/**
	 * Advance within the active playlist, then Next Up (clears feed), then feed
	 * continuum. Consuming Next Up ends the feed session so playback stops when
	 * the queue empties.
	 */
	#advanceAfterEnd() {
		if (this.playlistId && this.#playlistTracks.length > 0 && this.current) {
			const idx = this.#playlistTracks.findIndex((t) => t.id === this.current?.id);
			const next = idx >= 0 ? this.#playlistTracks[idx + 1] : null;
			if (next) {
				this.#playTrack(next);
				return;
			}
			this.#clearPlaylistContext();
		}
		if (this.queue.length > 0) {
			this.next();
			return;
		}
		const feedNext = this.#feedSuccessor();
		if (feedNext) {
			this.#playTrack(feedNext);
			return;
		}
		this.#clearFeedContext();
		this.currentTime = this.duration;
	}

	/**
	 * Toggle play/pause. With a track argument, plays it if not current.
	 * @param {PlayerTrack} [track]
	 */
	toggle(track) {
		if (track && this.current?.id !== track.id) {
			this.play(track);
			return;
		}
		if (this.playing || this.loading) {
			this.pause();
		} else {
			this.resume();
		}
	}

	pause() {
		this.#loadGen += 1;
		this.#wantsPlay = false;
		this.loading = false;
		this.#audio?.pause();
	}

	resume() {
		if (!this.current) return;
		const el = this.#ensureAudio();
		if (!el) return;
		if (el.error || el.networkState === HTMLMediaElement.NETWORK_EMPTY) {
			this.#playTrack(this.current, this.currentTime || undefined);
			return;
		}
		void this.#startPlayback();
	}

	/** @param {number} seconds */
	seek(seconds) {
		const el = this.#audio;
		if (!el || !this.current) return;
		const clamped = Math.max(0, Math.min(seconds, this.duration || seconds));
		el.currentTime = clamped;
		this.currentTime = clamped;
	}

	/** Advance to the next queued track, or the next feed continuum track. */
	next() {
		const [head, ...rest] = this.queue;
		if (head) {
			this.queue = rest;
			this.#persistQueue();
			this.#clearPlaylistContext();
			this.#clearFeedContext();
			this.#playTrack(head);
			return;
		}
		const feedNext = this.#feedSuccessor();
		if (!feedNext) return;
		this.#playTrack(feedNext);
	}

	/** Restart the track, or go back to the previously played one. */
	previous() {
		if (this.currentTime > 3 || this.#history.length === 0) {
			this.seek(0);
			return;
		}
		const prev = this.#history.pop();
		if (!prev) return;
		// play() pushes current back onto history; compensate after.
		const currentBefore = this.current;
		this.play(prev);
		if (currentBefore) {
			// Remove the entry play() just pushed so prev/next doesn't loop.
			this.#history.pop();
		}
	}

	/** @param {PlayerTrack} track */
	addToQueue(track) {
		if (this.queue.some((t) => t.id === track.id)) return;
		this.queue = [...this.queue, track];
		this.#persistQueue();
	}

	/** @param {number} index */
	removeFromQueue(index) {
		this.queue = this.queue.filter((_, i) => i !== index);
		this.#persistQueue();
	}

	/**
	 * Reorder a queued track (Next Up drag-and-drop).
	 * @param {number} fromIndex
	 * @param {number} toIndex
	 */
	moveInQueue(fromIndex, toIndex) {
		if (fromIndex === toIndex) return;
		if (fromIndex < 0 || toIndex < 0) return;
		if (fromIndex >= this.queue.length || toIndex >= this.queue.length) return;
		const next = [...this.queue];
		const [item] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, item);
		this.queue = next;
		this.#persistQueue();
	}

	/** @param {number} index */
	playFromQueue(index) {
		const track = this.queue[index];
		if (!track) return;
		this.removeFromQueue(index);
		this.#clearPlaylistContext();
		this.#clearFeedContext();
		this.#playTrack(track);
	}

	clearQueue() {
		this.queue = [];
		this.#persistQueue();
	}

	/**
	 * Drop a track everywhere (e.g. after deletion).
	 * @param {string} trackId
	 */
	evict(trackId) {
		this.queue = this.queue.filter((t) => t.id !== trackId);
		this.#history = this.#history.filter((t) => t.id !== trackId);
		this.#playlistTracks = this.#playlistTracks.filter((t) => t.id !== trackId);
		this.#feedTracks = this.#feedTracks.filter((t) => t.id !== trackId);
		this.#persistQueue();
		if (this.current?.id === trackId) {
			const el = this.#audio;
			this.#loadGen += 1;
			this.#wantsPlay = false;
			if (el) {
				this.#clearPendingSeek(el);
				el.pause();
				el.removeAttribute('src');
				el.load();
			}
			this.current = null;
			this.playing = false;
			this.loading = false;
			this.currentTime = 0;
			this.duration = 0;
			this.#clearPlaylistContext();
			this.#clearFeedContext();
		}
	}

	/**
	 * Reflect a like toggle on the loaded track (bar heart stays in sync).
	 * @param {string} trackId
	 * @param {boolean} liked
	 */
	setLiked(trackId, liked) {
		if (this.current?.id === trackId) {
			this.current = { ...this.current, likedByViewer: liked };
		}
	}

	/** The singleton element for Web Audio taps (Milkdrop). Created lazily. */
	getAudioElement() {
		return this.#ensureAudio();
	}

	#ensureAudio() {
		if (!browser) return null;
		if (this.#audio) return this.#audio;

		const el = new Audio();
		el.preload = 'metadata';
		// Must be set before any src so Web Audio analysers can read samples.
		el.crossOrigin = 'anonymous';

		el.addEventListener('play', () => {
			if (!this.#wantsPlay) {
				el.pause();
				return;
			}
			this.playing = true;
			this.loading = false;
			this.#startTicking();
		});
		el.addEventListener('playing', () => {
			if (!this.#wantsPlay) return;
			this.playing = true;
			this.loading = false;
		});
		el.addEventListener('waiting', () => {
			if (!this.#wantsPlay) return;
			this.loading = true;
		});
		el.addEventListener('stalled', () => {
			if (!this.#wantsPlay) return;
			this.loading = true;
		});
		el.addEventListener('pause', () => {
			this.playing = false;
			this.#lastTickWall = 0;
			this.#stopTicking();
			this.currentTime = el.currentTime;
			if (!this.#wantsPlay) this.loading = false;
		});
		el.addEventListener('ended', () => {
			this.playing = false;
			this.loading = false;
			this.#wantsPlay = false;
			this.#stopTicking();
			this.#advanceAfterEnd();
		});
		el.addEventListener('durationchange', () => {
			if (Number.isFinite(el.duration) && el.duration > 0) {
				this.duration = el.duration;
			}
		});
		el.addEventListener('timeupdate', () => {
			if (!this.playing) {
				this.currentTime = el.currentTime;
			}
		});
		el.addEventListener('error', () => {
			if (!this.#wantsPlay && !this.playing) return;
			this.playing = false;
			this.loading = false;
			this.#wantsPlay = false;
			this.#stopTicking();
		});

		this.#audio = el;
		// Warm Web Audio taps before playback so the viz toggle never creates the source mid-stream.
		document.dispatchEvent(new CustomEvent('sndbnk:audio-ready'));
		return el;
	}

	/** Smooth playhead updates while playing; also accumulates listen time. */
	#startTicking() {
		this.#stopTicking();
		this.#lastTickWall = performance.now();
		const tick = () => {
			const el = this.#audio;
			if (!el) return;
			const now = performance.now();
			if (this.#lastTickWall > 0) {
				this.#playedMs += now - this.#lastTickWall;
			}
			this.#lastTickWall = now;
			this.currentTime = el.currentTime;
			this.#maybeRecordPlay();
			if (this.playing) {
				this.#raf = requestAnimationFrame(tick);
			}
		};
		this.#raf = requestAnimationFrame(tick);
	}

	/**
	 * Fire POST /play once per track per session when admin thresholds are met.
	 * Both media types use accumulated playing time (#playedMs); pauses freeze it,
	 * seeking does not inflate it, and switching tracks resets it.
	 * Mixes use a fixed ms threshold; everything else uses percent of duration.
	 */
	#maybeRecordPlay() {
		const track = this.current;
		if (!track || this.#recordedPlays.has(track.id) || this.#recordingPlay) return;

		const { trackPlayPercent, mixPlayContinualMs } = getPlayThresholds();
		const durationMs = (this.duration > 0 ? this.duration * 1000 : null) ?? track.durationMs ?? 0;

		let met = false;
		if (track.mediaType === 'mix') {
			const need = durationMs > 0 ? Math.min(mixPlayContinualMs, durationMs) : mixPlayContinualMs;
			met = this.#playedMs >= need;
		} else if (durationMs > 0) {
			met = this.#playedMs >= durationMs * (trackPlayPercent / 100);
		}
		if (!met) return;

		this.#recordedPlays.add(track.id);
		this.#recordingPlay = true;
		void this.#postPlay(track.id);
	}

	/** @param {string} trackId */
	async #postPlay(trackId) {
		try {
			const res = await fetch(`/api/tracks/${trackId}/play`, { method: 'POST' });
			if (!res.ok) {
				this.#recordedPlays.delete(trackId);
				return;
			}
			const data = await res.json();
			if (this.current?.id === trackId && typeof data.playCount === 'number') {
				this.current = { ...this.current, playCount: data.playCount };
			}
		} catch {
			this.#recordedPlays.delete(trackId);
		} finally {
			this.#recordingPlay = false;
		}
	}

	#stopTicking() {
		if (this.#raf) {
			cancelAnimationFrame(this.#raf);
			this.#raf = 0;
		}
	}

	#persistQueue() {
		if (!browser) return;
		try {
			localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
		} catch {
			// Storage full/unavailable: queue just won't persist.
		}
	}

	/** @returns {PlayerTrack[]} */
	#restoreQueue() {
		try {
			const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed.filter(isPlayerTrack);
		} catch {
			return [];
		}
	}
}

export const player = new Player();
