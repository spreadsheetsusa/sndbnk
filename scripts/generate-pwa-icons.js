/**
 * Rasterize PWA Home Screen icons from SVG masters in static/icons/.
 *
 *   bun add -d @resvg/resvg-js
 *   bun ./scripts/generate-pwa-icons.js
 *   bun remove @resvg/resvg-js
 *
 * PNGs are committed; this script is only needed when the SVG masters change.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'static/icons');

/** @type {typeof import('@resvg/resvg-js').Resvg} */
let Resvg;
try {
	({ Resvg } = await import('@resvg/resvg-js'));
} catch {
	console.error('Missing @resvg/resvg-js. Install temporarily:\n  bun add -d @resvg/resvg-js');
	process.exit(1);
}

/**
 * @param {string} svgPath
 * @param {number} size
 * @param {string} outName
 */
function render(svgPath, size, outName) {
	const svg = readFileSync(svgPath);
	const png = new Resvg(svg, {
		fitTo: { mode: 'width', value: size },
		background: 'transparent'
	})
		.render()
		.asPng();
	const out = join(iconsDir, outName);
	writeFileSync(out, png);
	console.log(`wrote ${outName} (${size}×${size})`);
}

mkdirSync(iconsDir, { recursive: true });

const anySvg = join(iconsDir, 'icon-any.svg');
const maskableSvg = join(iconsDir, 'icon-maskable.svg');

render(anySvg, 192, 'icon-192.png');
render(anySvg, 512, 'icon-512.png');
render(anySvg, 180, 'apple-touch-icon.png');
render(maskableSvg, 512, 'icon-maskable-512.png');

console.log('done');
