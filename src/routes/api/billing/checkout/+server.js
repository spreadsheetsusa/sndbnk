import { error, json } from '@sveltejs/kit';

import { createSubscriptionCheckout } from '#lib/server/billing/checkout';
import { billingEnabled } from '#lib/server/billing/stripe';
import { createAccount } from '#lib/server/signup';

/**
 * Start an inline subscription. Anonymous callers get an account first: it lands
 * on Free, so a declined card leaves a usable account instead of a dead end.
 *
 * @type {import('./$types').RequestHandler}
 */
export const POST = async ({ locals, request }) => {
	if (!billingEnabled) error(503, 'Billing is not configured on this server.');

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
