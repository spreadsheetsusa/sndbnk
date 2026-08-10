/** @typedef {'light' | 'dark'} ResolvedAppearance */
/** @typedef {'light' | 'dark' | 'user'} SiteAppearanceMode */

/**
 * @param {string} siteId
 * @returns {string}
 */
export function siteAppearanceStorageKey(siteId) {
	return `site-theme:${siteId}`;
}

/**
 * @param {string | null | undefined} siteId
 * @returns {ResolvedAppearance | null}
 */
export function readSiteVisitorAppearance(siteId) {
	if (typeof localStorage === 'undefined' || !siteId) return null;
	const stored = localStorage.getItem(siteAppearanceStorageKey(siteId));
	if (stored === 'light' || stored === 'dark') return stored;
	return null;
}

/**
 * @param {string | null | undefined} siteId
 * @param {ResolvedAppearance} value
 */
export function writeSiteVisitorAppearance(siteId, value) {
	if (typeof localStorage === 'undefined' || !siteId) return;
	localStorage.setItem(siteAppearanceStorageKey(siteId), value);
}

/**
 * @returns {ResolvedAppearance}
 */
export function systemAppearance() {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve locked or visitor appearance for a site.
 * @param {SiteAppearanceMode} mode
 * @param {string | null | undefined} siteId
 * @returns {ResolvedAppearance}
 */
export function resolveSiteAppearance(mode, siteId) {
	if (mode === 'light' || mode === 'dark') return mode;
	return readSiteVisitorAppearance(siteId) ?? systemAppearance();
}
