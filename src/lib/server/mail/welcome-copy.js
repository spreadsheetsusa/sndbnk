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
 * Hosted-storage label for mail (avoids pulling quota.js → db into previews).
 * @param {number | null | undefined} bytes
 */
function formatHosted(bytes) {
	if (bytes == null) return 'Unlimited hosted';
	const gib = bytes / 1024 ** 3;
	const n = gib >= 10 ? Math.round(gib) : Number(gib.toFixed(1));
	return `${n} GB`;
}

/**
 * One short line for a higher tier — storage + the unlock that matters.
 * @param {{
 *   maxLocalBytes: number | null,
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
	if (plan.maxLocalBytes != null) bits.push(formatHosted(plan.maxLocalBytes));
	if (plan.allowCustomDomain) bits.push('your domain');
	else if (plan.allowSubdomain) bits.push('you.sndbnk.com');
	if (plan.allowRemoveBranding) bits.push('unbranded');
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
					...(current.maxTracks != null ? [`${current.maxTracks} tracks`] : ['Unlimited tracks']),
					...(current.maxLocalBytes != null
						? [`${formatHosted(current.maxLocalBytes)} hosted storage`]
						: [])
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
