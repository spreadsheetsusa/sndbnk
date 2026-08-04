/**
 * Stable cover URL for a track. `attempt > 0` appends a cache-bust query so a
 * retry bypasses any sticky 404 from a prior transient miss.
 *
 * @param {string} trackId
 * @param {number} [attempt=0]
 * @returns {string}
 */
export function mediaCoverUrl(trackId, attempt = 0) {
	const base = `/api/media/${trackId}/cover`;
	return attempt > 0 ? `${base}?r=${attempt}` : base;
}
