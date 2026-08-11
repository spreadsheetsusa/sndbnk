/**
 * Bot trap field name. Real users never see it (CSS + aria-hidden); autofill
 * bots that fill every input trip it.
 */
export const HONEYPOT_FIELD = 'website';

/**
 * @param {FormData | Record<string, unknown>} source
 * @returns {boolean}
 */
export function honeypotTripped(source) {
	const raw =
		typeof source.get === 'function'
			? /** @type {FormData} */ (source).get(HONEYPOT_FIELD)
			: /** @type {Record<string, unknown>} */ (source)[HONEYPOT_FIELD];
	const value = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
	return value.trim().length > 0;
}
