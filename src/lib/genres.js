/** Max genre labels stored on a track. */
export const MAX_GENRES = 4;

/**
 * Split a stored genre field into individual labels.
 * @param {string | null | undefined} value
 * @returns {string[]}
 */
export function parseGenres(value) {
	if (!value) return [];
	return value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

/**
 * Normalize free-text genre input to a comma-separated field value.
 * Dedupes case-insensitively, keeping the first spelling of each label.
 * Caps at {@link MAX_GENRES}.
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizeGenreField(value) {
	const parts = parseGenres(value);
	if (parts.length === 0) return null;

	/** @type {Set<string>} */
	const seen = new Set();
	/** @type {string[]} */
	const out = [];
	for (const part of parts) {
		const key = part.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(part);
		if (out.length >= MAX_GENRES) break;
	}
	return out.join(', ');
}
