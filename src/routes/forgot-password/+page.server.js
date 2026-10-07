import { error, fail } from '@sveltejs/kit';

import { domainAuthBrand } from '#lib/server/domain-auth';
import { requestPasswordResetEmail } from '#lib/server/forgot-password';
import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = async ({ locals }) => {
	const brand = await domainAuthBrand(locals);
	if (brand.kind === 'hidden') {
		error(404, 'Not found');
	}
	if (locals.user) {
		safeRedirect(302, '/');
	}
	return { domain: brand.kind === 'domain' ? brand.brand : null };
};

export const actions = {
	default: async (event) => {
		const brand = await domainAuthBrand(event.locals);
		if (brand.kind === 'hidden') {
			error(404, 'Not found');
		}

		const { request } = event;
		const formData = await request.formData();
		const email = formData.get('email')?.toString() ?? '';

		const limited = rateLimit(`forgot:${clientIp(event)}:${email.trim().toLowerCase()}`, {
			windowMs: 60 * 60 * 1000,
			max: 5
		});
		if (!limited.ok) {
			return fail(429, {
				message: 'Too many reset requests. Try again later.',
				email: email.trim()
			});
		}

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
