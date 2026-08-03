import { fail } from '@sveltejs/kit';

import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { safeRedirect } from '#lib/server/safe-redirect';
import { createAccount } from '#lib/server/signup';

export const load = ({ locals }) => {
	if (locals.user) {
		safeRedirect(302, '/');
	}
};

export const actions = {
	default: async (event) => {
		const { cookies, request, url } = event;
		const formData = await request.formData();
		const name = formData.get('name')?.toString() ?? '';
		const username = formData.get('username')?.toString() ?? '';
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		const limited = rateLimit(`signup:${clientIp(event)}`, {
			windowMs: 60 * 60 * 1000,
			max: 10
		});
		if (!limited.ok) {
			return fail(429, {
				message: 'Too many signup attempts. Try again later.',
				name: name.trim(),
				username: username.trim(),
				email: email.trim()
			});
		}

		const result = await createAccount({
			name,
			username,
			email,
			password,
			headers: request.headers
		});

		if (!result.ok) {
			return fail(400, {
				message: result.message,
				name: name.trim(),
				username: username.trim(),
				email: email.trim()
			});
		}

		cookies.set('sndbnk-auth-notice', 'account-created', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60
		});

		safeRedirect(303, '/');
	}
};
