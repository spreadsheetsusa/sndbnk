import { error, json } from '@sveltejs/kit';

import { createSubscriptionCheckout } from '#lib/server/billing/checkout';
import { billingEnabled } from '#lib/server/billing/stripe';
import { verifyFormGuard } from '#lib/server/form-guard';
import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { createAccount } from '#lib/server/signup';

/**
 * Start an inline subscription. Anonymous callers get an account first: it lands
 * on Free, so a declined card leaves a usable account instead of a dead end.
 *
 * @type {import('./$types').RequestHandler}
 */
export const POST = async (event) => {
	const { locals, request, url } = event;
	if (!billingEnabled) error(503, 'Billing is not configured on this server.');
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	/** @type {Record<string, string>} */
	let body;
	try {
		body = await request.json();
	} catch {
		error(400, 'Expected a JSON body.');
	}

	const planId = body.planId ?? '';
	const interval = body.interval ?? '';

	let userId = locals.user?.id;

	if (!userId) {
		const guard = verifyFormGuard({
			token: body._fg ?? '',
			honeypot: body.website ?? ''
		});
		if (!guard.ok) error(400, 'We could not create your account.');

		const limited = rateLimit(`checkout-signup:${clientIp(event)}`, {
			windowMs: 60 * 60 * 1000,
			max: 10
		});
		if (!limited.ok) error(429, 'Too many signup attempts. Try again later.');

		const created = await createAccount({
			name: body.name ?? '',
			username: body.username ?? '',
			email: body.email ?? '',
			password: body.password ?? '',
			headers: request.headers
		});

		if (!created.ok) error(400, created.message);
		userId = created.userId;
	}

	const checkout = await createSubscriptionCheckout({ userId, planId, interval });
	if (!checkout.ok) error(400, checkout.message);

	return json({ clientSecret: checkout.clientSecret, accountCreated: !locals.user });
};
