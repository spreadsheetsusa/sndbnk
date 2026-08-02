import { fail } from '@sveltejs/kit';

import { requestPasswordResetEmail } from '#lib/server/forgot-password';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = ({ locals }) => {
	if (locals.user) {
		safeRedirect(302, '/');
	}
};

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString() ?? '';

		const result = await requestPasswordResetEmail({
			emailRaw: email,
			headers: request.headers
		});

		if (!result.ok) {
			return fail(400, { message: result.message, email: result.email });
		}

		return { success: true, message: result.message, email: result.email };
	}
};
