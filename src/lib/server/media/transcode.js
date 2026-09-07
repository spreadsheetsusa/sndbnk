/**
 * Lossless / obscure master → 320k CBR MP3 playback derivative via ffmpeg/libmp3lame.
 * Peaks stay on the waveform path; this only encodes a streaming-friendly copy.
 */

import { playbackObjectName, trackNeedsPlaybackMp3 } from '#lib/server/media/assets.js';

export const PLAYBACK_MP3_MIME = 'audio/mpeg';

/** Same ceiling as long-mix waveform jobs — large lossless files can take a while. */
export const TRANSCODE_WORKER_TIMEOUT_MS = 15 * 60 * 1000;

const ENCODE_BITRATE = '320k';

export { playbackObjectName, trackNeedsPlaybackMp3 };

/**
 * @deprecated Use playbackObjectName(revision). Kept for logs of pre-slice-1 files.
 */
export const PLAYBACK_MP3_FILENAME = 'audio.mp3';

/**
 * @param {string | null | undefined} mime
 */
export function isWavMime(mime) {
	if (!mime) return false;
	const normalized = mime.toLowerCase();
	return normalized === 'audio/wav' || normalized === 'audio/x-wav' || normalized === 'audio/wave';
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function errorMessage(err) {
	return err instanceof Error ? err.message : String(err);
}

/**
 * @param {string} text
 * @param {number} [max]
 */
function truncate(text, max = 240) {
	const cleaned = text.replace(/\s+/g, ' ').trim();
	if (cleaned.length <= max) return cleaned;
	return `${cleaned.slice(0, max)}…`;
}

/**
 * Encode any ffmpeg-decodable input to a 320k CBR MP3 file.
 *
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: true, bytes: number } | { ok: false, message: string }>}
 */
export async function encodeToPlaybackMp3(inputPath, outputPath, options = {}) {
	const timeoutMs = options.timeoutMs ?? TRANSCODE_WORKER_TIMEOUT_MS;

	const proc = Bun.spawn(
		[
			'ffmpeg',
			'-y',
			'-v',
			'error',
			'-i',
			inputPath,
			'-codec:a',
			'libmp3lame',
			'-b:a',
			ENCODE_BITRATE,
			outputPath
		],
		{ stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' }
	);

	/** @type {ReturnType<typeof setTimeout> | null} */
	let timer = null;
	const timedOut = new Promise((resolve) => {
		timer = setTimeout(() => {
			try {
				proc.kill();
			} catch {
				// already exited
			}
			resolve('timeout');
		}, timeoutMs);
	});

	const finished = Promise.all([
		new Response(proc.stderr).text().catch(() => ''),
		proc.exited
	]).then(([stderr, exitCode]) => ({ stderr, exitCode }));

	const result = await Promise.race([
		finished.then((value) => ({ kind: /** @type {const} */ ('done'), value })),
		timedOut.then(() => ({ kind: /** @type {const} */ ('timeout') }))
	]);

	if (timer) clearTimeout(timer);

	if (result.kind === 'timeout') {
		return { ok: false, message: `ffmpeg encode timed out after ${timeoutMs}ms` };
	}

	const { stderr, exitCode } = result.value;
	if (exitCode !== 0) {
		return {
			ok: false,
			message: `ffmpeg encode failed (${exitCode}): ${truncate(stderr || errorMessage('no stderr'))}`
		};
	}

	const file = Bun.file(outputPath);
	if (!(await file.exists()) || file.size <= 0) {
		return { ok: false, message: 'ffmpeg produced an empty MP3.' };
	}

	return { ok: true, bytes: file.size };
}
