import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PROBE_TIMEOUT_MS = 20_000;

/** Formats we will accept after ffprobe confirms an audio stream. */
const ACCEPT_FORMATS = new Set(['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'aiff', 'aif']);

/** @type {Record<string, { ext: string, mime: string }>} */
const FORMAT_TO_FILE = {
	mp3: { ext: 'mp3', mime: 'audio/mpeg' },
	mp2: { ext: 'mp3', mime: 'audio/mpeg' },
	wav: { ext: 'wav', mime: 'audio/wav' },
	flac: { ext: 'flac', mime: 'audio/flac' },
	aac: { ext: 'aac', mime: 'audio/aac' },
	m4a: { ext: 'm4a', mime: 'audio/mp4' },
	ipod: { ext: 'm4a', mime: 'audio/mp4' },
	mov: { ext: 'm4a', mime: 'audio/mp4' },
	ogg: { ext: 'ogg', mime: 'audio/ogg' },
	oga: { ext: 'ogg', mime: 'audio/ogg' },
	aiff: { ext: 'aiff', mime: 'audio/aiff' },
	aif: { ext: 'aiff', mime: 'audio/aiff' }
};

/**
 * @param {unknown} err
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
 * Map ffprobe format_name / codec_name to an allowlisted ext+mime.
 *
 * @param {string} formatName
 * @param {string} [codecName]
 * @returns {{ ext: string, mime: string } | null}
 */
export function mapProbeFormat(formatName, codecName) {
	const names = `${formatName},${codecName ?? ''}`
		.toLowerCase()
		.split(/[,/]+/)
		.map((part) => part.trim())
		.filter(Boolean);

	for (const name of names) {
		if (FORMAT_TO_FILE[name]) return FORMAT_TO_FILE[name];
	}
	if (names.includes('mp4') && (names.includes('aac') || names.includes('alac'))) {
		return FORMAT_TO_FILE.m4a;
	}
	return null;
}

/**
 * Probe a seekable path. Rejects undecodable or non-allowlisted audio.
 *
 * @param {string} inputPath
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<
 *   | { ok: true, ext: string, mime: string, formatName: string, codecName: string | null }
 *   | { ok: false, message: string }
 * >}
 */
export async function probeAudioPath(inputPath, options = {}) {
	const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_MS;
	const proc = Bun.spawn(
		[
			'ffprobe',
			'-v',
			'error',
			'-show_entries',
			'format=format_name:stream=codec_type,codec_name',
			'-of',
			'json',
			inputPath
		],
		{ stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' }
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
		new Response(proc.stdout).text().catch(() => ''),
		new Response(proc.stderr).text().catch(() => ''),
		proc.exited
	]).then(([stdout, stderr, exitCode]) => ({ stdout, stderr, exitCode }));

	const result = await Promise.race([
		finished.then((value) => ({ kind: /** @type {const} */ ('done'), value })),
		timedOut.then(() => ({ kind: /** @type {const} */ ('timeout') }))
	]);

	if (timer) clearTimeout(timer);

	if (result.kind === 'timeout') {
		return { ok: false, message: 'Could not decode this audio file (probe timed out).' };
	}

	const { stdout, stderr, exitCode } = result.value;
	if (exitCode !== 0) {
		return {
			ok: false,
			message: `Could not decode this audio file.${stderr ? ` ${truncate(stderr)}` : ''}`
		};
	}

	/** @type {{ format?: { format_name?: string }, streams?: { codec_type?: string, codec_name?: string }[] }} */
	let parsed;
	try {
		parsed = JSON.parse(stdout);
	} catch {
		return { ok: false, message: 'Could not decode this audio file.' };
	}

	const audioStream = parsed.streams?.find((stream) => stream.codec_type === 'audio');
	if (!audioStream) {
		return { ok: false, message: 'That file has no audio stream we can decode.' };
	}

	const formatName = parsed.format?.format_name ?? '';
	const mapped = mapProbeFormat(formatName, audioStream.codec_name);
	if (!mapped || !ACCEPT_FORMATS.has(mapped.ext)) {
		return {
			ok: false,
			message: 'Audio must be mp3, wav, flac, aac, ogg, m4a, or aiff.'
		};
	}

	return {
		ok: true,
		ext: mapped.ext,
		mime: mapped.mime,
		formatName,
		codecName: audioStream.codec_name ?? null
	};
}

/**
 * Stage bytes and probe. Used when magic-byte sniff is inconclusive.
 *
 * @param {Uint8Array} bytes
 * @param {string} [hintExt]
 */
export async function probeAudioBytes(bytes, hintExt = 'bin') {
	const tempDir = await mkdtemp(path.join(tmpdir(), 'sndbnk-probe-'));
	const inputPath = path.join(tempDir, `input.${hintExt.replace(/^\./, '') || 'bin'}`);
	try {
		await writeFile(inputPath, bytes);
		return await probeAudioPath(inputPath);
	} catch (err) {
		return {
			ok: false,
			message: errorMessage(err).includes('ffprobe')
				? 'Could not decode this audio file.'
				: errorMessage(err)
		};
	} finally {
		await rm(tempDir, { recursive: true, force: true }).catch(() => {
			// temp dir may already be gone
		});
	}
}
