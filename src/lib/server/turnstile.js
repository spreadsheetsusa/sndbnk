import { TURNSTILE_SECRET_KEY } from '$app/env/private';
import { PUBLIC_TURNSTILE_SITE_KEY } from '$app/env/public';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * True when both Turnstile keys are configured. Without them (typical local
 * `.env`), signup skips the challenge so the app still boots.
 */
export function turnstileEnabled() {
	return Boolean(TURNSTILE_SECRET_KEY && PUBLIC_TURNSTILE_SITE_KEY);
}

/**
 * Verify a Cloudflare Turnstile token. When Turnstile is not configured, returns
 * ok so local/dev signup keeps working.
 *
 * @param {{ token: string, ip?: string | null }} input
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function verifyTurnstile({ token, ip }) {
	if (!turnstileEnabled()) return { ok: true };

	const response = token?.trim() ?? '';
	if (!response) {
		return { ok: false, message: 'Please complete the security check and try again.' };
	}

	/** @type {Record<string, string>} */
	const body = {
		secret: TURNSTILE_SECRET_KEY,
		response
	};
	if (ip && ip !== 'unknown') body.remoteip = ip;

	let data;
	try {
		const res = await fetch(SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(body)
		});
		data = await res.json();
	} catch {
		return { ok: false, message: 'Security check unavailable. Please try again in a moment.' };
	}

	if (!data?.success) {
		return { ok: false, message: 'Security check failed. Please try again.' };
	}

	return { ok: true };
}
