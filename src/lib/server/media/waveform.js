import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Number of peak buckets stored per track. SoundCloud-level granularity:
 * enough for a full-width bar waveform, small enough (~2-3KB JSON) to keep
 * on every track row and ship inline with list pages.
 */
export const WAVEFORM_BUCKETS = 1000;

/**
 * Decode sample rate for peak extraction. Peaks only need envelope
 * accuracy, so a low mono rate keeps ffmpeg fast and memory small.
 */
const PCM_SAMPLE_RATE = 4000;

/**
 * Generate compact waveform peaks from raw audio bytes using ffmpeg.
 *
 * The audio is decoded to low-rate mono 16-bit PCM, bucketed into
 * {@link WAVEFORM_BUCKETS} max-amplitude buckets, normalized against the
 * loudest bucket, and quantized to integers 0-100.
 *
 * Fail-soft by design: any decode/spawn error returns null so uploads
 * never break when ffmpeg is missing or the file is undecodable.
 *
 * @param {Uint8Array} bytes Raw audio file bytes (any ffmpeg-supported format).
 * @param {number} [buckets]
 * @returns {Promise<number[] | null>}
 */
export async function generateWaveformPeaks(bytes, buckets = WAVEFORM_BUCKETS) {
	/** @type {string | null} */
	let dir = null;

	try {
		// ffmpeg needs a seekable input for container formats like m4a/flac,
		// so stage the bytes in a temp file instead of piping stdin.
		dir = await mkdtemp(path.join(tmpdir(), 'sndbnk-waveform-'));
		const inputPath = path.join(dir, 'input');
		await writeFile(inputPath, bytes);

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
			{ stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' }
		);

		const pcmBuffer = await new Response(proc.stdout).arrayBuffer();
		const exitCode = await proc.exited;

		const sampleCount = Math.floor(pcmBuffer.byteLength / 2);
		if (exitCode !== 0 || sampleCount < buckets) {
			return null;
		}

		const samples = new Int16Array(pcmBuffer, 0, sampleCount);
		const bucketSize = sampleCount / buckets;

		/** @type {number[]} */
		const raw = new Array(buckets).fill(0);
		let maxPeak = 0;

		for (let i = 0; i < buckets; i++) {
			const start = Math.floor(i * bucketSize);
			const end = Math.min(Math.floor((i + 1) * bucketSize), sampleCount);
			let max = 0;
			for (let j = start; j < end; j++) {
				const abs = Math.abs(samples[j]);
				if (abs > max) max = abs;
			}
			raw[i] = max;
			if (max > maxPeak) maxPeak = max;
		}

		if (maxPeak === 0) {
			return raw;
		}

		return raw.map((value) => Math.round((value / maxPeak) * 100));
	} catch {
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
