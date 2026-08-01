import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import {
	archivePromotion,
	createPromotion,
	listPlansWithCounts,
	listPromotions,
	requireAdmin,
	searchUsers,
	syncPlanToStripe,
	updatePlan
} from '#lib/server/admin';
import { auth } from '#lib/server/auth';
import { isPlan, planOrDefault } from '#lib/server/billing/plans';
import { downgradeToBasic } from '#lib/server/billing/sync';
import { billingEnabled } from '#lib/server/billing/stripe';
import { db } from '#lib/server/db';
import { profile } from '#lib/server/db/schema';

export const load = async ({ locals, url }) => {
	requireAdmin(locals);

	const query = url.searchParams.get('q') ?? '';

	return {
		billingEnabled,
		query,
		plans: (await listPlansWithCounts()).map((row) => ({
			id: row.id,
			label: row.label,
			blurb: row.blurb,
			features: row.features,
			maxTracks: row.maxTracks,
			maxLocalGib: row.maxLocalBytes === null ? null : row.maxLocalBytes / 1024 ** 3,
			allowStorageAdapters: row.allowStorageAdapters,
			allowSubdomain: row.allowSubdomain,
			allowCustomDomain: row.allowCustomDomain,
			monthlyDollars: (row.monthlyAmount / 100).toFixed(2),
			yearlyDollars: (row.yearlyAmount / 100).toFixed(2),
			free: row.monthlyAmount === 0 && row.yearlyAmount === 0,
			active: row.active,
			stripeProductId: row.stripeProductId,
			hasPrices: Boolean(row.stripePriceMonthlyId && row.stripePriceYearlyId),
			subscribers: row.subscribers
		})),
		promotions: await listPromotions(),
		users: await searchUsers(query)
	};
};

export const actions = {
	savePlan: async ({ locals, request }) => {
		requireAdmin(locals);

		const formData = await request.formData();
		const planId = formData.get('planId')?.toString() ?? '';

		const result = await updatePlan(planId, formDataToRecord(formData));
		if (!result.ok) return fail(400, { planMessage: result.message });

		return { planSuccess: result.message };
	},

	syncPlan: async ({ locals, request }) => {
		requireAdmin(locals);

		const formData = await request.formData();
		const planId = formData.get('planId')?.toString() ?? '';

		const result = await syncPlanToStripe(planId);
		if (!result.ok) return fail(400, { planMessage: result.message });

		return { planSuccess: `${planOrDefault(planId).label} is in sync with Stripe.` };
	},

	createPromotion: async ({ locals, request }) => {
		requireAdmin(locals);

		const result = await createPromotion(formDataToRecord(await request.formData()));
		if (!result.ok) return fail(400, { promoMessage: result.message });

		return { promoSuccess: `${result.code} is live.` };
	},

	archivePromotion: async ({ locals, request }) => {
		requireAdmin(locals);

		const formData = await request.formData();
		const id = formData.get('promotionCodeId')?.toString() ?? '';

		const result = await archivePromotion(id);
		if (!result.ok) return fail(400, { promoMessage: result.message });

		return { promoSuccess: 'Code deactivated.' };
	},

	setUserPlan: async ({ locals, request }) => {
		const admin = requireAdmin(locals);

		const formData = await request.formData();
		const userId = formData.get('userId')?.toString() ?? '';
		const planId = formData.get('plan')?.toString() ?? '';

		if (!userId) return fail(400, { userMessage: 'Pick a user.' });
		if (!isPlan(planId)) return fail(400, { userMessage: 'That is not a plan.' });
		if (userId === admin.id && planId === 'basic') {
			return fail(400, { userMessage: 'Downgrade yourself from your own settings, not here.' });
		}

		if (planId === 'basic') {
			await downgradeToBasic(userId, 'canceled');
			return { userSuccess: 'Moved to Basic.' };
		}

		// A comp does not create a Stripe subscription, so it is marked distinctly and
		// the webhook sync will leave it alone.
		await db
			.update(profile)
			.set({ plan: planId, subscriptionStatus: 'grandfathered', updatedAt: new Date() })
			.where(eq(profile.userId, userId));

		return { userSuccess: `Comped to ${planOrDefault(planId).label}.` };
	},

	setUserRole: async ({ locals, request }) => {
		const admin = requireAdmin(locals);

		const formData = await request.formData();
		const userId = formData.get('userId')?.toString() ?? '';
		const role = formData.get('role')?.toString() === 'admin' ? 'admin' : 'user';

		if (userId === admin.id) {
			return fail(400, { userMessage: 'You cannot change your own role.' });
		}

		try {
			await auth.api.setRole({ body: { userId, role }, headers: request.headers });
		} catch (error) {
			return fail(400, {
				userMessage: error instanceof Error ? error.message : 'Could not change that role.'
			});
		}

		return { userSuccess: `Role set to ${role}.` };
	},

	setUserBanned: async ({ locals, request }) => {
		const admin = requireAdmin(locals);

		const formData = await request.formData();
		const userId = formData.get('userId')?.toString() ?? '';
		const banned = formData.get('banned')?.toString() === 'true';
		const reason = formData.get('reason')?.toString().trim();

		if (userId === admin.id) {
			return fail(400, { userMessage: 'You cannot ban yourself.' });
		}

		try {
			if (banned) {
				await auth.api.banUser({
					body: { userId, banReason: reason || 'Violated the terms of service.' },
					headers: request.headers
				});
			} else {
				await auth.api.unbanUser({ body: { userId }, headers: request.headers });
			}
		} catch (error) {
			return fail(400, {
				userMessage: error instanceof Error ? error.message : 'Could not change that account.'
			});
		}

		return { userSuccess: banned ? 'Account banned.' : 'Ban lifted.' };
	}
};

/**
 * @param {FormData} formData
 * @returns {Record<string, string>}
 */
function formDataToRecord(formData) {
	/** @type {Record<string, string>} */
	const record = {};
	for (const [key, value] of formData) {
		if (typeof value === 'string') record[key] = value;
	}
	return record;
}
