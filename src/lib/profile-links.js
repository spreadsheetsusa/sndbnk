/**
 * Shared link preset metadata. Imported by both the settings editor and the
 * public profile, so this module must stay free of server-only imports.
 */

/** @typedef {{ id: string, label: string, icon: string, urlPrefix?: string, urlPlaceholder?: string }} LinkPreset */

export const CUSTOM_LINK_ID = 'custom';

/** @type {LinkPreset[]} */
export const LINK_PRESETS = [
	{ id: 'website', label: 'Website', icon: 'world', urlPrefix: 'https://' },
	{
		id: 'soundcloud',
		label: 'SoundCloud',
		icon: 'brand-soundcloud',
		urlPrefix: 'https://soundcloud.com/'
	},
	{
		id: 'spotify',
		label: 'Spotify',
		icon: 'brand-spotify',
		urlPrefix: 'https://open.spotify.com/artist/'
	},
	{
		id: 'bandcamp',
		label: 'Bandcamp',
		icon: 'brand-bandcamp',
		urlPlaceholder: 'https://yourname.bandcamp.com'
	},
	{
		id: 'apple-music',
		label: 'Apple Music',
		icon: 'brand-apple',
		urlPrefix: 'https://music.apple.com/'
	},
	{
		id: 'youtube',
		label: 'YouTube',
		icon: 'brand-youtube',
		urlPrefix: 'https://www.youtube.com/@'
	},
	{
		id: 'instagram',
		label: 'Instagram',
		icon: 'brand-instagram',
		urlPrefix: 'https://www.instagram.com/'
	},
	{
		id: 'tiktok',
		label: 'TikTok',
		icon: 'brand-tiktok',
		urlPrefix: 'https://www.tiktok.com/@'
	},
	{
		id: 'bluesky',
		label: 'Bluesky',
		icon: 'brand-bluesky',
		urlPrefix: 'https://bsky.app/profile/'
	},
	{
		id: 'mastodon',
		label: 'Mastodon',
		icon: 'brand-mastodon',
		urlPlaceholder: 'https://mastodon.social/@you'
	},
	{ id: 'x', label: 'X', icon: 'brand-x', urlPrefix: 'https://x.com/' },
	{
		id: 'patreon',
		label: 'Patreon',
		icon: 'brand-patreon',
		urlPrefix: 'https://www.patreon.com/'
	}
];

export const MAX_PROFILE_LINKS = 10;
export const MAX_LINK_LABEL_LENGTH = 40;
export const MAX_LINK_URL_LENGTH = 500;

/**
 * Base URL injected when a preset is chosen so the user only types the tail.
 * @param {string} presetId
 * @returns {string}
 */
export function urlPrefixForPreset(presetId) {
	if (presetId === CUSTOM_LINK_ID) return '';
	return LINK_PRESETS.find((preset) => preset.id === presetId)?.urlPrefix ?? '';
}

/**
 * @param {string} presetId
 * @returns {string}
 */
export function urlPlaceholderForPreset(presetId) {
	if (presetId === CUSTOM_LINK_ID) return 'https://example.com';
	const preset = LINK_PRESETS.find((entry) => entry.id === presetId);
	if (!preset) return 'https://example.com';
	return preset.urlPlaceholder ?? preset.urlPrefix ?? 'https://example.com';
}

/**
 * True when the field is empty or still only a stub prefix from a preset —
 * safe to replace when the type changes.
 * @param {string} url
 * @returns {boolean}
 */
export function isBareUrlPrefix(url) {
	const trimmed = url.trim();
	if (!trimmed) return true;
	const withoutSlash = trimmed.replace(/\/$/, '');
	return LINK_PRESETS.some((preset) => {
		const prefix = preset.urlPrefix;
		if (!prefix) return false;
		return trimmed === prefix || withoutSlash === prefix.replace(/\/$/, '');
	});
}

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
