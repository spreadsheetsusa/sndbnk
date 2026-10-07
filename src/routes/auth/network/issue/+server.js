import { error } from '@sveltejs/kit';

import {
	apexHostname,
	createHandoff,
	customDomainAuthTarget,
	sessionCookiesFromRequest
} from '#lib/server/domain-auth';
import { safeRedirect } from '#lib/server/safe-redirect';

/**
 * Apex only. If this browser already has a SNDBNK session, copy it onto the
 * custom domain. Otherwise send them back to the branded sign-in form.
 */
export async function GET(event) {
	if (event.locals.tenant) {
		error(404, 'Not found');
	}

	const ret = await customReturn(event.url.searchParams.get('return'));
	const fallback = await customReturn(event.url.searchParams.get('fallback'));
	if (!ret || !fallback || ret.hostname !== fallback.hostname) {
		error(400, 'This sign-in link expired. Try again.');
	}

	const target = await customDomainAuthTarget(ret.hostname);
	if (!target) {
		error(404, 'Not found');
	}

	const cookies = event.locals.user ? sessionCookiesFromRequest(event) : [];
	if (cookies.length === 0) {
		fallback.searchParams.set('bridged', '1');
		safeRedirect(302, fallback.toString(), [fallback.hostname]);
	}

	const code = await createHandoff({
		destHost: ret.hostname.toLowerCase(),
		returnUrl: ret.toString(),
		cookies
	});
	const redeem = new URL('/auth/network', ret.origin);
	redeem.searchParams.set('code', code);
	safeRedirect(302, redeem.toString(), [ret.hostname]);
}

/**
 * @param {string | null} raw
 */
async function customReturn(raw) {
	if (!raw) return null;
	let url;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	if (url.username || url.password) return null;
	if (url.hostname.toLowerCase() === apexHostname()) return null;
	return url;
}
