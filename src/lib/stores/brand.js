import { derived, get, writable } from 'svelte/store';

export const ACCENT_STORAGE_KEY = 'accent';
export const CUSTOM_ACCENT_STORAGE_KEY = 'accent-custom';
export const CUSTOM_ACCENT_ID = 'custom';
export const DEFAULT_CUSTOM_ACCENT = '#8a5cff';

const ON_ACCENT_DARK = '#11110f';
const ON_ACCENT_LIGHT = '#f2f0e8';

/** @typedef {{ id: string, label: string, value: string, onAccent: string }} AccentOption */

/** @type {AccentOption[]} */
export const ACCENTS = [
	{ id: 'lime', label: 'Lime', value: '#c8ff3d', onAccent: ON_ACCENT_DARK },
	{ id: 'cyan', label: 'Cyan', value: '#3de0ff', onAccent: ON_ACCENT_DARK },
	{ id: 'magenta', label: 'Magenta', value: '#ff3d8a', onAccent: ON_ACCENT_DARK },
	{ id: 'orange', label: 'Orange', value: '#ff8a3d', onAccent: ON_ACCENT_DARK }
];

const DEFAULT_ACCENT_ID = ACCENTS[0].id;

/**
 * Waveform.svelte parses `--accent` as hex itself, so the accent must always be `#rrggbb`.
 *
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizeHex(value) {
	const input = String(value ?? '')
		.trim()
		.toLowerCase();
	const hex = /^#[0-9a-f]{3}$/.test(input)
		? `#${input[1]}${input[1]}${input[2]}${input[2]}${input[3]}${input[3]}`
		: input;

	return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

/**
 * Readable text color for an arbitrary accent fill. 0.179 is the relative luminance at which ink
 * and paper give equal WCAG contrast against the fill.
 *
 * @param {string} hex
 * @returns {string}
 */
export function onAccentFor(hex) {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? ON_ACCENT_DARK : ON_ACCENT_LIGHT;
}

/**
 * @returns {string}
 */
function readStoredCustomAccent() {
	if (typeof localStorage === 'undefined') return DEFAULT_CUSTOM_ACCENT;

	return normalizeHex(localStorage.getItem(CUSTOM_ACCENT_STORAGE_KEY)) ?? DEFAULT_CUSTOM_ACCENT;
}

/** @type {import('svelte/store').Writable<string>} */
export const customAccent = writable(readStoredCustomAccent());

/**
 * @param {string | null | undefined} id
 * @returns {AccentOption}
 */
export function getAccentOption(id) {
	if (id === CUSTOM_ACCENT_ID) {
		const value = get(customAccent);
		return { id: CUSTOM_ACCENT_ID, label: 'Custom', value, onAccent: onAccentFor(value) };
	}

	return ACCENTS.find((option) => option.id === id) ?? ACCENTS[0];
}

/**
 * @returns {string}
 */
export function readStoredAccent() {
	if (typeof localStorage === 'undefined') return DEFAULT_ACCENT_ID;

	const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
	return getAccentOption(stored).id;
}

/**
 * @returns {string}
 */
function getDomAccent() {
	if (typeof document === 'undefined') return DEFAULT_ACCENT_ID;

	const value = document.documentElement.style.getPropertyValue('--accent').trim().toLowerCase();
	const match = ACCENTS.find((option) => option.value === value);
	if (match) return match.id;

	return normalizeHex(value) ? CUSTOM_ACCENT_ID : DEFAULT_ACCENT_ID;
}

/** @type {import('svelte/store').Writable<string>} */
export const accent = writable(/** @type {string} */ (getDomAccent()));

/** @type {import('svelte/store').Readable<string>} */
export const accentColor = derived(
	[accent, customAccent],
	([$accent]) =>
		// customAccent participates so a custom drag re-derives, but the value comes from the option.
		getAccentOption($accent).value
);

/**
 * @param {string} id
 */
export function applyAccent(id) {
	if (typeof document === 'undefined') return;

	const option = getAccentOption(id);
	const root = document.documentElement;
	root.style.setProperty('--accent', option.value);
	root.style.setProperty('--on-accent', option.onAccent);
	accent.set(option.id);
}

/**
 * @param {string} id
 */
export function setAccent(id) {
	const option = getAccentOption(id);

	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(ACCENT_STORAGE_KEY, option.id);
	}

	applyAccent(option.id);
}

/**
 * @param {string} value
 * @returns {string | null} the normalized hex that was applied, or null when the input was invalid
 */
export function setCustomAccent(value) {
	const hex = normalizeHex(value);
	if (!hex) return null;

	customAccent.set(hex);

	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(CUSTOM_ACCENT_STORAGE_KEY, hex);
		localStorage.setItem(ACCENT_STORAGE_KEY, CUSTOM_ACCENT_ID);
	}

	applyAccent(CUSTOM_ACCENT_ID);
	return hex;
}

export function initAccent() {
	if (typeof window === 'undefined') return;

	customAccent.set(readStoredCustomAccent());
	applyAccent(readStoredAccent());
}
