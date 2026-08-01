import { derived, writable } from 'svelte/store';

export const ACCENT_STORAGE_KEY = 'accent';

/** @typedef {{ id: string, label: string, value: string, onAccent: string }} AccentOption */

/** @type {AccentOption[]} */
export const ACCENTS = [
	{ id: 'lime', label: 'Lime', value: '#c8ff3d', onAccent: '#11110f' },
	{ id: 'cyan', label: 'Cyan', value: '#3de0ff', onAccent: '#11110f' },
	{ id: 'magenta', label: 'Magenta', value: '#ff3d8a', onAccent: '#11110f' },
	{ id: 'orange', label: 'Orange', value: '#ff8a3d', onAccent: '#11110f' }
];

const DEFAULT_ACCENT_ID = ACCENTS[0].id;

/**
 * @param {string | null | undefined} id
 * @returns {AccentOption}
 */
export function getAccentOption(id) {
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
	return match?.id ?? DEFAULT_ACCENT_ID;
}

/** @type {import('svelte/store').Writable<string>} */
export const accent = writable(/** @type {string} */ (getDomAccent()));

/** @type {import('svelte/store').Readable<string>} */
export const accentColor = derived(accent, ($accent) => getAccentOption($accent).value);

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

export function initAccent() {
	if (typeof window === 'undefined') return;

	applyAccent(readStoredAccent());
}
