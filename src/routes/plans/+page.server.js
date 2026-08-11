import { getPlans } from '#lib/server/billing/plans';
import { billingEnabled } from '#lib/server/billing/stripe';
import { issueFormGuard } from '#lib/server/form-guard';
import { getUsage } from '#lib/server/quota';
import { getProfileByUserId } from '#lib/server/tenant';
import { PUBLIC_BASE_DOMAIN } from '$app/env/public';

export const load = async ({ locals, url }) => {
	const row = locals.user ? await getProfileByUserId(locals.user.id) : null;
	const usage = row ? await getUsage(locals.user.id) : null;
	const plans = getPlans().map((tier) => ({
		id: tier.id,
		label: tier.label,
		blurb: tier.blurb,
		features: tier.features,
		monthlyAmount: tier.monthlyAmount,
		yearlyAmount: tier.yearlyAmount,
		purchasable: Boolean(tier.stripePriceMonthlyId && tier.stripePriceYearlyId)
	}));
	const requested = url.searchParams.get('plan');
	const preselectPlan = plans.some((tier) => tier.id === requested) ? requested : null;

	return {
		billingEnabled,
		baseDomain: PUBLIC_BASE_DOMAIN,
		plans,
		preselectPlan,
		formGuard: row ? null : issueFormGuard(),
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
