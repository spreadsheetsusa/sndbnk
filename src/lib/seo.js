/** Default Open Graph share image (served from `static/`). */
export const DEFAULT_OG_IMAGE = '/7eCo0.webp';
export const DEFAULT_OG_IMAGE_WIDTH = 1168;
export const DEFAULT_OG_IMAGE_HEIGHT = 784;

/**
 * Join an origin and path into an absolute URL. Absolute `path` values pass through.
 * @param {string} origin
 * @param {string} path
 */
export function absoluteUrl(origin, path) {
	if (/^https?:\/\//i.test(path)) return path;
	const base = origin.replace(/\/$/, '');
	return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * @param {{ origin: string, description: string, name?: string, logo?: string | null }} input
 */
export function webSiteJsonLd({ origin, description, name = 'SNDBNK', logo = null }) {
	const url = origin.replace(/\/$/, '');
	const logoUrl = absoluteUrl(origin, logo || DEFAULT_OG_IMAGE);
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name,
		url,
		description,
		publisher: {
			'@type': 'Organization',
			name,
			url,
			logo: logoUrl
		}
	};
}

/**
 * @param {{
 *   name: string,
 *   username: string,
 *   url: string,
 *   image?: string | null,
 *   description?: string | null
 * }} input
 */
export function personJsonLd({ name, username, url, image = null, description = null }) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Person',
		name,
		alternateName: `@${username}`,
		url,
		...(image ? { image } : {}),
		...(description ? { description } : {})
	};
}

/**
 * @param {{
 *   name: string,
 *   byArtist: string,
 *   url: string,
 *   image?: string | null,
 *   durationMs?: number | null,
 *   description?: string | null
 * }} input
 */
export function musicRecordingJsonLd({
	name,
	byArtist,
	url,
	image = null,
	durationMs = null,
	description = null
}) {
	return {
		'@context': 'https://schema.org',
		'@type': 'MusicRecording',
		name,
		byArtist: {
			'@type': 'Person',
			name: byArtist
		},
		url,
		...(image ? { image } : {}),
		...(durationMs != null ? { duration: `PT${Math.round(durationMs / 1000)}S` } : {}),
		...(description ? { description } : {})
	};
}

/**
 * @param {{
 *   name: string,
 *   byArtist: string,
 *   url: string,
 *   image?: string | null,
 *   description?: string | null,
 *   numTracks?: number | null
 * }} input
 */
export function musicPlaylistJsonLd({
	name,
	byArtist,
	url,
	image = null,
	description = null,
	numTracks = null
}) {
	return {
		'@context': 'https://schema.org',
		'@type': 'MusicPlaylist',
		name,
		byArtist: {
			'@type': 'Person',
			name: byArtist
		},
		url,
		...(image ? { image } : {}),
		...(description ? { description } : {}),
		...(numTracks != null ? { numTracks } : {})
	};
}

/**
 * Safe JSON-LD payload for embedding in HTML (escapes `<`).
 * @param {Record<string, unknown>} value
 */
export function serializeJsonLd(value) {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}
