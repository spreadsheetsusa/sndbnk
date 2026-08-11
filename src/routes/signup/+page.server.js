import { fail } from '@sveltejs/kit';

import { issueFormGuard, verifyFormGuard } from '#lib/server/form-guard';
import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { safeRedirect } from '#lib/server/safe-redirect';
import { createAccount } from '#lib/server/signup';

export const load = ({ locals }) => {
	if (locals.user) {
		safeRedirect(302, '/');
	}

	return { formGuard: issueFormGuard() };
};

export const actions = {
	default: async (event) => {
		const { cookies, request, url } = event;
		const formData = await request.formData();
		const name = formData.get('name')?.toString() ?? '';
		const username = formData.get('username')?.toString() ?? '';
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		const echo = {
			name: name.trim(),
			username: username.trim(),
			email: email.trim()
		};

		const guard = verifyFormGuard({
			token: formData.get('_fg')?.toString() ?? '',
			honeypot: formData.get('website')?.toString() ?? ''
		});
		if (!guard.ok) {
			return fail(400, {
				message: 'We could not create your account.',
				...echo
			});
		}

		const limited = rateLimit(`signup:${clientIp(event)}`, {
			windowMs: 60 * 60 * 1000,
			max: 10
		});
		if (!limited.ok) {
			return fail(429, {
				message: 'Too many signup attempts. Try again later.',
				...echo
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
				...echo
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
