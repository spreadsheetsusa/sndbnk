import { getPlans, planOrDefault } from '../billing/plans.js';

/**
 * @typedef {{
 *   planId: string,
 *   planLabel: string,
 *   blurb: string,
 *   features: string[],
 *   nextTiers: { label: string, detail: string }[],
 *   plansUrl: string
 * }} WelcomePlanCopy
 */

/**
 * One short line for a higher tier — tracks and the unlock that matters.
 * Hosted GiB stays off the lead; Free already has no hosted-byte cap.
 * @param {{
 *   maxTracks: number | null,
 *   allowCustomDomain: boolean,
 *   allowSubdomain: boolean,
 *   allowRemoveBranding: boolean,
 *   maxTeamSeats: number,
 *   blurb: string
 * }} plan
 */
function tierDetail(plan) {
	/** @type {string[]} */
	const bits = [];
	if (plan.maxTracks == null) bits.push('unlimited tracks');
	else bits.push(`one album (~${plan.maxTracks} tracks)`);
	if (plan.allowCustomDomain) bits.push('your domain');
	else if (plan.allowSubdomain) bits.push('you.sndbnk.com');
	if (plan.allowRemoveBranding) bits.push('chrome off');
	if (plan.maxTeamSeats > 0) bits.push('teams soon');
	return bits.join(' · ') || plan.blurb;
}

/**
 * Plan-aware welcome facts. New accounts are Free; paid signups still start
 * Free then upgrade via Stripe — pass planId so this stays honest if that changes.
 *
 * @param {{ planId?: string | null, origin: string }} input
 * @returns {WelcomePlanCopy}
 */
export function welcomePlanCopy({ planId = 'free', origin }) {
	const current = planOrDefault(planId);
	const nextTiers = getPlans()
		.filter((plan) => plan.sortOrder > current.sortOrder)
		.map((plan) => ({ label: plan.label, detail: tierDetail(plan) }));

	return {
		planId: current.id,
		planLabel: current.label,
		blurb: current.blurb,
		features: current.features.length
			? current.features
			: [
					'Public profile',
					...(current.maxTracks != null
						? [`One album (~${current.maxTracks} tracks)`]
						: ['Unlimited tracks']),
					...(current.allowCustomDomain
						? ['your domain']
						: current.allowSubdomain
							? ['you.sndbnk.com']
							: []),
					...(current.allowRemoveBranding ? ['chrome off'] : [])
				],
		nextTiers,
		plansUrl: `${origin.replace(/\/$/, '')}/plans`
	};
}

/**
 * Plain-text companion for the welcome plan block.
 * @param {WelcomePlanCopy} copy
 */
export function welcomePlanText(copy) {
	const lines = [
		`You're on ${copy.planLabel}.`,
		copy.blurb,
		'',
		'What you have',
		...copy.features.map((item) => `· ${item}`)
	];

	if (copy.nextTiers.length) {
		lines.push('', 'When you want more signal');
		for (const tier of copy.nextTiers) {
			lines.push(`${tier.label} — ${tier.detail}`);
		}
		lines.push('', `Compare plans: ${copy.plansUrl}`);
	}

	return lines.join('\n');
}
