import { fail } from '@sveltejs/kit';
import { PUBLIC_TURNSTILE_SITE_KEY } from '$app/env/public';

import { honeypotTripped } from '#lib/server/honeypot';
import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { safeRedirect } from '#lib/server/safe-redirect';
import { createAccount } from '#lib/server/signup';
import { turnstileEnabled, verifyTurnstile } from '#lib/server/turnstile';

export const load = ({ locals }) => {
	if (locals.user) {
		safeRedirect(302, '/');
	}

	return {
		turnstileSiteKey: turnstileEnabled() ? (PUBLIC_TURNSTILE_SITE_KEY ?? null) : null
	};
};

export const actions = {
	default: async (event) => {
		const { request } = event;
		const formData = await request.formData();
		const name = formData.get('name')?.toString() ?? '';
		const username = formData.get('username')?.toString() ?? '';
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const turnstileToken = formData.get('cf-turnstile-response')?.toString() ?? '';

		const echo = {
			name: name.trim(),
			username: username.trim(),
			email: email.trim()
		};

		// Silent success for bots that fill every field — no account created.
		if (honeypotTripped(formData)) {
			safeRedirect(303, '/signin?pending=1');
		}

		const limited = rateLimit(`signup:${clientIp(event)}`, {
			windowMs: 60 * 60 * 1000,
			max: 5
		});
		if (!limited.ok) {
			return fail(429, {
				message: 'Too many signup attempts. Try again later.',
				...echo
			});
		}

		const captcha = await verifyTurnstile({ token: turnstileToken, ip: clientIp(event) });
		if (!captcha.ok) {
			return fail(400, { message: captcha.message, ...echo });
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

		safeRedirect(303, '/signin?pending=1');
	}
};
