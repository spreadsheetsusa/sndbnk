import { error } from '@sveltejs/kit';
import { ORIGIN } from '$app/env/private';

import { auth } from '#lib/server/auth';
import { clearAuthCookies } from '#lib/server/domain-auth';
import { safeRedirect } from '#lib/server/safe-redirect';

export function load({ locals }) {
	if (locals.tenant && locals.tenant.hostKind !== 'custom') {
		error(404, 'Not found');
	}
	safeRedirect(302, '/');
}

export const actions = {
	default: async (event) => {
		if (event.locals.tenant && event.locals.tenant.hostKind !== 'custom') {
			error(404, 'Not found');
		}

		try {
			await auth.api.signOut({ headers: event.request.headers });
		} catch {
			// No session is still a signed-out browser.
		}

		const onCustom = event.locals.tenant?.hostKind === 'custom';
		clearAuthCookies(event, { hostOnly: Boolean(onCustom) });

		if (onCustom) {
			const back = new URL('/', event.url.origin);
			const next = new URL('/auth/network/signout', ORIGIN);
			next.searchParams.set('return', back.toString());
			safeRedirect(303, next.toString());
		}

		safeRedirect(303, '/');
	}
};
