import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';

import { auth } from '#lib/server/auth';
import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { safeRedirect } from '#lib/server/safe-redirect';
import { resolveSignInEmail } from '#lib/server/signin';

export const load = ({ locals, url }) => {
	if (locals.user) {
		safeRedirect(302, '/');
	}

	return { passwordReset: url.searchParams.get('reset') === '1' };
};

export const actions = {
	default: async (event) => {
		const { cookies, request, url } = event;
		const formData = await request.formData();
		const identifier =
			formData.get('identifier')?.toString().trim() ||
			formData.get('email')?.toString().trim() ||
			'';
		const password = formData.get('password')?.toString() ?? '';

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

		try {
			await auth.api.signInEmail({
				body: { email, password },
				headers: request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'We could not sign you in.', identifier });
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

		safeRedirect(303, '/');
	}
};
