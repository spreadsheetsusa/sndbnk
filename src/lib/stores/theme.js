import { writable } from 'svelte/store';

export const STORAGE_KEY = 'theme';

/** @typedef {'light' | 'dark'} Theme */
/** @typedef {Theme | 'system'} ThemePreference */

/**
 * @returns {ThemePreference}
 */
export function readStoredPreference() {
	if (typeof localStorage === 'undefined') return 'system';

	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark') return stored;
	return 'system';
}

/**
 * @returns {Theme}
 */
function getDomTheme() {
	if (typeof document === 'undefined') return 'light';
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** @type {import('svelte/store').Writable<ThemePreference>} */
export const themePreference = writable(/** @type {ThemePreference} */ (readStoredPreference()));

/** @type {import('svelte/store').Writable<Theme>} */
export const resolvedTheme = writable(/** @type {Theme} */ (getDomTheme()));

/** @type {MediaQueryList | null} */
let mediaQuery = null;

/** @type {((event: MediaQueryListEvent) => void) | null} */
let mediaListener = null;

/**
 * @returns {Theme}
 */
export function getSystemTheme() {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return 'light';
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * @param {ThemePreference} preference
 * @returns {Theme}
 */
export function resolveTheme(preference) {
	return preference === 'system' ? getSystemTheme() : preference;
}

/**
 * @param {Theme} theme
 */
export function applyTheme(theme) {
	if (typeof document === 'undefined') return;

	const root = document.documentElement;
	root.classList.toggle('dark', theme === 'dark');
	root.style.colorScheme = theme;
	resolvedTheme.set(theme);
}

/**
 * @param {ThemePreference} preference
 */
function syncSystemListener(preference) {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

	if (!mediaQuery) {
		mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	}

	if (mediaListener) {
		mediaQuery.removeEventListener('change', mediaListener);
		mediaListener = null;
	}

	if (preference !== 'system') return;

	mediaListener = () => {
		if (readStoredPreference() === 'system') {
			applyTheme(getSystemTheme());
		}
	};

	mediaQuery.addEventListener('change', mediaListener);
}

/**
 * @param {ThemePreference} preference
 */
export function setThemePreference(preference) {
	if (typeof localStorage !== 'undefined') {
		if (preference === 'system') {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, preference);
		}
	}

	themePreference.set(preference);
	applyTheme(resolveTheme(preference));
	syncSystemListener(preference);
}

export function toggleTheme() {
	const next = resolveTheme(readStoredPreference()) === 'dark' ? 'light' : 'dark';
	setThemePreference(next);
}

export function initTheme() {
	if (typeof window === 'undefined') return;

	const preference = readStoredPreference();
	themePreference.set(preference);
	applyTheme(resolveTheme(preference));
	syncSystemListener(preference);
}
