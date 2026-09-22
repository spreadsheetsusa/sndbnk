/**
 * Rasterize favicon and PWA Home Screen icons from static/icons/icon-master.png.
 *
 *   bun ./scripts/generate-pwa-icons.js
 *
 * Derivatives are committed. Re-run when the master artwork changes.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'static/icons');
const master = join(iconsDir, 'icon-master.png');

/**
 * @param {string[]} args
 * @returns {Buffer}
 */
function ffmpeg(args) {
	const result = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args]);
	if (result.status !== 0) {
		const detail = result.stderr?.toString() || 'ffmpeg failed';
		console.error(detail);
		process.exit(result.status ?? 1);
	}
	return result.stdout ?? Buffer.alloc(0);
}

/**
 * @param {number} size
 * @param {string} outPath
 * @param {number} [crop] Center crop as a fraction of the master, before scaling.
 */
function scale(size, outPath, crop) {
	const filter = crop
		? `crop=iw*${crop}:ih*${crop},scale=${size}:${size}:flags=lanczos`
		: `scale=${size}:${size}:flags=lanczos`;
	ffmpeg([
		'-i',
		master,
		'-vf',
		filter,
		'-compression_level',
		'9',
		'-frames:v',
		'1',
		'-update',
		'1',
		outPath
	]);
	console.log(`wrote ${outPath} (${size}×${size})`);
}

/** Near-black vinyl edge, so the maskable pad matches the master. */
function edgeColor() {
	const raw = join(tmpdir(), 'sndbnk-icon-edge.rgb');
	ffmpeg([
		'-i',
		master,
		'-vf',
		'crop=1:1:8:8,format=rgb24',
		'-frames:v',
		'1',
		'-f',
		'rawvideo',
		raw
	]);
	const [r, g, b] = readFileSync(raw);
	unlinkSync(raw);
	const hex = [r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('');
	return `0x${hex}`;
}

/**
 * Inset the artwork so the waveform stays inside the maskable 80% safe zone.
 * @param {string} outPath
 * @param {string} color
 */
function maskable(outPath, color) {
	const inner = Math.round(512 * 0.9);
	ffmpeg([
		'-i',
		master,
		'-vf',
		`scale=${inner}:${inner}:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=${color}`,
		'-compression_level',
		'9',
		'-frames:v',
		'1',
		'-update',
		'1',
		outPath
	]);
	console.log(`wrote ${outPath} (512×512, inset)`);
}

/**
 * Vista-style ICO: each image is a PNG payload.
 * @param {{ size: number, bytes: Buffer }[]} images
 * @param {string} outPath
 */
function writeIco(images, outPath) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);

	let offset = 6 + images.length * 16;
	const entries = images.map(({ size, bytes }) => {
		const entry = Buffer.alloc(16);
		entry.writeUInt8(size >= 256 ? 0 : size, 0);
		entry.writeUInt8(size >= 256 ? 0 : size, 1);
		entry.writeUInt16LE(1, 4);
		entry.writeUInt16LE(32, 6);
		entry.writeUInt32LE(bytes.length, 8);
		entry.writeUInt32LE(offset, 12);
		offset += bytes.length;
		return entry;
	});

	writeFileSync(
		outPath,
		Buffer.concat([header, ...entries, ...images.map((image) => image.bytes)])
	);
	console.log(`wrote ${outPath}`);
}

const pad = edgeColor();
scale(512, join(iconsDir, 'icon-512.png'));
scale(192, join(iconsDir, 'icon-192.png'));
scale(180, join(iconsDir, 'apple-touch-icon.png'));
maskable(join(iconsDir, 'icon-maskable-512.png'), pad);
// Tab icons are tiny; crop in so the waveform fills the square.
const faviconCrop = 0.78;
scale(48, join(root, 'static/favicon.png'), faviconCrop);
scale(64, join(root, 'src/lib/assets/favicon.png'), faviconCrop);

const icoSizes = [16, 32, 48];
writeIco(
	icoSizes.map((size) => {
		const path = join(tmpdir(), `sndbnk-favicon-${size}.png`);
		scale(size, path, faviconCrop);
		const bytes = readFileSync(path);
		unlinkSync(path);
		return { size, bytes };
	}),
	join(root, 'static/favicon.ico')
);

console.log('done');
