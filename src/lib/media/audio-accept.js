/**
 * `accept` value for audio file inputs.
 *
 * iOS WebKit (Safari and Chrome) does not honour `audio/*` — mp3 and other
 * audio files stay greyed out in the picker. List concrete extensions (required
 * on iOS) plus MIME types for desktop filters. Omit `audio/*` so iOS opens the
 * Files chooser instead of Photo Library / Take Video.
 */
export const AUDIO_FILE_ACCEPT = [
	'.mp3',
	'.wav',
	'.flac',
	'.aac',
	'.ogg',
	'.m4a',
	'audio/mpeg',
	'audio/mp3',
	'audio/wav',
	'audio/x-wav',
	'audio/wave',
	'audio/flac',
	'audio/x-flac',
	'audio/aac',
	'audio/ogg',
	'audio/mp4',
	'audio/x-m4a'
].join(',');
