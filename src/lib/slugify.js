export const MAX_TRACK_SLUG_LENGTH = 80;

/**
 * URL-safe slug from a track title. Empty / symbol-only titles become `track`.
 *
 * @param {string | null | undefined} title
 */
export function slugifyTitle(title) {
	const slug = (title ?? '')
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_TRACK_SLUG_LENGTH)
		.replace(/-+$/g, '');
	return slug || 'track';
}

/**
 * First unused slug among `taken`, suffixing `-2`, `-3`, … on collision.
 *
 * @param {string} base
 * @param {Set<string>} taken
 */
export function uniqueSlug(base, taken) {
	if (!taken.has(base)) return base;
	for (let n = 2; n < 10000; n++) {
		const suffix = `-${n}`;
		const candidate = `${base.slice(0, MAX_TRACK_SLUG_LENGTH - suffix.length)}${suffix}`;
		if (!taken.has(candidate)) return candidate;
	}
	return `${base.slice(0, 71)}-${crypto.randomUUID().slice(0, 8)}`;
}
