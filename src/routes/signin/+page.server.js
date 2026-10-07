import { error, fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';

import { auth } from '#lib/server/auth';
import {
	domainAuthBrand,
	domainSignInBridgeLocation,
	establishDomainSession,
	safeNextPath
} from '#lib/server/domain-auth';
import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { safeRedirect } from '#lib/server/safe-redirect';
import { resolveSignInEmail } from '#lib/server/signin';

export const load = async ({ locals, url }) => {
	const brand = await domainAuthBrand(locals);
	if (brand.kind === 'hidden') {
		error(404, 'Not found');
	}

	const next = safeNextPath(url.searchParams.get('next'));
	if (locals.user) {
		safeRedirect(302, brand.kind === 'domain' ? next : '/');
	}

	if (brand.kind === 'domain' && url.searchParams.get('bridged') !== '1') {
		safeRedirect(302, domainSignInBridgeLocation(url, next));
	}

	return {
		passwordReset: url.searchParams.get('reset') === '1',
		domain: brand.kind === 'domain' ? brand.brand : null,
		next
	};
};

export const actions = {
	default: async (event) => {
		const brand = await domainAuthBrand(event.locals);
		if (brand.kind === 'hidden') {
			error(404, 'Not found');
		}

		const { cookies, request, url } = event;
		const formData = await request.formData();
		const identifier =
			formData.get('identifier')?.toString().trim() ||
			formData.get('email')?.toString().trim() ||
			'';
		const password = formData.get('password')?.toString() ?? '';
		const next = safeNextPath(formData.get('next')?.toString() || url.searchParams.get('next'));
		const onDomain = brand.kind === 'domain';

		if (!identifier || !password) {
			return fail(400, { message: 'Enter your email or username and password.', identifier });
		}

		const limited = rateLimit(`signin:${clientIp(event)}:${identifier.toLowerCase()}`, {
			windowMs: 10 * 60 * 1000,
			max: 20
		});
		if (!limited.ok) {
			return fail(429, {
				message: 'Too many sign-in attempts. Try again in a few minutes.',
				identifier
			});
		}

		const email = await resolveSignInEmail(identifier);

		/** @type {{ headers?: Headers } | null} */
		let signedIn = null;
		try {
			signedIn = await auth.api.signInEmail({
				body: { email, password },
				headers: request.headers,
				returnHeaders: true
			});
		} catch (authError) {
			if (authError instanceof APIError) {
				return fail(400, { message: authError.message || 'We could not sign you in.', identifier });
			}
			return fail(500, { message: 'Something went wrong. Please try again.', identifier });
		}

		cookies.set('sndbnk-auth-notice', 'signed-in', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60
		});

		if (onDomain) {
			const location = await establishDomainSession(event, signedIn?.headers, next);
			if (!location) {
				return fail(500, {
					message: 'Signed in, but the session could not be saved. Try again.',
					identifier
				});
			}
			safeRedirect(303, location);
		}

		safeRedirect(303, '/');
	}
};
