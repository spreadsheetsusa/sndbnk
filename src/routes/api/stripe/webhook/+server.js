import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { STRIPE_WEBHOOK_SECRET } from '$app/env/private';

import { planOrDefault } from '#lib/server/billing/plans';
import { billingEnabled, getStripe } from '#lib/server/billing/stripe';
import { downgradeToFree, syncSubscription } from '#lib/server/billing/sync';
import { db } from '#lib/server/db';
import { profile, stripeEvent, user } from '#lib/server/db/schema';
import {
	sendPaymentFailedMail,
	sendPlanChangedMail,
	sendSubscriptionCanceledMail
} from '#lib/server/mail/templates';

/**
 * Look up the account behind a Stripe customer so notification mail has an
 * address and a name to use.
 * @param {string | null} customerId
 */
async function accountForCustomer(customerId) {
	if (!customerId) return null;

	const rows = await db
		.select({
			userId: profile.userId,
			plan: profile.plan,
			planInterval: profile.planInterval,
			name: user.name,
			email: user.email
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(eq(profile.stripeCustomerId, customerId))
		.limit(1);

	return rows[0] ?? null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function customerIdOf(value) {
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object' && 'id' in value) {
		const id = /** @type {{ id?: unknown }} */ (value).id;
		return typeof id === 'string' ? id : null;
	}
	return null;
}

/** @type {import('./$types').RequestHandler} */
export const POST = async ({ request }) => {
	if (!billingEnabled || !STRIPE_WEBHOOK_SECRET) {
		error(503, 'Billing is not configured on this server.');
	}

	const signature = request.headers.get('stripe-signature');
	if (!signature) error(400, 'Missing stripe-signature header.');

	// The raw body is required for signature verification, so read text before parsing.
	const payload = await request.text();

	/** @type {import('stripe').Stripe.Event} */
	let event;
	try {
		event = await getStripe().webhooks.constructEventAsync(
			payload,
			signature,
			STRIPE_WEBHOOK_SECRET
		);
	} catch (err) {
		error(400, `Signature verification failed: ${err instanceof Error ? err.message : 'unknown'}`);
	}

	// Stripe retries on any non-2xx, so a duplicate id must be an accepted no-op.
	const seen = await db
		.select({ id: stripeEvent.id })
		.from(stripeEvent)
		.where(eq(stripeEvent.id, event.id))
		.limit(1);

	if (seen.length > 0) return json({ received: true, duplicate: true });

	await db.insert(stripeEvent).values({ id: event.id, type: event.type, receivedAt: new Date() });

	try {
		await handleEvent(event);
	} catch (err) {
		// Drop the marker so Stripe's retry gets a real second attempt.
		await db.delete(stripeEvent).where(eq(stripeEvent.id, event.id));
		console.error(`[stripe:${event.type}] ${err instanceof Error ? err.message : err}`);
		error(500, 'Webhook handler failed.');
	}

	return json({ received: true });
};

/**
 * @param {import('stripe').Stripe.Event} event
 */
async function handleEvent(event) {
	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object;
			if (!session.subscription) break;

			const subscriptionId =
				typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
			const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
			const synced = await syncSubscription(subscription);
			if (!synced.ok) break;

			const account = await accountForCustomer(customerIdOf(session.customer));
			if (account) {
				await sendPlanChangedMail({
					to: account.email,
					name: account.name,
					planLabel: planOrDefault(synced.plan).label,
					interval: account.planInterval ?? 'month'
				});
			}
			break;
		}

		case 'customer.subscription.created':
		case 'customer.subscription.updated':
		case 'customer.subscription.resumed':
		case 'customer.subscription.paused':
			await syncSubscription(event.data.object);
			break;

		case 'customer.subscription.deleted': {
			const subscription = event.data.object;
			const account = await accountForCustomer(customerIdOf(subscription.customer));
			if (!account) break;

			await downgradeToFree(account.userId);
			await sendSubscriptionCanceledMail({ to: account.email, name: account.name });
			break;
		}

		case 'invoice.payment_failed': {
			const account = await accountForCustomer(customerIdOf(event.data.object.customer));
			if (!account) break;

			await sendPaymentFailedMail({
				to: account.email,
				name: account.name,
				planLabel: planOrDefault(account.plan).label
			});
			break;
		}

		default:
			break;
	}
}
