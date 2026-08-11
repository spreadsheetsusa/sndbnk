import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { BETTER_AUTH_SECRET } from '$app/env/private';

/** Humans need a moment to fill name/username/email/password; bots POST instantly. */
const MIN_AGE_MS = 1_500;
/** Allow a tab left open through a long read before submit. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * HMAC-sign `payload` with the auth secret.
 * @param {string} payload
 * @returns {string}
 */
function sign(payload) {
	return createHmac('sha256', BETTER_AUTH_SECRET).update(payload).digest('base64url');
}

/**
 * Constant-time compare of two base64url HMAC digests.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
	try {
		const left = Buffer.from(a);
		const right = Buffer.from(b);
		return left.length === right.length && timingSafeEqual(left, right);
	} catch {
		return false;
	}
}

/**
 * Issue a one-shot form token for signup surfaces. Embed as a hidden `_fg` field.
 * @returns {{ token: string }}
 */
export function issueFormGuard() {
	const issuedAtMs = Date.now();
	const nonce = randomBytes(16).toString('base64url');
	const payload = `${issuedAtMs}.${nonce}`;
	return { token: `${payload}.${sign(payload)}` };
}

/**
 * Verify honeypot + signed timing token from a signup POST.
 * Callers should map `{ ok: false }` to a generic user-facing error.
 *
 * @param {{ token?: string | null, honeypot?: string | null }} input
 * @returns {{ ok: true } | { ok: false }}
 */
export function verifyFormGuard({ token, honeypot }) {
	// Bots fill tempting fields like "website"; humans never see it.
	if ((honeypot ?? '').trim() !== '') return { ok: false };

	const raw = (token ?? '').trim();
	const parts = raw.split('.');
	if (parts.length !== 3) return { ok: false };

	const [issuedAtRaw, nonce, mac] = parts;
	if (!issuedAtRaw || !nonce || !mac) return { ok: false };

	const issuedAtMs = Number(issuedAtRaw);
	if (!Number.isFinite(issuedAtMs)) return { ok: false };

	const payload = `${issuedAtRaw}.${nonce}`;
	if (!safeEqual(mac, sign(payload))) return { ok: false };

	const age = Date.now() - issuedAtMs;
	if (age < MIN_AGE_MS || age > MAX_AGE_MS) return { ok: false };

	return { ok: true };
}
