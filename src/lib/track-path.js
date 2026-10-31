/**
 * Public track detail path: `/{username}/tracks/{slug}/`.
 * Falls back to the legacy UUID URL when slug or username is missing so
 * stale player-queue payloads still resolve (that route 301s).
 *
 * @param {{ username?: string | null, slug?: string | null, id?: string }} track
 * @param {string} [hash]
 */
export function trackPath(track, hash = '') {
	const path =
		track.username && track.slug
			? `/${track.username}/tracks/${track.slug}/`
			: track.id
				? `/tracks/${track.id}`
				: '/';
	if (!hash) return path;
	return `${path}${hash.startsWith('#') ? hash : `#${hash}`}`;
}

/**
 * Track detail (`/{username}/tracks/{slug}/`), not the embed widget.
 * @param {string} pathname
 */
export function isMixDetailPath(pathname) {
	return /^\/[^/]+\/tracks\/[^/]+\/?$/.test(pathname);
}

/**
 * The header player is a second media bar when this page is already the
 * playing mix. Other tracks keep the header bar so playback stays reachable.
 * @param {string} pathname
 * @param {{ username?: string | null, slug?: string | null, id?: string }} track
 */
export function isCurrentMixPage(pathname, track) {
	if (!isMixDetailPath(pathname)) return false;
	const here = pathname.endsWith('/') ? pathname : `${pathname}/`;
	return here === trackPath(track);
}
