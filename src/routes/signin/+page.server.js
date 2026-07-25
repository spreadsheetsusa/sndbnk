import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';

import { auth } from '#lib/server/auth';

export const load = ({ locals }) => {
	if (locals.user) {
		return redirect(302, '/');
	}
};

export const actions = {
	default: async ({ cookies, request, url }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!email || !password) {
			return fail(400, { message: 'Enter your email and password.', email });
		}

		try {
			await auth.api.signInEmail({
				body: { email, password },
				headers: request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
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

		return redirect(303, '/');
	}
};
