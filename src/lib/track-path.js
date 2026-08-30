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
