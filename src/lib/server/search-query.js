export const SEARCH_QUERY_MAX = 80;

/**
 * Trim, cap, and drop empty input for free-text listing filters.
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizeSearchQuery(value) {
	const raw = value?.toString().trim() ?? '';
	if (!raw) return null;
	return raw.slice(0, SEARCH_QUERY_MAX);
}

/**
 * Build a SQL LIKE pattern; strip user wildcards so `%` / `_` are not magic.
 * @param {string} query already normalized
 * @returns {string | null}
 */
export function likePattern(query) {
	const safe = query.replace(/[%_]/g, '');
	if (!safe) return null;
	return `%${safe}%`;
}
