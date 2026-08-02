import { applyCheckoutSession } from '#lib/server/billing/checkout';
import { planOrDefault } from '#lib/server/billing/plans';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = async ({ locals, url }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const sessionId = url.searchParams.get('session_id');
	if (!sessionId) {
		return { status: 'missing', planLabel: null, message: 'No checkout session to confirm.' };
	}

	// The webhook is the authority, but it may not have landed yet — reading the
	// session here means this page is never stale on arrival.
	const applied = await applyCheckoutSession(sessionId);

	if (!applied.ok) {
		return { status: 'pending', planLabel: null, message: applied.message };
	}

	return {
		status: applied.plan === 'free' ? 'pending' : 'active',
		planLabel: planOrDefault(applied.plan).label,
		message: null
	};
};
