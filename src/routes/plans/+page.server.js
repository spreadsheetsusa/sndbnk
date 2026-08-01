import { getPlans } from '#lib/server/billing/plans';
import { billingEnabled } from '#lib/server/billing/stripe';
import { getUsage } from '#lib/server/quota';
import { getProfileByUserId } from '#lib/server/tenant';
import { PUBLIC_BASE_DOMAIN } from '$app/env/public';

export const load = async ({ locals }) => {
	const row = locals.user ? await getProfileByUserId(locals.user.id) : null;
	const usage = row ? await getUsage(locals.user.id) : null;

	return {
		billingEnabled,
		baseDomain: PUBLIC_BASE_DOMAIN,
		plans: getPlans().map((tier) => ({
			id: tier.id,
			label: tier.label,
			blurb: tier.blurb,
			features: tier.features,
			monthlyAmount: tier.monthlyAmount,
			yearlyAmount: tier.yearlyAmount,
			purchasable: Boolean(tier.stripePriceMonthlyId && tier.stripePriceYearlyId)
		})),
		account: row
			? {
					username: row.username,
					plan: row.plan,
					planInterval: row.planInterval,
					subscriptionStatus: row.subscriptionStatus,
					hasSubscription: Boolean(row.stripeSubscriptionId),
					trackCount: usage?.trackCount ?? 0
				}
			: null
	};
};
