import { normalizeHex, onAccentFor } from '#lib/stores/brand.js';

/**
 * Inline accent vars for a navbar or footer. Unset means inherit the site theme.
 * Does not override `--hard-border`, so light-mode chrome keeps ink borders.
 * @param {string | null | undefined} hex
 * @returns {string | undefined}
 */
export function chromeAccentStyle(hex) {
	const accent = normalizeHex(hex ?? '');
	if (!accent) return undefined;
	const onAccent = onAccentFor(accent);
	return `--accent:${accent};--on-accent:${onAccent};--theme-primary:${accent};--theme-4:${accent};--theme-3:${accent};--theme-success:${accent}`;
}
