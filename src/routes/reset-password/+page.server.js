import { fail } from '@sveltejs/kit';

import { resetPasswordWithToken } from '#lib/server/forgot-password';
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
	default: async ({ request }) => {
		const formData = await request.formData();
		const token = formData.get('token')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

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
