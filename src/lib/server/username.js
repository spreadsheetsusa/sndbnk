const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

/** Reserved usernames / subdomains that must never be claimable. */
export const RESERVED_USERNAMES = new Set([
	'www',
	'api',
	'admin',
	'app',
	'static',
	'cdn',
	'mail',
	'support',
	'help',
	'status',
	'users',
	'settings',
	'signin',
	'signup',
	'account',
	'auth',
	'login',
	'logout',
	'register',
	'dashboard',
	'billing',
	'stripe',
	'webhook',
	'webhooks',
	'assets',
	'public',
	'private',
	'root',
	'system',
	'sndbnk',
	'null',
	'undefined',
	'favicon',
	'robots',
	'sitemap',
	'library',
	'media'
]);

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeUsername(value) {
	return value.trim().toLowerCase();
}

/**
 * @param {string} value
 * @returns {{ ok: true, username: string } | { ok: false, message: string }}
 */
export function validateUsername(value) {
	const username = normalizeUsername(value);

	if (!username) {
		return { ok: false, message: 'Choose a username.' };
	}

	if (username.length < 3 || username.length > 30) {
		return { ok: false, message: 'Username must be 3–30 characters.' };
	}

	if (!USERNAME_RE.test(username)) {
		return {
			ok: false,
			message: 'Use lowercase letters, numbers, and hyphens. Start and end with a letter or number.'
		};
	}

	if (RESERVED_USERNAMES.has(username)) {
		return { ok: false, message: 'That username is reserved. Try another.' };
	}

	return { ok: true, username };
}
