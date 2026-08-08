/**
 * Cover URL for a track. Prefers a serialized absolute `coverUrl` (SSH public
 * base); otherwise the app proxy. `attempt > 0` appends a cache-bust query.
 *
 * @param {string} trackId
 * @param {number} [attempt=0]
 * @param {string | null} [absoluteUrl]
 * @returns {string}
 */
export function mediaCoverUrl(trackId, attempt = 0, absoluteUrl = null) {
	const base = absoluteUrl?.trim() || `/api/media/${trackId}/cover`;
	if (attempt <= 0) return base;
	const sep = base.includes('?') ? '&' : '?';
	return `${base}${sep}r=${attempt}`;
}
