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
		const name = formData.get('name')?.toString().trim() ?? '';
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!name || !email || !password) {
			return fail(400, { message: 'Complete all fields to continue.', name, email });
		}

		try {
			await auth.api.signUpEmail({
				body: { name, email, password }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					message: error.message || 'We could not create your account.',
					name,
					email
				});
			}
			return fail(500, {
				message: 'Something went wrong. Please try again.',
				name,
				email
			});
		}

		cookies.set('sndbnk-auth-notice', 'account-created', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60
		});

		return redirect(303, '/');
	}
};
