/**
 * Href values that may reach an `<a href>` (site builder, chrome, CTAs).
 * Rejects `javascript:`, `data:`, protocol-relative `//`, and anything else
 * that is not a same-origin path, http(s), or mailto.
 *
 * @param {unknown} raw
 * @returns {string | null} trimmed safe href, `''` when empty, or `null` if rejected
 */
export function sanitizeHref(raw) {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (!trimmed) return '';

	if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
		if (/[\u0000-\u001f\u007f\\]/.test(trimmed)) return null;
		return trimmed;
	}

	let parsed;
	try {
		parsed = new URL(trimmed);
	} catch {
		return null;
	}

	if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
		return parsed.toString();
	}

	if (parsed.protocol === 'mailto:') {
		const address = decodeURIComponent(parsed.pathname);
		if (!address.includes('@')) return null;
		return parsed.toString();
	}

	return null;
}

/**
 * Empty is allowed (optional CTA). Non-empty values must pass `sanitizeHref`.
 * @param {unknown} raw
 */
export function isSafeHref(raw) {
	if (typeof raw !== 'string') return false;
	if (!raw.trim()) return true;
	return sanitizeHref(raw) !== null;
}

/**
 * True for registry URL keys (`href`, `ctaHref`, `primaryHref`, …).
 * @param {string} key
 */
export function isHrefPropKey(key) {
	return key === 'href' || key.endsWith('Href');
}

/**
 * Walk cloned block props and strip unsafe URL fields (nested list items included).
 * @param {Record<string, unknown>} props
 * @returns {Record<string, unknown>}
 */
export function sanitizeBlockUrlProps(props) {
	sanitizeUrlTree(props);
	return props;
}

/**
 * @param {unknown} value
 */
function sanitizeUrlTree(value) {
	if (Array.isArray(value)) {
		for (const item of value) sanitizeUrlTree(item);
		return;
	}
	if (typeof value !== 'object' || value === null) return;

	const row = /** @type {Record<string, unknown>} */ (value);
	for (const [key, child] of Object.entries(row)) {
		if (isHrefPropKey(key) && typeof child === 'string') {
			row[key] = sanitizeHref(child) ?? '';
			continue;
		}
		sanitizeUrlTree(child);
	}
}
