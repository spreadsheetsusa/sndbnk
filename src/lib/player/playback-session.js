import { browser } from '$app/env';

/**
 * Playback is heard through an AudioContext (EQ and the visualizer tap the same
 * graph). Mobile browsers classify that as ambient audio and suspend it when
 * the page is backgrounded. A playback audio session plus Media Session is the
 * contract that lets a music page keep playing on app switch and screen lock.
 */

let actionsInstalled = false;
let interruptionsInstalled = false;
/** @type {string | null} */
let publishedId = null;
/** Quarter-second bucket last sent to the OS. */
let positionBucket = -1;

/**
 * @param {'auto' | 'playback'} type
 */
function setAudioSessionType(type) {
	if (!browser) return;
	const session = navigator.audioSession;
	if (!session || session.type === type) return;
	try {
		session.type = type;
	} catch {
		// The UA exposes the API but rejects this type.
	}
}

/** Call before creating the AudioContext or calling play(), inside the gesture. */
export function holdAudioSession() {
	setAudioSessionType('playback');
}

/** @returns {boolean} */
export function audioSessionInterrupted() {
	if (!browser) return false;
	return navigator.audioSession?.state === 'interrupted';
}

/**
 * Fires only when a platform interruption (a call, another app taking audio)
 * ends. Type changes we make ourselves are ignored.
 * @param {() => void} onResume
 */
export function watchAudioInterruptions(onResume) {
	if (!browser || interruptionsInstalled) return;
	const session = navigator.audioSession;
	if (!session) return;
	interruptionsInstalled = true;
	let last = session.state;
	session.addEventListener('statechange', () => {
		const next = session.state;
		const ended = last === 'interrupted' && next !== 'interrupted';
		last = next;
		if (ended) onResume();
	});
}

/**
 * @param {{
 *   play: () => void,
 *   pause: () => void,
 *   previous: () => void,
 *   next: () => void,
 *   seek: (seconds: number) => void,
 *   seekBy: (deltaSeconds: number) => void
 * }} actions
 */
export function installPlaybackActions(actions) {
	if (!browser || actionsInstalled || !('mediaSession' in navigator)) return;
	actionsInstalled = true;

	/** @type {Record<string, (details: MediaSessionActionDetails) => void>} */
	const handlers = {
		play: () => actions.play(),
		pause: () => actions.pause(),
		previoustrack: () => actions.previous(),
		nexttrack: () => actions.next(),
		seekbackward: (details) => actions.seekBy(-(details.seekOffset ?? 10)),
		seekforward: (details) => actions.seekBy(details.seekOffset ?? 10),
		seekto: (details) => {
			if (typeof details.seekTime === 'number') actions.seek(details.seekTime);
		}
	};

	for (const [name, handler] of Object.entries(handlers)) {
		try {
			navigator.mediaSession.setActionHandler(/** @type {MediaSessionAction} */ (name), handler);
		} catch {
			// This action isn't implemented on every mobile browser.
		}
	}
}

/**
 * @param {{
 *   id: string,
 *   title: string,
 *   artist?: string | null,
 *   uploaderName?: string,
 *   hasCover?: boolean
 * } | null} track
 * @param {'none' | 'paused' | 'playing'} state
 */
export function syncPlaybackSession(track, state) {
	if (!browser) return;
	if (state === 'playing') holdAudioSession();
	else setAudioSessionType('auto');

	if (!('mediaSession' in navigator)) return;
	const session = navigator.mediaSession;

	if (!track || state === 'none') {
		session.playbackState = 'none';
		session.metadata = null;
		publishedId = null;
		positionBucket = -1;
		return;
	}

	session.playbackState = state;
	if (publishedId === track.id || typeof MediaMetadata !== 'function') return;

	publishedId = track.id;
	positionBucket = -1;
	const artist = track.artist?.trim() || track.uploaderName || 'SNDBNK';
	try {
		session.metadata = new MediaMetadata({
			title: track.title,
			artist,
			artwork: [{ src: artworkSrc(track) }]
		});
	} catch {
		// Art or title the UA rejects shouldn't drop the playback session.
	}
}

/**
 * Lock-screen scrubber. Throttled to quarter seconds.
 * @param {number} currentTime
 * @param {number} duration
 */
export function syncPlaybackPosition(currentTime, duration) {
	if (!browser || !('mediaSession' in navigator)) return;
	if (!Number.isFinite(duration) || duration <= 0) return;
	if (!Number.isFinite(currentTime) || currentTime < 0) return;
	const position = Math.min(currentTime, duration);
	const bucket = Math.round(position * 4);
	if (bucket === positionBucket) return;
	positionBucket = bucket;
	try {
		navigator.mediaSession.setPositionState({
			duration,
			playbackRate: 1,
			position
		});
	} catch {
		// Session not active yet, or position didn't fit the duration.
	}
}

/**
 * Same-origin art so the OS can paint the lock screen without the media host's CORS.
 * @param {{ id: string, hasCover?: boolean }} track
 */
function artworkSrc(track) {
	const path = track.hasCover ? `/api/media/${track.id}/cover` : '/icons/icon-512.png';
	return new URL(path, location.href).href;
}
