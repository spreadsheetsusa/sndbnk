/**
 * svelte-adapter-bun currently resolves `@sveltejs/kit`'s `#internal` subpath
 * to the browser build during its server Rolldown pass. That makes
 * `redirect()` from `@sveltejs/kit` call `window.location.origin` and throw
 * `ReferenceError: window is not defined` in production.
 *
 * Throw the server Redirect class directly to avoid that validation path.
 */
import { Redirect } from '@sveltejs/kit/internal/server';

import { ORIGIN } from '$app/env/private';

const STRIPE_HOST_SUFFIXES = ['.stripe.com'];

/**
 * @param {string} hostname
 */
function isAllowedRedirectHost(hostname) {
	const host = hostname.toLowerCase();
	try {
		if (host === new URL(ORIGIN).hostname.toLowerCase()) return true;
	} catch {
		// ignore
	}
	return STRIPE_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
}

/**
 * @param {string} location
 */
function assertSafeLocation(location) {
	// Relative path (including protocol-relative rejection).
	if (location.startsWith('/') && !location.startsWith('//')) return;

	let url;
	try {
		url = new URL(location);
	} catch {
		throw new Error(`Refusing unsafe redirect location: ${location}`);
	}

	if (
		(url.protocol === 'https:' || url.protocol === 'http:') &&
		isAllowedRedirectHost(url.hostname)
	) {
		return;
	}

	throw new Error(`Refusing unsafe redirect location: ${location}`);
}

/**
 * @param {300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308} status
 * @param {string | URL} location
 * @returns {never}
 */
export function safeRedirect(status, location) {
	const value = location.toString();
	assertSafeLocation(value);
	throw new Redirect(status, value);
}
