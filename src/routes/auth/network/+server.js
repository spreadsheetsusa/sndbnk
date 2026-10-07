import { error } from '@sveltejs/kit';

import { consumeHandoff, resolveHandoffReturn, writeAuthCookies } from '#lib/server/domain-auth';
import { safeRedirect } from '#lib/server/safe-redirect';
import { getRequestHostname } from '#lib/server/tenant';

/** Redeem a one-time code and set this host's session cookie. */
export async function GET(event) {
	const handoff = await consumeHandoff(event.url.searchParams.get('code') ?? '');
	if (!handoff) {
		error(400, 'This sign-in link expired. Try again.');
	}

	const host = getRequestHostname(event);
	if (handoff.destHost !== host) {
		error(400, 'This sign-in link expired. Try again.');
	}

	const returnUrl = await resolveHandoffReturn(host, handoff.returnUrl);
	if (!returnUrl) {
		error(400, 'This sign-in link expired. Try again.');
	}

	writeAuthCookies(event, handoff.cookies, { hostOnly: Boolean(event.locals.tenant) });

	if (returnUrl.hostname.toLowerCase() === host) {
		safeRedirect(303, `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`);
	}
	safeRedirect(303, returnUrl.toString(), [returnUrl.hostname]);
}
