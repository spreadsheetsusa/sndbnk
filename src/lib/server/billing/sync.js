import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { profile } from '#lib/server/db/schema';
import { canUseCustomDomain, canUseSubdomain, planForPriceId } from './plans';

/**
 * Subscription statuses that still grant the paid tier. `past_due` is included
 * deliberately: a failed renewal should trigger dunning mail, not instantly take
 * a creator's custom domain offline mid-billing-cycle.
 */
const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * `current_period_end` moved from the subscription onto its items in the
 * 2025-03-31 API version, so read the item and fall back for older payloads.
 * @param {import('stripe').Stripe.Subscription} subscription
 */
function periodEnd(subscription) {
	const seconds =
		subscription.items?.data?.[0]?.current_period_end ??
		/** @type {{ current_period_end?: number }} */ (subscription).current_period_end;
	return seconds ? new Date(seconds * 1000) : null;
}

/**
 * @param {import('stripe').Stripe.Subscription} subscription
 */
function resolveTier(subscription) {
	for (const item of subscription.items?.data ?? []) {
		const priceId = typeof item.price === 'string' ? item.price : item.price?.id;
		const matched = priceId ? planForPriceId(priceId) : null;
		if (matched) return matched;
	}
	return null;
}

/**
 * Bring a profile's plan in line with a Stripe subscription. Idempotent, so a
 * webhook redelivery or a manual reconcile both land in the same state.
 * @param {import('stripe').Stripe.Subscription} subscription
 * @returns {Promise<{ ok: true, userId: string, plan: string } | { ok: false, message: string }>}
 */
export async function syncSubscription(subscription) {
	const customerId =
		typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
	if (!customerId) return { ok: false, message: 'Subscription has no customer.' };

	const rows = await db
		.select({
			userId: profile.userId,
			plan: profile.plan,
			customDomainStatus: profile.customDomainStatus,
			stripeSubscriptionId: profile.stripeSubscriptionId
		})
		.from(profile)
		.where(eq(profile.stripeCustomerId, customerId))
		.limit(1);

	const row = rows[0];
	if (!row) return { ok: false, message: `No profile for Stripe customer ${customerId}.` };

	const tier = resolveTier(subscription);
	const entitled = ENTITLED_STATUSES.has(subscription.status) && Boolean(tier);
	const nextPlan = entitled && tier ? tier.planId : 'free';

	/** @type {Record<string, unknown>} */
	const patch = {
		plan: nextPlan,
		planInterval: entitled && tier ? tier.interval : null,
		subscriptionStatus: subscription.status,
		stripeSubscriptionId: entitled ? subscription.id : null,
		currentPeriodEnd: periodEnd(subscription),
		cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
		updatedAt: new Date()
	};

	// Losing the entitlement takes the custom domain out of rotation but keeps the
	// hostname and token so re-subscribing only needs a re-verify.
	if (!canUseCustomDomain(nextPlan) && row.customDomainStatus !== 'none') {
		patch.customDomainStatus = 'none';
		patch.customDomainVerifiedAt = null;
	}

	await db.update(profile).set(patch).where(eq(profile.userId, row.userId));

	return { ok: true, userId: row.userId, plan: nextPlan };
}

/**
 * Drop a profile to Free without a subscription object — used by
 * `customer.subscription.deleted` and by the admin panel.
 * @param {string} userId
 * @param {string} [status]
 */
export async function downgradeToFree(userId, status = 'canceled') {
	await db
		.update(profile)
		.set({
			plan: 'free',
			planInterval: null,
			subscriptionStatus: status,
			stripeSubscriptionId: null,
			currentPeriodEnd: null,
			cancelAtPeriodEnd: false,
			customDomainStatus: 'none',
			customDomainVerifiedAt: null,
			updatedAt: new Date()
		})
		.where(eq(profile.userId, userId));
}

/**
 * Whether a plan change strands the creator's current public URLs, so the UI can
 * warn before they confirm.
 * @param {string} fromPlan
 * @param {string} toPlan
 */
export function losesHostingFeatures(fromPlan, toPlan) {
	return (
		(canUseSubdomain(fromPlan) && !canUseSubdomain(toPlan)) ||
		(canUseCustomDomain(fromPlan) && !canUseCustomDomain(toPlan))
	);
}
