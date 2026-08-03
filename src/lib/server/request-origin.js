import { ORIGIN } from '$app/env/private';
import { PUBLIC_BASE_DOMAIN } from '$app/env/public';

/**
 * True when the request looks like a same-site call from our own UI
 * (form enhance / fetch), not a cross-site cookie-bearing POST.
 * @param {Request} request
 * @param {URL} url
 */
export function isTrustedMutationRequest(request, url) {
	const fetchSite = request.headers.get('sec-fetch-site');
	if (fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none') {
		return true;
	}

	const origin = request.headers.get('origin');
	if (!origin) {
		// Non-browser clients and older browsers: allow same-host Referer only.
		const referer = request.headers.get('referer');
		if (!referer) return false;
		try {
			return isAllowedOrigin(new URL(referer).origin, url);
		} catch {
			return false;
		}
	}

	return isAllowedOrigin(origin, url);
}

/**
 * First-party origins allowed for media CORS and mutation checks.
 * @param {string} origin
 * @param {URL} [requestUrl]
 */
export function isAllowedOrigin(origin, requestUrl) {
	if (!origin) return false;

	let parsed;
	try {
		parsed = new URL(origin);
	} catch {
		return false;
	}

	const host = parsed.hostname.toLowerCase();
	const base = PUBLIC_BASE_DOMAIN.toLowerCase();

	try {
		if (parsed.origin === new URL(ORIGIN).origin) return true;
	} catch {
		// ignore bad ORIGIN at runtime; other checks still apply
	}

	if (requestUrl && parsed.origin === requestUrl.origin) return true;

	if (host === base || host === `www.${base}`) return true;
	if (base === 'localhost' || base === '127.0.0.1') {
		return host === 'localhost' || host === '127.0.0.1';
	}
	if (host.endsWith(`.${base}`) && !host.slice(0, -(base.length + 1)).includes('.')) {
		return true;
	}

	return false;
}

/**
 * Reflect Origin for media CORS only when it is first-party.
 * @param {Request} request
 * @param {URL} url
 * @returns {string | null}
 */
export function mediaCorsOrigin(request, url) {
	const origin = request.headers.get('origin');
	if (!origin) return url.origin;
	return isAllowedOrigin(origin, url) ? origin : null;
}
