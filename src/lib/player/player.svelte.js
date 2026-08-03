import { browser } from '$app/env';

/**
 * A track loaded into the global player. Carries everything the player bar
 * and waveforms need so playback survives navigation without refetching.
 *
 * @typedef {Object} PlayerTrack
 * @property {string} id
 * @property {string} title
 * @property {string | null} artist
 * @property {string | null} username
 * @property {string} uploaderName
 * @property {number | null} durationMs
 * @property {boolean} hasCover
 * @property {number[] | null} waveform
 * @property {boolean} likedByViewer
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
	currentTime = $state(0);
	duration = $state(0);
	/** Active saved playlist, if playback was started from one. @type {string | null} */
	playlistId = $state(null);

	/** Previously played tracks, most recent last. @type {PlayerTrack[]} */
	#history = [];
	/** Ordered members of the active playlist. @type {PlayerTrack[]} */
	#playlistTracks = [];
	/** @type {HTMLAudioElement | null} */
	#audio = null;
	#raf = 0;

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
	 * Clears any saved-playlist context (use `playFromPlaylist` to keep it).
	 *
	 * @param {PlayerTrack} track
	 * @param {number} [atSeconds]
	 */
	play(track, atSeconds) {
		this.#clearPlaylistContext();
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
		this.playlistId = playlistId;
		this.#playlistTracks = tracks;
		this.#playTrack(tracks[i], atSeconds);
	}

	/** @param {string} playlistId */
	isPlaylistCurrent(playlistId) {
		return this.playlistId === playlistId;
	}

	/**
	 * @param {PlayerTrack} track
	 * @param {number} [atSeconds]
	 */
	#playTrack(track, atSeconds) {
		const el = this.#ensureAudio();
		if (!el) return;

		if (this.current?.id === track.id) {
			if (atSeconds != null) this.seek(atSeconds);
			void el.play();
			return;
		}

		if (this.current) {
			this.#history.push(this.current);
		}

		this.current = track;
		this.currentTime = atSeconds ?? 0;
		this.duration = (track.durationMs ?? 0) / 1000;

		el.src = `/api/media/${track.id}/audio`;
		if (atSeconds != null && atSeconds > 0) {
			const seconds = atSeconds;
			el.addEventListener(
				'loadedmetadata',
				() => {
					el.currentTime = seconds;
				},
				{ once: true }
			);
		}
		void el.play();
	}

	#clearPlaylistContext() {
		this.playlistId = null;
		this.#playlistTracks = [];
	}

	/** Advance within the active playlist, then fall through to Next Up. */
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
		if (this.playing) {
			this.pause();
		} else {
			this.resume();
		}
	}

	pause() {
		this.#audio?.pause();
	}

	resume() {
		if (!this.current) return;
		void this.#audio?.play();
	}

	/** @param {number} seconds */
	seek(seconds) {
		const el = this.#audio;
		if (!el || !this.current) return;
		const clamped = Math.max(0, Math.min(seconds, this.duration || seconds));
		el.currentTime = clamped;
		this.currentTime = clamped;
	}

	/** Advance to the next queued track, if any. */
	next() {
		const [head, ...rest] = this.queue;
		if (!head) return;
		this.queue = rest;
		this.#persistQueue();
		this.#clearPlaylistContext();
		this.#playTrack(head);
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
		this.#persistQueue();
		if (this.current?.id === trackId) {
			const el = this.#audio;
			if (el) {
				el.pause();
				el.removeAttribute('src');
			}
			this.current = null;
			this.playing = false;
			this.currentTime = 0;
			this.duration = 0;
			this.#clearPlaylistContext();
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
			this.playing = true;
			this.#startTicking();
		});
		el.addEventListener('pause', () => {
			this.playing = false;
			this.#stopTicking();
			this.currentTime = el.currentTime;
		});
		el.addEventListener('ended', () => {
			this.playing = false;
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
			this.playing = false;
			this.#stopTicking();
		});

		this.#audio = el;
		// Warm Web Audio taps before playback so the viz toggle never creates the source mid-stream.
		document.dispatchEvent(new CustomEvent('sndbnk:audio-ready'));
		return el;
	}

	/** Smooth playhead updates while playing. */
	#startTicking() {
		this.#stopTicking();
		const tick = () => {
			const el = this.#audio;
			if (!el) return;
			this.currentTime = el.currentTime;
			if (this.playing) {
				this.#raf = requestAnimationFrame(tick);
			}
		};
		this.#raf = requestAnimationFrame(tick);
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
