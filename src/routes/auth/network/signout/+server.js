import { error } from '@sveltejs/kit';

import { auth } from '#lib/server/auth';
import { apexHostname, clearAuthCookies, isActiveCustomDomain } from '#lib/server/domain-auth';
import { safeRedirect } from '#lib/server/safe-redirect';

/** Apex only. Clear the platform session cookie and return to the custom domain. */
export async function GET(event) {
	if (event.locals.tenant) {
		error(404, 'Not found');
	}

	try {
		await auth.api.signOut({ headers: event.request.headers });
	} catch {
		// The custom domain already revoked the session. Still drop the cookie.
	}
	clearAuthCookies(event, { hostOnly: false });

	const raw = event.url.searchParams.get('return');
	if (!raw) safeRedirect(303, '/');

	let url;
	try {
		url = new URL(raw);
	} catch {
		safeRedirect(303, '/');
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') safeRedirect(303, '/');
	if (url.hostname.toLowerCase() === apexHostname()) {
		safeRedirect(303, `${url.pathname}${url.search}`);
	}
	if (await isActiveCustomDomain(url.hostname)) {
		safeRedirect(303, url.toString(), [url.hostname]);
	}
	safeRedirect(303, '/');
}
