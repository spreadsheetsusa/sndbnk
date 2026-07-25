/** @typedef {'basic' | 'premium'} Plan */

/**
 * @param {string | null | undefined} plan
 * @returns {plan is Plan}
 */
export function isPlan(plan) {
	return plan === 'basic' || plan === 'premium';
}

/**
 * @param {string | null | undefined} plan
 */
export function canUseSubdomain(plan) {
	return plan === 'premium';
}

/**
 * @param {string | null | undefined} plan
 */
export function canUseCustomDomain(plan) {
	return plan === 'premium';
}

/**
 * Human-readable plan features for settings UI.
 * @type {Record<Plan, { label: string, summary: string, features: string[] }>}
 */
export const PLAN_DETAILS = {
	basic: {
		label: 'Basic',
		summary: 'A public profile on SNDBNK.',
		features: ['Public profile at sndbnk.com/users/you', 'Email sign-in', 'Account settings']
	},
	premium: {
		label: 'Premium',
		summary: 'Your own subdomain — and a custom domain when you are ready.',
		features: [
			'Everything in Basic',
			'Subdomain at you.sndbnk.com',
			'Custom domain via CNAME',
			'Billing comes later — pick freely for now'
		]
	}
};
