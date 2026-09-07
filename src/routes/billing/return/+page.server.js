import { applyCheckoutSession } from '#lib/server/billing/checkout';
import { canUseCustomDomain, planOrDefault } from '#lib/server/billing/plans';
import { safeRedirect } from '#lib/server/safe-redirect';
import { listNavSites } from '#lib/server/site';
import { getProfileByUserId } from '#lib/server/tenant';

export const load = async ({ locals, url }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const sessionId = url.searchParams.get('session_id');
	if (!sessionId) {
		return {
			status: 'missing',
			plan: null,
			planLabel: null,
			ownsCustomDomain: false,
			siteHref: null,
			message: 'No checkout session to confirm.'
		};
	}

	// The webhook is the authority, but it may not have landed yet — reading the
	// session here means this page is never stale on arrival.
	const applied = await applyCheckoutSession(sessionId);

	if (!applied.ok) {
		return {
			status: 'pending',
			plan: null,
			planLabel: null,
			ownsCustomDomain: false,
			siteHref: null,
			message: applied.message
		};
	}

	const row = await getProfileByUserId(locals.user.id);
	const sites = await listNavSites(row ? { ...row, plan: applied.plan } : null);

	return {
		status: applied.plan === 'free' ? 'pending' : 'active',
		plan: applied.plan,
		planLabel: planOrDefault(applied.plan).label,
		ownsCustomDomain: canUseCustomDomain(applied.plan),
		siteHref: sites.siteId ? `/sites/${sites.siteId}` : null,
		message: null
	};
};
