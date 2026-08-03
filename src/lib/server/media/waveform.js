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

/** Kill ffmpeg if peak extraction hangs on a hostile/corrupt file. */
const FFMPEG_TIMEOUT_MS = 30_000;

/** Cap decoded PCM (~2 minutes at 4kHz mono s16le) to bound memory. */
const MAX_PCM_BYTES = PCM_SAMPLE_RATE * 2 * 120;

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
 * Generate compact waveform peaks from raw audio bytes using ffmpeg.
 *
 * The audio is decoded to low-rate mono 16-bit PCM, bucketed into
 * {@link WAVEFORM_BUCKETS} max-amplitude buckets (or fewer for very short
 * files), normalized against the loudest bucket, and quantized to integers
 * 0-100.
 *
 * Fail-soft by design: any decode/spawn error returns null so uploads
 * never break when ffmpeg is missing or the file is undecodable. Failures
 * are logged so the host journal shows why peaks were skipped.
 *
 * @param {Uint8Array} bytes Raw audio file bytes (any ffmpeg-supported format).
 * @param {{ buckets?: number, ext?: string | null }} [options]
 * @returns {Promise<number[] | null>}
 */
export async function generateWaveformPeaks(bytes, options = {}) {
	const buckets = options.buckets ?? WAVEFORM_BUCKETS;
	const ext = (options.ext ?? '')
		.replace(/^\./, '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
	const filename = ext ? `input.${ext}` : 'input';

	/** @type {string | null} */
	let dir = null;

	try {
		// ffmpeg needs a seekable input for container formats like m4a/flac,
		// so stage the bytes in a temp file instead of piping stdin. Prefer an
		// extension hint so probing does not guess wrong for AAC/M4A.
		dir = await mkdtemp(path.join(tmpdir(), 'sndbnk-waveform-'));
		const inputPath = path.join(dir, filename);
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
			{ stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' }
		);

		const timer = setTimeout(() => {
			try {
				proc.kill();
			} catch {
				// already exited
			}
		}, FFMPEG_TIMEOUT_MS);

		/** @type {ArrayBuffer} */
		let pcmBuffer;
		/** @type {ArrayBuffer} */
		let stderrBuffer;
		/** @type {number} */
		let exitCode;
		try {
			[pcmBuffer, stderrBuffer, exitCode] = await Promise.all([
				readStreamCapped(proc.stdout, MAX_PCM_BYTES),
				new Response(proc.stderr).arrayBuffer(),
				proc.exited
			]);
		} finally {
			clearTimeout(timer);
		}

		const sampleCount = Math.floor(pcmBuffer.byteLength / 2);
		if (exitCode !== 0 || sampleCount < 1) {
			const stderr = truncate(new TextDecoder().decode(stderrBuffer));
			console.error(
				`[waveform] ffmpeg failed (exit=${exitCode}, samples=${sampleCount}, ext=${ext || 'none'})${
					stderr ? `: ${stderr}` : ''
				}`
			);
			return null;
		}

		const samples = new Int16Array(pcmBuffer, 0, sampleCount);
		const bucketCount = Math.min(buckets, sampleCount);
		const bucketSize = sampleCount / bucketCount;

		/** @type {number[]} */
		const raw = new Array(bucketCount).fill(0);
		let maxPeak = 0;

		for (let i = 0; i < bucketCount; i++) {
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
 * Read a stream into an ArrayBuffer, aborting if it exceeds maxBytes.
 * @param {ReadableStream | null} stream
 * @param {number} maxBytes
 */
async function readStreamCapped(stream, maxBytes) {
	if (!stream) return new ArrayBuffer(0);
	const reader = stream.getReader();
	/** @type {Uint8Array[]} */
	const chunks = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel().catch(() => {});
			throw new Error('Decoded PCM exceeded size limit.');
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out.buffer;
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
