/**
 * svelte-adapter-bun currently resolves `@sveltejs/kit`'s `#internal` subpath
 * to the browser build during its server Rolldown pass. That makes
 * `redirect()` from `@sveltejs/kit` call `window.location.origin` and throw
 * `ReferenceError: window is not defined` in production.
 *
 * Throw the server Redirect class directly to avoid that validation path.
 */
import { Redirect } from '@sveltejs/kit/internal/server';

/**
 * @param {300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308} status
 * @param {string | URL} location
 * @returns {never}
 */
export function safeRedirect(status, location) {
	throw new Redirect(status, location.toString());
}
