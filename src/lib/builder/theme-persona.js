import Color from 'colorjs.io';

/** @typedef {'mono' | 'analogous' | 'complementary' | 'split' | 'soft' | 'vivid'} ThemePersona */

/** @typedef {'primary' | 'secondary' | 'tertiary' | 'surface' | 'success' | 'error'} ThemeSlotId */

/**
 * @typedef {{
 *   primary: string,
 *   secondary: string,
 *   tertiary: string,
 *   surface: string,
 *   success: string,
 *   error: string
 * }} ThemeSlotColors
 */

/**
 * @typedef {{
 *   id: string,
 *   hex: string
 * }} ThemeChip
 */

export const THEME_PERSONAS = /** @type {const} */ ([
	'mono',
	'analogous',
	'complementary',
	'split',
	'soft',
	'vivid'
]);

/** @type {Set<string>} */
export const THEME_PERSONA_SET = new Set(THEME_PERSONAS);

export const DEFAULT_THEME_PERSONA = /** @type {ThemePersona} */ ('mono');

/** @type {Array<{ id: ThemePersona, label: string }>} */
export const THEME_PERSONA_OPTIONS = [
	{ id: 'mono', label: 'Mono' },
	{ id: 'analogous', label: 'Analogous' },
	{ id: 'complementary', label: 'Complement' },
	{ id: 'split', label: 'Split' },
	{ id: 'soft', label: 'Soft' },
	{ id: 'vivid', label: 'Vivid' }
];

/** Fixed semantic slots — index maps to chip order. */
export const THEME_SLOTS = /** @type {const} */ ([
	{ id: 'primary', label: 'Primary' },
	{ id: 'secondary', label: 'Secondary' },
	{ id: 'tertiary', label: 'Tertiary' },
	{ id: 'surface', label: 'Surface' },
	{ id: 'success', label: 'Success' },
	{ id: 'error', label: 'Error' }
]);

/** @type {ThemeSlotId[]} */
export const THEME_SLOT_IDS = THEME_SLOTS.map((slot) => slot.id);

/** @type {Set<string>} */
export const THEME_SLOT_SET = new Set(THEME_SLOT_IDS);

/**
 * @param {string | null | undefined} raw
 * @returns {ThemePersona}
 */
export function normalizeThemePersona(raw) {
	const value = raw?.toString().trim() ?? '';
	return THEME_PERSONA_SET.has(value) ? /** @type {ThemePersona} */ (value) : DEFAULT_THEME_PERSONA;
}

/**
 * @param {string} hex
 * @returns {Color}
 */
function toColor(hex) {
	try {
		return new Color(hex);
	} catch {
		return new Color('#b8ff3d');
	}
}

/**
 * @param {Color} color
 * @returns {string}
 */
function toHex(color) {
	const srgb = color.to('srgb');
	srgb.toGamut({ method: 'clip' });
	return srgb.toString({ format: 'hex' }).toUpperCase();
}

/**
 * @param {Color} base
 * @param {{ h?: number, c?: number, l?: number }} delta
 * @returns {string}
 */
function oklchShift(base, delta) {
	const next = base.to('oklch');
	const coords = /** @type {[number, number, number]} */ ([...next.coords]);
	if (delta.l != null) coords[0] = Math.min(1, Math.max(0, coords[0] + delta.l));
	if (delta.c != null) coords[1] = Math.max(0, coords[1] + delta.c);
	if (delta.h != null) {
		const hue = Number.isFinite(coords[2]) ? coords[2] : 0;
		coords[2] = (((hue + delta.h) % 360) + 360) % 360;
	}
	next.coords = coords;
	return toHex(next);
}

/**
 * Contrast-aware text color for fills (black/white).
 * @param {string} hex
 * @returns {string}
 */
export function onColorFor(hex) {
	const color = toColor(hex);
	const onDark = new Color('#11110f');
	const onLight = new Color('#f2f0e8');
	const darkContrast = Math.abs(color.contrast(onDark, 'WCAG21'));
	const lightContrast = Math.abs(color.contrast(onLight, 'WCAG21'));
	return darkContrast >= lightContrast ? '#11110F' : '#F2F0E8';
}

/**
 * @param {string} accentHex
 * @param {ThemePersona} persona
 * @returns {string[]}
 */
function deriveColors(accentHex, persona) {
	const base = toColor(accentHex);

	switch (persona) {
		case 'analogous':
			return [
				oklchShift(base, { h: -30, l: 0.04 }),
				oklchShift(base, { h: 30, l: -0.04 }),
				oklchShift(base, { h: -18, c: -0.02, l: 0.12 }),
				oklchShift(base, { h: 18, c: -0.03, l: -0.1 }),
				oklchShift(base, { c: -0.06, l: 0.18 })
			];
		case 'complementary':
			return [
				oklchShift(base, { h: 180 }),
				oklchShift(base, { h: 180, l: 0.1, c: -0.02 }),
				oklchShift(base, { l: 0.14, c: -0.04 }),
				oklchShift(base, { h: 180, l: -0.12 }),
				oklchShift(base, { c: -0.08, l: 0.2 })
			];
		case 'split':
			return [
				oklchShift(base, { h: 150 }),
				oklchShift(base, { h: -150 }),
				oklchShift(base, { h: 150, l: 0.1, c: -0.02 }),
				oklchShift(base, { h: -150, l: -0.08 }),
				oklchShift(base, { c: -0.07, l: 0.16 })
			];
		case 'soft':
			return [
				oklchShift(base, { c: -0.08, l: 0.12 }),
				oklchShift(base, { c: -0.1, l: 0.2 }),
				oklchShift(base, { h: 20, c: -0.09, l: 0.08 }),
				oklchShift(base, { h: -20, c: -0.09, l: -0.02 }),
				oklchShift(base, { c: -0.12, l: 0.26 })
			];
		case 'vivid':
			return [
				oklchShift(base, { h: 40, c: 0.06 }),
				oklchShift(base, { h: -40, c: 0.05 }),
				oklchShift(base, { h: 120, c: 0.04 }),
				oklchShift(base, { c: 0.08, l: -0.06 }),
				oklchShift(base, { h: 180, c: 0.05, l: 0.04 })
			];
		case 'mono':
		default:
			return [
				oklchShift(base, { l: 0.16, c: -0.02 }),
				oklchShift(base, { l: -0.12, c: -0.01 }),
				oklchShift(base, { l: 0.28, c: -0.05 }),
				oklchShift(base, { l: -0.22, c: -0.02 }),
				oklchShift(base, { l: 0.38, c: -0.08 })
			];
	}
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * @param {string} hex
 * @returns {string | null}
 */
function normalizeSlotHex(hex) {
	const value = hex?.toString().trim() ?? '';
	if (!HEX_PATTERN.test(value)) return null;
	return value.toUpperCase();
}

/**
 * @param {string} accentHex
 * @param {string | null | undefined} personaId
 * @returns {ThemeSlotColors}
 */
export function deriveSlotColors(accentHex, personaId) {
	const persona = normalizeThemePersona(personaId);
	const primary = toHex(toColor(accentHex));
	const rest = deriveColors(primary, persona);
	return {
		primary,
		secondary: rest[0],
		tertiary: rest[1],
		surface: rest[2],
		success: rest[3],
		error: rest[4]
	};
}

/**
 * @param {unknown} raw
 * @param {ThemeSlotColors} fallback
 * @returns {ThemeSlotColors}
 */
export function normalizeThemePalette(raw, fallback) {
	if (!raw || typeof raw !== 'object') return { ...fallback };
	const row = /** @type {Record<string, unknown>} */ (raw);
	/** @type {ThemeSlotColors} */
	const next = { ...fallback };
	for (const slot of THEME_SLOT_IDS) {
		const hex = normalizeSlotHex(typeof row[slot] === 'string' ? row[slot] : '');
		if (hex) next[slot] = hex;
	}
	return next;
}

/**
 * Parse DB JSON / API body into slot colors, or null when empty/invalid.
 * @param {unknown} raw
 * @returns {ThemeSlotColors | null}
 */
export function parseThemePalette(raw) {
	if (raw == null || raw === '') return null;
	let value = raw;
	if (typeof raw === 'string') {
		try {
			value = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!value || typeof value !== 'object') return null;
	const row = /** @type {Record<string, unknown>} */ (value);
	/** @type {Partial<ThemeSlotColors>} */
	const next = {};
	for (const slot of THEME_SLOT_IDS) {
		const hex = normalizeSlotHex(typeof row[slot] === 'string' ? row[slot] : '');
		if (!hex) return null;
		next[slot] = hex;
	}
	return /** @type {ThemeSlotColors} */ (next);
}

/**
 * @param {ThemeSlotColors} colors
 * @returns {ThemeChip[]}
 */
export function chipsFromSlotColors(colors) {
	return THEME_SLOT_IDS.map((slot) => ({
		id: crypto.randomUUID(),
		hex: colors[slot]
	}));
}

/**
 * @param {ThemeChip[]} chips
 * @returns {ThemeSlotColors}
 */
export function slotColorsFromChips(chips) {
	/** @type {ThemeSlotColors} */
	const colors = {
		primary: chips[0]?.hex ?? '#B8FF3D',
		secondary: chips[1]?.hex ?? '#B8FF3D',
		tertiary: chips[2]?.hex ?? '#B8FF3D',
		surface: chips[3]?.hex ?? '#B8FF3D',
		success: chips[4]?.hex ?? '#B8FF3D',
		error: chips[5]?.hex ?? '#B8FF3D'
	};
	return colors;
}

/**
 * @param {ThemeSlotColors} colors
 * @returns {Record<string, string>}
 */
export function cssVarsFromSlotColors(colors) {
	const onAccent = onColorFor(colors.primary);
	return {
		'--accent': colors.primary,
		'--on-accent': onAccent,
		'--theme-primary': colors.primary,
		'--theme-secondary': colors.secondary,
		'--theme-tertiary': colors.tertiary,
		'--theme-surface': colors.surface,
		'--theme-success': colors.success,
		'--theme-error': colors.error,
		// Back-compat aliases used by header/footer chrome.
		'--theme-1': colors.secondary,
		'--theme-2': colors.tertiary,
		'--theme-3': colors.surface,
		'--theme-4': colors.success,
		'--theme-5': colors.error
	};
}

/**
 * @typedef {{
 *   accent: string,
 *   onAccent: string,
 *   colors: [string, string, string, string, string],
 *   slots: ThemeSlotColors,
 *   cssVars: Record<string, string>
 * }} PersonaPalette
 */

/**
 * Build accent + 5 persona colors and CSS custom-property map.
 * @param {string} accentHex `#RRGGBB`
 * @param {string | null | undefined} personaId
 * @param {ThemeSlotColors | null | undefined} [paletteOverride]
 * @returns {PersonaPalette}
 */
export function buildPersonaPalette(accentHex, personaId, paletteOverride = null) {
	const derived = deriveSlotColors(accentHex, personaId);
	const slots = paletteOverride ? normalizeThemePalette(paletteOverride, derived) : derived;
	const onAccent = onColorFor(slots.primary);
	return {
		accent: slots.primary,
		onAccent,
		colors: [slots.secondary, slots.tertiary, slots.surface, slots.success, slots.error],
		slots,
		cssVars: cssVarsFromSlotColors(slots)
	};
}
