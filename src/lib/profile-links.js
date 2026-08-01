/**
 * Shared link preset metadata. Imported by both the settings editor and the
 * public profile, so this module must stay free of server-only imports.
 */

/** @typedef {{ id: string, label: string, icon: string }} LinkPreset */

export const CUSTOM_LINK_ID = 'custom';

/** @type {LinkPreset[]} */
export const LINK_PRESETS = [
	{ id: 'website', label: 'Website', icon: 'world' },
	{ id: 'soundcloud', label: 'SoundCloud', icon: 'brand-soundcloud' },
	{ id: 'spotify', label: 'Spotify', icon: 'brand-spotify' },
	{ id: 'bandcamp', label: 'Bandcamp', icon: 'brand-bandcamp' },
	{ id: 'apple-music', label: 'Apple Music', icon: 'brand-apple' },
	{ id: 'youtube', label: 'YouTube', icon: 'brand-youtube' },
	{ id: 'instagram', label: 'Instagram', icon: 'brand-instagram' },
	{ id: 'tiktok', label: 'TikTok', icon: 'brand-tiktok' },
	{ id: 'bluesky', label: 'Bluesky', icon: 'brand-bluesky' },
	{ id: 'mastodon', label: 'Mastodon', icon: 'brand-mastodon' },
	{ id: 'x', label: 'X', icon: 'brand-x' },
	{ id: 'patreon', label: 'Patreon', icon: 'brand-patreon' }
];

export const MAX_PROFILE_LINKS = 10;
export const MAX_LINK_LABEL_LENGTH = 40;
export const MAX_LINK_URL_LENGTH = 500;

/**
 * Labels are stored verbatim, so match presets case-insensitively to pick an icon.
 * @param {string} label
 * @returns {string}
 */
export function iconForLabel(label) {
	const normalized = label.trim().toLowerCase();
	const preset = LINK_PRESETS.find((entry) => entry.label.toLowerCase() === normalized);
	return preset?.icon ?? 'link';
}

/**
 * @param {string} label
 * @returns {boolean}
 */
export function isPresetLabel(label) {
	const normalized = label.trim().toLowerCase();
	return LINK_PRESETS.some((entry) => entry.label.toLowerCase() === normalized);
}

/**
 * Trim a URL down to something readable for display next to its label.
 * @param {string} url
 * @returns {string}
 */
export function displayUrl(url) {
	return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
