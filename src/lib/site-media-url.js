const MEDIA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public URL for a site-design asset. Empty when the id is not a UUID,
 * so block props cannot inject an arbitrary src.
 * @param {unknown} id
 * @returns {string}
 */
export function siteMediaUrl(id) {
	if (typeof id !== 'string' || !MEDIA_ID.test(id)) return '';
	return `/api/site-media/${id}`;
}
