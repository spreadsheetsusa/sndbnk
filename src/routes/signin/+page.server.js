import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';

import { auth } from '#lib/server/auth';
import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = ({ locals, url }) => {
	if (locals.user) {
		safeRedirect(302, '/');
	}

	return {
		passwordReset: url.searchParams.get('reset') === '1',
		emailPending: url.searchParams.get('pending') === '1',
		emailVerifiedNotice: url.searchParams.get('verified') === '1'
	};
};

export const actions = {
	default: async (event) => {
		const { cookies, request, url } = event;
		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!email || !password) {
			return fail(400, { message: 'Enter your email and password.', email });
		}

		const limited = rateLimit(`signin:${clientIp(event)}:${email.toLowerCase()}`, {
			windowMs: 10 * 60 * 1000,
			max: 10
		});
		if (!limited.ok) {
			return fail(429, {
				message: 'Too many sign-in attempts. Try again in a few minutes.',
				email
			});
		}

		try {
			await auth.api.signInEmail({
				body: { email, password, callbackURL: '/' },
				headers: request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				const code =
					/** @type {{ code?: string } | undefined} */ (error.body)?.code ?? error.message;
				if (code === 'EMAIL_NOT_VERIFIED' || /email not verified/i.test(String(error.message))) {
					return fail(403, {
						message:
							'Confirm your email before signing in. Check your inbox for the link, or resend below.',
						email,
						needsVerification: true
					});
				}
				return fail(400, { message: error.message || 'We could not sign you in.', email });
			}
			return fail(500, { message: 'Something went wrong. Please try again.', email });
		}

		cookies.set('sndbnk-auth-notice', 'signed-in', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60
		});

		safeRedirect(303, '/');
	},

	resendVerification: async (event) => {
		const { request } = event;
		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';

		if (!email) {
			return fail(400, { message: 'Enter your email to resend the confirmation link.', email });
		}

		const limited = rateLimit(`verify-resend:${clientIp(event)}:${email.toLowerCase()}`, {
			windowMs: 60 * 60 * 1000,
			max: 5
		});
		if (!limited.ok) {
			return fail(429, {
				message: 'Too many resend attempts. Try again later.',
				email,
				needsVerification: true
			});
		}

		try {
			await auth.api.sendVerificationEmail({
				body: { email, callbackURL: '/?verified=1' },
				headers: request.headers
			});
		} catch {
			// Enumeration-safe: same message whether or not the address exists.
		}

		return {
			resendSuccess: true,
			email,
			needsVerification: true
		};
	}
};
