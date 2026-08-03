/**
 * In-memory sliding-window rate limiter. Fine for a single Bun process;
 * resets on restart (fail-open after process recycle is acceptable).
 */

/** @type {Map<string, number[]>} */
const buckets = new Map();

const MAX_KEYS = 10_000;

/**
 * @param {string} key
 * @param {{ windowMs: number, max: number }} opts
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
export function rateLimit(key, { windowMs, max }) {
	const now = Date.now();
	const cutoff = now - windowMs;
	const prev = buckets.get(key) ?? [];
	const recent = prev.filter((ts) => ts > cutoff);

	if (recent.length >= max) {
		buckets.set(key, recent);
		const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
		return { ok: false, retryAfterSec };
	}

	recent.push(now);
	buckets.set(key, recent);

	if (buckets.size > MAX_KEYS) {
		// Drop oldest half of keys (insertion order) under pressure.
		const drop = Math.floor(MAX_KEYS / 2);
		let i = 0;
		for (const k of buckets.keys()) {
			buckets.delete(k);
			if (++i >= drop) break;
		}
	}

	return { ok: true };
}

/**
 * Client IP for rate-limit keys. Prefer proxy headers set by Caddy.
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
export function clientIp(event) {
	const forwarded =
		event.request.headers.get('x-real-ip') ||
		event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	if (forwarded) return forwarded;
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown';
	}
}
