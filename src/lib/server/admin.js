import { error } from '@sveltejs/kit';
import { desc, eq, like, or, sql } from 'drizzle-orm';

import { auth } from '#lib/server/auth';
import { priceLookupKey, productPayload, STRIPE_APP_TAG } from '#lib/server/billing/catalog';
import { syncStripeCustomerEmail } from '#lib/server/billing/customer';
import { invalidatePlanCache, planOrDefault } from '#lib/server/billing/plans';
import { billingEnabled, getStripe } from '#lib/server/billing/stripe';
import { db } from '#lib/server/db';
import { plan, profile, track, user } from '#lib/server/db/schema';
import { getStorageAdapter } from '#lib/server/storage';
import { wipeUserLocalMedia } from '#lib/server/storage/local.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The better-auth admin plugin puts the role on the user row, so authorization is
 * a field check rather than a second table.
 * @param {App.Locals} locals
 */
export function requireAdmin(locals) {
	if (!locals.user) error(401, 'Sign in first.');
	if (locals.user.role !== 'admin') error(403, 'Admins only.');
	return locals.user;
}

/** Every tier with its live subscriber count, for the Plans section. */
export async function listPlansWithCounts() {
	const counts = await db
		.select({ plan: profile.plan, total: sql`count(*)`.mapWith(Number) })
		.from(profile)
		.groupBy(profile.plan);

	const byPlan = new Map(counts.map((row) => [row.plan, row.total]));
	const rows = await db.select().from(plan).orderBy(plan.sortOrder);

	return rows.map((row) => ({
		...row,
		features: parseFeatures(row.features),
		subscribers: byPlan.get(row.id) ?? 0
	}));
}

/**
 * @param {string} value
 */
function parseFeatures(value) {
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

/**
 * Update a tier's entitlements and copy. Amount changes are pushed to Stripe as a
 * new Price with the lookup key transferred, so current subscribers keep their rate.
 *
 * @param {string} planId
 * @param {Record<string, string>} input
 * @returns {Promise<{ ok: true, message: string } | { ok: false, message: string }>}
 */
export async function updatePlan(planId, input) {
	const rows = await db.select().from(plan).where(eq(plan.id, planId)).limit(1);
	const existing = rows[0];
	if (!existing) return { ok: false, message: 'No such plan.' };

	const label = input.label?.trim();
	if (!label) return { ok: false, message: 'Label is required.' };

	const maxTracks = optionalInt(input.maxTracks);
	if (maxTracks === 'invalid')
		return { ok: false, message: 'Max tracks must be a whole number or blank for unlimited.' };

	const maxGib = optionalNumber(input.maxLocalGib);
	if (maxGib === 'invalid')
		return { ok: false, message: 'Storage cap must be a number of GB or blank for unlimited.' };

	const monthlyAmount = dollarsToCents(input.monthlyDollars);
	const yearlyAmount = dollarsToCents(input.yearlyDollars);
	if (monthlyAmount === 'invalid' || yearlyAmount === 'invalid') {
		return { ok: false, message: 'Prices must be dollar amounts, like 5 or 4.99.' };
	}

	const features = (input.features ?? '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

	const maxTeamSeats = optionalInt(input.maxTeamSeats);
	if (maxTeamSeats === 'invalid')
		return { ok: false, message: 'Team seats must be a whole number (0 for none).' };

	await db
		.update(plan)
		.set({
			label,
			blurb: input.blurb?.trim() ?? '',
			features: JSON.stringify(features),
			maxTracks,
			maxLocalBytes: maxGib === null ? null : Math.round(maxGib * 1024 ** 3),
			allowStorageAdapters: input.allowStorageAdapters === 'on',
			allowSubdomain: input.allowSubdomain === 'on',
			allowCustomDomain: input.allowCustomDomain === 'on',
			allowRemoveBranding: input.allowRemoveBranding === 'on',
			maxTeamSeats: maxTeamSeats ?? 0,
			monthlyAmount,
			yearlyAmount,
			active: input.active === 'on',
			updatedAt: new Date()
		})
		.where(eq(plan.id, planId));

	invalidatePlanCache();

	const amountsChanged =
		monthlyAmount !== existing.monthlyAmount || yearlyAmount !== existing.yearlyAmount;

	if (!billingEnabled || monthlyAmount === 0) {
		return { ok: true, message: `${label} saved.` };
	}

	if (!amountsChanged && existing.stripePriceMonthlyId && existing.stripePriceYearlyId) {
		return { ok: true, message: `${label} saved.` };
	}

	const synced = await syncPlanToStripe(planId);
	return synced.ok
		? { ok: true, message: `${label} saved and pushed to Stripe.` }
		: { ok: false, message: `${label} saved locally, but Stripe rejected it: ${synced.message}` };
}

/**
 * Create or refresh the tier's Stripe Product and Prices from the local row. Same
 * logic the bootstrap script runs, reachable from the admin panel.
 * @param {string} planId
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function syncPlanToStripe(planId) {
	if (!billingEnabled) return { ok: false, message: 'Billing is not configured.' };

	const rows = await db.select().from(plan).where(eq(plan.id, planId)).limit(1);
	const row = rows[0];
	if (!row) return { ok: false, message: 'No such plan.' };
	if (row.monthlyAmount === 0 && row.yearlyAmount === 0) {
		return { ok: false, message: 'Free plans have no Stripe objects.' };
	}

	const stripe = getStripe();
	const payload = productPayload(row);

	try {
		const product = row.stripeProductId
			? await stripe.products
					.update(row.stripeProductId, {
						name: payload.name,
						description: payload.description,
						metadata: payload.metadata
					})
					.catch(() => null)
			: null;

		const productId =
			product?.id ?? (await stripe.products.create({ ...payload, type: 'service' })).id;

		const monthlyId = await upsertPrice(
			planId,
			'month',
			row.monthlyAmount,
			row.currency,
			productId
		);
		const yearlyId = await upsertPrice(planId, 'year', row.yearlyAmount, row.currency, productId);

		await db
			.update(plan)
			.set({
				stripeProductId: productId,
				stripePriceMonthlyId: monthlyId,
				stripePriceYearlyId: yearlyId,
				updatedAt: new Date()
			})
			.where(eq(plan.id, planId));

		invalidatePlanCache();
		return { ok: true };
	} catch (err) {
		return { ok: false, message: err instanceof Error ? err.message : 'Stripe call failed.' };
	}
}

/**
 * @param {string} planId
 * @param {'month' | 'year'} interval
 * @param {number} amount
 * @param {string} currency
 * @param {string} productId
 */
async function upsertPrice(planId, interval, amount, currency, productId) {
	const stripe = getStripe();
	const lookupKey = priceLookupKey(planId, interval);
	const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
	const existing = found.data[0];

	if (existing && existing.unit_amount === amount && existing.currency === currency) {
		return existing.id;
	}

	const created = await stripe.prices.create({
		product: productId,
		currency,
		unit_amount: amount,
		recurring: { interval },
		lookup_key: lookupKey,
		transfer_lookup_key: Boolean(existing),
		nickname: `SNDBNK ${planId} ${interval === 'year' ? 'yearly' : 'monthly'}`,
		metadata: { app: STRIPE_APP_TAG, plan: planId, interval }
	});

	if (existing) await stripe.prices.update(existing.id, { active: false });
	return created.id;
}

/** Active promotion codes with the coupon they belong to. */
export async function listPromotions() {
	if (!billingEnabled) return [];

	const codes = await getStripe().promotionCodes.list({ limit: 50, expand: ['data.coupon'] });

	return codes.data.map((code) => ({
		id: code.id,
		code: code.code,
		active: code.active,
		timesRedeemed: code.times_redeemed,
		maxRedemptions: code.max_redemptions,
		expiresAt: code.expires_at ? code.expires_at * 1000 : null,
		percentOff: code.coupon.percent_off,
		amountOff: code.coupon.amount_off,
		duration: code.coupon.duration,
		durationInMonths: code.coupon.duration_in_months
	}));
}

/**
 * Create a coupon plus a customer-facing promotion code in one step, since a
 * coupon without a code is not usable at checkout.
 * @param {Record<string, string>} input
 * @returns {Promise<{ ok: true, code: string } | { ok: false, message: string }>}
 */
export async function createPromotion(input) {
	if (!billingEnabled) return { ok: false, message: 'Billing is not configured.' };

	const code = input.code?.trim().toUpperCase();
	if (!code || !/^[A-Z0-9]{3,32}$/.test(code)) {
		return { ok: false, message: 'Codes are 3-32 characters, letters and numbers only.' };
	}

	const percentOff = optionalNumber(input.percentOff);
	const amountOff = dollarsToCents(input.amountOff);
	if (percentOff === 'invalid' || amountOff === 'invalid') {
		return { ok: false, message: 'Enter a valid discount.' };
	}
	if (percentOff === null && amountOff === 0) {
		return { ok: false, message: 'Set either a percentage or a dollar amount off.' };
	}

	const duration =
		input.duration === 'repeating' || input.duration === 'forever' ? input.duration : 'once';
	const months = optionalInt(input.durationInMonths);
	if (duration === 'repeating' && (months === 'invalid' || months === null)) {
		return { ok: false, message: 'Repeating discounts need a number of months.' };
	}

	const maxRedemptions = optionalInt(input.maxRedemptions);
	if (maxRedemptions === 'invalid')
		return { ok: false, message: 'Max redemptions must be a whole number.' };

	try {
		const stripe = getStripe();
		const coupon = await stripe.coupons.create({
			name: `SNDBNK ${code}`,
			duration,
			...(duration === 'repeating' && months !== null ? { duration_in_months: months } : {}),
			...(percentOff !== null
				? { percent_off: percentOff }
				: { amount_off: amountOff, currency: 'usd' }),
			metadata: { app: STRIPE_APP_TAG }
		});

		await stripe.promotionCodes.create({
			coupon: coupon.id,
			code,
			...(maxRedemptions !== null ? { max_redemptions: maxRedemptions } : {}),
			metadata: { app: STRIPE_APP_TAG }
		});

		return { ok: true, code };
	} catch (err) {
		return { ok: false, message: err instanceof Error ? err.message : 'Stripe rejected the code.' };
	}
}

/**
 * Promotion codes cannot be deleted, only deactivated.
 * @param {string} promotionCodeId
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function archivePromotion(promotionCodeId) {
	if (!billingEnabled) return { ok: false, message: 'Billing is not configured.' };

	try {
		await getStripe().promotionCodes.update(promotionCodeId, { active: false });
		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Stripe rejected the change.'
		};
	}
}

/**
 * @param {string} query
 */
export async function searchUsers(query) {
	const term = `%${query.trim()}%`;

	const rows = await db
		.select({
			userId: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			banned: user.banned,
			plan: profile.plan,
			planInterval: profile.planInterval,
			subscriptionStatus: profile.subscriptionStatus,
			username: profile.username,
			createdAt: profile.createdAt,
			trackCount: sql`(select count(*) from ${track} where ${track.userId} = ${user.id})`.mapWith(
				Number
			),
			localBytes: sql`(
				select coalesce(sum(${track.audioBytes} + coalesce(${track.coverBytes}, 0)), 0)
				from ${track}
				where ${track.userId} = ${user.id} and ${track.storageAdapter} = 'local'
			)`.mapWith(Number)
		})
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(
			query.trim()
				? or(like(user.email, term), like(user.name, term), like(profile.username, term))
				: undefined
		)
		.orderBy(desc(profile.createdAt))
		.limit(50);

	return rows.map((row) => {
		const tier = planOrDefault(row.plan);
		return {
			...row,
			createdAt: row.createdAt?.getTime() ?? null,
			planLabel: tier.label,
			maxLocalBytes: tier.maxLocalBytes
		};
	});
}

/**
 * Force-update a user's sign-in email (staff correction). Immediate — no verify link.
 * Keeps Stripe customer email in sync when billing is configured.
 *
 * @param {string} userId
 * @param {string} newEmailRaw
 * @returns {Promise<{ ok: true, email: string } | { ok: false, message: string }>}
 */
export async function updateUserEmailForAdmin(userId, newEmailRaw) {
	if (!userId) return { ok: false, message: 'Pick a user.' };

	const email = newEmailRaw.trim().toLowerCase();
	if (!email) return { ok: false, message: 'Enter an email address.' };
	if (!EMAIL_PATTERN.test(email)) return { ok: false, message: 'Enter a valid email address.' };

	const found = await db
		.select({ id: user.id, email: user.email })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	const current = found[0];
	if (!current) return { ok: false, message: 'No such account.' };

	if (email === current.email.trim().toLowerCase()) {
		return { ok: false, message: 'That is already their sign-in email.' };
	}

	const taken = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
	if (taken[0]) return { ok: false, message: 'Another account already uses that email.' };

	await db
		.update(user)
		.set({ email, emailVerified: true, updatedAt: new Date() })
		.where(eq(user.id, userId));

	await syncStripeCustomerEmail(userId, email);

	return { ok: true, email };
}

/**
 * Permanently remove a user: cancel Stripe, wipe media, then delete the auth row
 * (DB cascades clear owned rows). HTTP `/admin/remove-user` stays disabled.
 *
 * @param {string} actorId
 * @param {string} userId
 * @param {Headers} headers
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function deleteUserForAdmin(actorId, userId, headers) {
	if (!userId) return { ok: false, message: 'Pick a user.' };
	if (userId === actorId) return { ok: false, message: 'You cannot delete yourself.' };

	const found = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
	if (!found[0]) return { ok: false, message: 'No such account.' };

	const profileRows = await db
		.select({ stripeSubscriptionId: profile.stripeSubscriptionId })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);
	const subscriptionId = profileRows[0]?.stripeSubscriptionId;

	if (billingEnabled && subscriptionId) {
		try {
			await getStripe().subscriptions.cancel(subscriptionId);
		} catch (err) {
			console.error(`[admin] could not cancel Stripe subscription for ${userId}:`, err);
		}
	}

	const tracks = await db
		.select({
			folderKey: track.folderKey,
			storageAdapter: track.storageAdapter
		})
		.from(track)
		.where(eq(track.userId, userId));

	for (const row of tracks) {
		try {
			const storage = await getStorageAdapter(
				userId,
				/** @type {'local' | 'ssh'} */ (row.storageAdapter === 'ssh' ? 'ssh' : 'local')
			);
			await storage.delete(row.folderKey);
		} catch {
			// Still remove the account if remote/local cleanup fails.
		}
	}

	try {
		await wipeUserLocalMedia(userId);
	} catch {
		// Orphan local files are preferable to a stuck delete.
	}

	try {
		await auth.api.removeUser({ body: { userId }, headers });
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Could not delete that account.'
		};
	}

	return { ok: true };
}

/**
 * @param {string | undefined} value
 * @returns {number | null | 'invalid'}
 */
function optionalInt(value) {
	if (!value?.trim()) return null;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : 'invalid';
}

/**
 * @param {string | undefined} value
 * @returns {number | null | 'invalid'}
 */
function optionalNumber(value) {
	if (!value?.trim()) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : 'invalid';
}

/**
 * @param {string | undefined} value
 * @returns {number | 'invalid'}
 */
function dollarsToCents(value) {
	if (!value?.trim()) return 0;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return 'invalid';
	return Math.round(parsed * 100);
}
