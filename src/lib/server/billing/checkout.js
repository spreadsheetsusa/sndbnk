import { eq } from 'drizzle-orm';

import { ORIGIN } from '$app/env/private';

import { db } from '#lib/server/db';
import { profile } from '#lib/server/db/schema';
import { isBillingInterval, STRIPE_APP_TAG } from './catalog';
import { ensureStripeCustomer } from './customer';
import { getPlan, isPaidPlan, priceIdFor } from './plans';
import { billingEnabled, getStripe } from './stripe';
import { syncSubscription } from './sync';

const RETURN_URL = `${ORIGIN.replace(/\/$/, '')}/billing/return?session_id={CHECKOUT_SESSION_ID}`;

/**
 * Open an inline subscription checkout. `ui_mode: 'elements'` keeps subscription
 * lifecycle, proration, and promotion codes on Stripe's side while the form stays
 * ours, styled through the Appearance API.
 *
 * @param {{ userId: string, planId: string, interval: string }} input
 * @returns {Promise<{ ok: true, clientSecret: string } | { ok: false, message: string }>}
 */
export async function createSubscriptionCheckout({ userId, planId, interval }) {
	if (!billingEnabled) {
		return { ok: false, message: 'Billing is not configured on this server.' };
	}

	if (!isBillingInterval(interval)) {
		return { ok: false, message: 'Choose monthly or yearly billing.' };
	}

	const tier = getPlan(planId);
	if (!tier || !tier.active) return { ok: false, message: 'That plan is not available.' };
	if (!isPaidPlan(planId))
		return { ok: false, message: `${tier.label} is free — no payment needed.` };

	const priceId = priceIdFor(planId, interval);
	if (!priceId) {
		return {
			ok: false,
			message: `${tier.label} has no ${interval}ly price yet. Run \`bun run stripe:bootstrap\`.`
		};
	}

	const customer = await ensureStripeCustomer(userId);
	if (!customer.ok) return customer;

	try {
		// `allow_promotion_codes` is what lets the client call `actions.applyPromotionCode`,
		// so codes are entered and validated inline rather than round-tripped through us.
		const session = await getStripe().checkout.sessions.create({
			ui_mode: 'elements',
			mode: 'subscription',
			customer: customer.customerId,
			line_items: [{ price: priceId, quantity: 1 }],
			allow_promotion_codes: true,
			return_url: RETURN_URL,
			metadata: { app: STRIPE_APP_TAG, userId, plan: planId, interval },
			subscription_data: { metadata: { app: STRIPE_APP_TAG, userId, plan: planId } }
		});

		if (!session.client_secret) {
			return { ok: false, message: 'Stripe did not return a client secret.' };
		}
		return { ok: true, clientSecret: session.client_secret };
	} catch (error) {
		return { ok: false, message: stripeMessage(error, 'We could not start checkout.') };
	}
}

/**
 * Read a completed Checkout Session and apply its subscription immediately, so
 * the return page is correct even if the webhook has not landed yet.
 * @param {string} sessionId
 * @returns {Promise<{ ok: true, plan: string } | { ok: false, message: string }>}
 */
export async function applyCheckoutSession(sessionId) {
	if (!billingEnabled) return { ok: false, message: 'Billing is not configured.' };

	try {
		const session = await getStripe().checkout.sessions.retrieve(sessionId, {
			expand: ['subscription']
		});

		const subscription = session.subscription;
		if (!subscription || typeof subscription === 'string') {
			return { ok: false, message: 'That checkout has no subscription yet.' };
		}

		const synced = await syncSubscription(subscription);
		if (!synced.ok) return synced;
		return { ok: true, plan: synced.plan };
	} catch (error) {
		return { ok: false, message: stripeMessage(error, 'We could not read that checkout.') };
	}
}

/**
 * Move an existing subscription to a different tier or interval, prorated.
 * @param {string} userId
 * @param {string} planId
 * @param {string} interval
 * @returns {Promise<{ ok: true, plan: string } | { ok: false, message: string }>}
 */
export async function changeSubscription(userId, planId, interval) {
	if (!billingEnabled) return { ok: false, message: 'Billing is not configured.' };
	if (!isBillingInterval(interval))
		return { ok: false, message: 'Choose monthly or yearly billing.' };

	const priceId = priceIdFor(planId, interval);
	if (!priceId) return { ok: false, message: 'That plan has no price configured.' };

	const rows = await db
		.select({ stripeSubscriptionId: profile.stripeSubscriptionId })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	const subscriptionId = rows[0]?.stripeSubscriptionId;
	if (!subscriptionId) return { ok: false, message: 'You do not have an active subscription.' };

	try {
		const stripe = getStripe();
		const current = await stripe.subscriptions.retrieve(subscriptionId);
		const itemId = current.items.data[0]?.id;
		if (!itemId) return { ok: false, message: 'That subscription has no billable item.' };

		const updated = await stripe.subscriptions.update(subscriptionId, {
			items: [{ id: itemId, price: priceId }],
			proration_behavior: 'create_prorations'
		});

		const synced = await syncSubscription(updated);
		if (!synced.ok) return synced;
		return { ok: true, plan: synced.plan };
	} catch (error) {
		return { ok: false, message: stripeMessage(error, 'We could not change your plan.') };
	}
}

/**
 * @param {unknown} error
 * @param {string} fallback
 */
export function stripeMessage(error, fallback) {
	if (error && typeof error === 'object' && 'message' in error) {
		const message = /** @type {{ message?: unknown }} */ (error).message;
		if (typeof message === 'string' && message) return message;
	}
	return fallback;
}
