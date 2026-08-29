import { error } from '@sveltejs/kit';

import { auth } from '#lib/server/auth';
import { getPlans } from '#lib/server/billing/plans';
import { safeRedirect } from '#lib/server/safe-redirect';
import { getSiteStats, listLatestMembers, pickHeroTrack } from '#lib/server/showcase';
import { loadTenantSitePage } from '#lib/server/site-page-public';
import { getProfileByUserId } from '#lib/server/tenant';

export const load = async ({ cookies, locals, url }) => {
	if (locals.tenant) {
		const sitePage = await loadTenantSitePage({ locals, url, path: '/' });
		if (!sitePage) error(404, 'Site page not found');
		return sitePage;
	}

	const authNoticeType = cookies.get('sndbnk-auth-notice');
	let authNotice = null;

	if (authNoticeType) {
		cookies.delete('sndbnk-auth-notice', { path: '/' });

		authNotice =
			authNoticeType === 'account-created'
				? 'Account created. Welcome to SNDBNK.'
				: authNoticeType === 'signed-in'
					? 'Signed in successfully. Welcome back.'
					: null;
	}

	const [stats, heroTrack, latestMembers, profile] = await Promise.all([
		getSiteStats(),
		pickHeroTrack(locals.user),
		listLatestMembers(),
		locals.user ? getProfileByUserId(locals.user.id) : null
	]);

	return {
		mode: /** @type {const} */ ('marketing'),
		user: locals.user ?? null,
		authNotice,
		stats,
		heroTrack,
		latestMembers,
		plans: getPlans().map((tier) => ({
			id: tier.id,
			label: tier.label,
			blurb: tier.blurb,
			features: tier.features,
			monthlyAmount: tier.monthlyAmount,
			sortOrder: tier.sortOrder
		})),
		currentPlanId: profile?.plan ?? null
	};
};

export const actions = {
	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		safeRedirect(303, '/');
	},

	switchAccount: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '').trim();
		if (!userId) {
			safeRedirect(303, '/');
		}

		try {
			await auth.api.switchLinkedAccount({
				body: { userId },
				headers: request.headers
			});
		} catch {
			safeRedirect(303, '/');
		}

		safeRedirect(303, '/');
	}
};
