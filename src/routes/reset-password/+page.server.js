import { fail } from '@sveltejs/kit';

import { resetPasswordWithToken } from '#lib/server/forgot-password';
import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = ({ locals, url }) => {
	if (locals.user) {
		safeRedirect(302, '/');
	}

	const token = url.searchParams.get('token') ?? '';
	const error = url.searchParams.get('error');

	if (error === 'INVALID_TOKEN' || !token) {
		return { token: '', invalid: true };
	}

	return { token, invalid: false };
};

export const actions = {
	default: async (event) => {
		const { request } = event;
		const formData = await request.formData();
		const token = formData.get('token')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

		const limited = rateLimit(`reset:${clientIp(event)}`, {
			windowMs: 60 * 60 * 1000,
			max: 10
		});
		if (!limited.ok) {
			return fail(429, { message: 'Too many reset attempts. Try again later.', token });
		}

		const result = await resetPasswordWithToken({
			token,
			password,
			confirmPassword,
			headers: request.headers
		});

		if (!result.ok) {
			return fail(400, { message: result.message, token });
		}

		safeRedirect(303, '/signin?reset=1');
	}
};
