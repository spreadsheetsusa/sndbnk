import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Number of peak buckets stored per track. SoundCloud-level granularity:
 * enough for a full-width bar waveform, small enough (~2-3KB JSON) to keep
 * on every track row and ship inline with list pages.
 */
export const WAVEFORM_BUCKETS = 1000;

/** Co-located peaks file beside audio/cover in the track storage folder. */
export const WAVEFORM_FILENAME = 'waveform.json';

/**
 * Decode sample rate for peak extraction. Peaks only need envelope
 * accuracy, so a low mono rate keeps ffmpeg fast and memory small.
 */
const PCM_SAMPLE_RATE = 4000;

/** Default kill timeout (hostile/corrupt files on sync/dev paths). */
const FFMPEG_TIMEOUT_MS = 30_000;

/** Worker path: long DJ mixes may take several minutes to decode at 4 kHz. */
export const WAVEFORM_WORKER_TIMEOUT_MS = 15 * 60 * 1000;

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
 * @param {string} inputPath
 * @param {number} [timeoutMs]
 * @returns {Promise<number | null>} duration in seconds, or null if unknown
 */
async function probeDurationSeconds(inputPath, timeoutMs = FFMPEG_TIMEOUT_MS) {
	const proc = Bun.spawn(
		[
			'ffprobe',
			'-v',
			'error',
			'-show_entries',
			'format=duration',
			'-of',
			'default=noprint_wrappers=1:nokey=1',
			inputPath
		],
		{ stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' }
	);

	const timer = setTimeout(() => {
		try {
			proc.kill();
		} catch {
			// already exited
		}
	}, timeoutMs);

	try {
		const [stdoutBuf, exitCode] = await Promise.all([
			new Response(proc.stdout).arrayBuffer(),
			proc.exited
		]);

		if (exitCode !== 0) return null;
		const text = new TextDecoder().decode(stdoutBuf).trim();
		const seconds = Number.parseFloat(text);
		return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Stream ffmpeg PCM stdout into max-amplitude buckets without holding the
 * full decode in memory. Uses ffprobe duration to size buckets up front.
 *
 * @param {string} inputPath
 * @param {{ buckets: number, timeoutMs: number }} options
 * @returns {Promise<number[] | null>}
 */
async function extractPeaksFromPath(inputPath, options) {
	const { buckets, timeoutMs } = options;

	const durationSec = await probeDurationSeconds(inputPath);
	const estimatedSamples = durationSec
		? Math.max(1, Math.floor(durationSec * PCM_SAMPLE_RATE))
		: null;

	const proc = Bun.spawn(
		[
			'ffmpeg',
			'-v',
			'error',
			'-i',
			inputPath,
			'-ac',
			'1',
			'-ar',
			String(PCM_SAMPLE_RATE),
			'-f',
			's16le',
			'-'
		],
		{ stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' }
	);

	const timer = setTimeout(() => {
		try {
			proc.kill();
		} catch {
			// already exited
		}
	}, timeoutMs);

	try {
		const stderrPromise = new Response(proc.stderr).arrayBuffer();
		const stream = proc.stdout;
		if (!stream) {
			await proc.exited;
			return null;
		}

		const reader = stream.getReader();
		let sampleCount = 0;
		let maxPeak = 0;
		/** @type {Uint8Array | null} */
		let pendingLow = null;

		// Size buckets from duration when known; otherwise grow a coarse
		// 1-peak/sec envelope and downsample after the stream ends.
		const useDuration = estimatedSamples !== null;
		const bucketCount = useDuration ? Math.min(buckets, estimatedSamples) : 0;
		const bucketSize = useDuration ? estimatedSamples / bucketCount : 0;
		/** @type {number[]} */
		const raw = useDuration ? new Array(bucketCount).fill(0) : [];
		/** coarse path */
		let intervalMax = 0;
		let inInterval = 0;
		const coarseInterval = PCM_SAMPLE_RATE;

		/**
		 * @param {number} sample
		 */
		const pushSample = (sample) => {
			const abs = sample < 0 ? -sample : sample;
			sampleCount += 1;
			if (abs > maxPeak) maxPeak = abs;

			if (useDuration) {
				const bi = Math.min(bucketCount - 1, Math.floor((sampleCount - 1) / bucketSize));
				if (abs > raw[bi]) raw[bi] = abs;
				return;
			}

			if (abs > intervalMax) intervalMax = abs;
			inInterval += 1;
			if (inInterval >= coarseInterval) {
				raw.push(intervalMax);
				intervalMax = 0;
				inInterval = 0;
			}
		};

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value?.byteLength) continue;

			let bytes = value;
			if (pendingLow) {
				const merged = new Uint8Array(pendingLow.byteLength + bytes.byteLength);
				merged.set(pendingLow);
				merged.set(bytes, pendingLow.byteLength);
				bytes = merged;
				pendingLow = null;
			}

			if (bytes.byteLength % 2 === 1) {
				pendingLow = bytes.subarray(bytes.byteLength - 1);
				bytes = bytes.subarray(0, bytes.byteLength - 1);
			}

			const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			const count = bytes.byteLength / 2;
			for (let i = 0; i < count; i++) {
				pushSample(view.getInt16(i * 2, true));
			}
		}

		if (!useDuration && inInterval > 0) raw.push(intervalMax);

		const [stderrBuffer, exitCode] = await Promise.all([stderrPromise, proc.exited]);

		if (exitCode !== 0 || sampleCount < 1 || raw.length === 0) {
			const stderr = truncate(new TextDecoder().decode(stderrBuffer));
			console.error(
				`[waveform] ffmpeg failed (exit=${exitCode}, samples=${sampleCount})${
					stderr ? `: ${stderr}` : ''
				}`
			);
			return null;
		}

		/** @type {number[]} */
		let peaks = raw;
		if (!useDuration) {
			const bucketCountFallback = Math.min(buckets, raw.length);
			const size = raw.length / bucketCountFallback;
			peaks = new Array(bucketCountFallback).fill(0);
			maxPeak = 0;
			for (let i = 0; i < bucketCountFallback; i++) {
				const start = Math.floor(i * size);
				const end = Math.min(Math.floor((i + 1) * size), raw.length);
				let max = 0;
				for (let j = start; j < end; j++) {
					if (raw[j] > max) max = raw[j];
				}
				peaks[i] = max;
				if (max > maxPeak) maxPeak = max;
			}
		}

		if (maxPeak === 0) return peaks;
		return peaks.map((value) => Math.round((value / maxPeak) * 100));
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Generate compact waveform peaks from a seekable audio file path.
 *
 * @param {string} inputPath Absolute or cwd-relative path to the audio file.
 * @param {{ buckets?: number, timeoutMs?: number }} [options]
 * @returns {Promise<number[] | null>}
 */
export async function generateWaveformPeaksFromPath(inputPath, options = {}) {
	const buckets = options.buckets ?? WAVEFORM_BUCKETS;
	const timeoutMs = options.timeoutMs ?? WAVEFORM_WORKER_TIMEOUT_MS;

	try {
		return await extractPeaksFromPath(inputPath, { buckets, timeoutMs });
	} catch (err) {
		console.error(`[waveform] peak generation failed: ${errorMessage(err)}`);
		return null;
	}
}

/**
 * Generate compact waveform peaks from raw audio bytes using ffmpeg.
 *
 * Stages bytes to a temp file (seekable input for m4a/flac), then delegates
 * to {@link generateWaveformPeaksFromPath}. Prefer the path API when the file
 * is already on disk.
 *
 * Fail-soft by design: any decode/spawn error returns null so uploads never
 * break when ffmpeg is missing or the file is undecodable.
 *
 * @param {Uint8Array} bytes Raw audio file bytes (any ffmpeg-supported format).
 * @param {{ buckets?: number, ext?: string | null, timeoutMs?: number }} [options]
 * @returns {Promise<number[] | null>}
 */
export async function generateWaveformPeaks(bytes, options = {}) {
	const ext = (options.ext ?? '')
		.replace(/^\./, '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
	const filename = ext ? `input.${ext}` : 'input';

	/** @type {string | null} */
	let dir = null;

	try {
		// ffmpeg needs a seekable input for container formats like m4a/flac,
		// so stage the bytes in a temp file instead of piping stdin.
		dir = await mkdtemp(path.join(tmpdir(), 'sndbnk-waveform-'));
		const inputPath = path.join(dir, filename);
		await writeFile(inputPath, bytes);
		return await generateWaveformPeaksFromPath(inputPath, {
			buckets: options.buckets,
			timeoutMs: options.timeoutMs ?? FFMPEG_TIMEOUT_MS
		});
	} catch (err) {
		console.error(`[waveform] peak generation failed: ${errorMessage(err)}`);
		return null;
	} finally {
		if (dir) {
			await rm(dir, { recursive: true, force: true }).catch(() => {});
		}
	}
}

/**
 * Parse a stored waveform column value back into peaks.
 * @param {string | null | undefined} stored
 * @returns {number[] | null}
 */
export function parseWaveform(stored) {
	if (!stored) return null;
	try {
		const parsed = JSON.parse(stored);
		if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((n) => typeof n === 'number')) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}
