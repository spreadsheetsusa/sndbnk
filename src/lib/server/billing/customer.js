import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { profile, user } from '#lib/server/db/schema';
import { STRIPE_APP_TAG } from './catalog';
import { billingEnabled, getStripe } from './stripe';

/**
 * Reuse the profile's Stripe customer, creating one on first use.
 * @param {string} userId
 * @returns {Promise<{ ok: true, customerId: string } | { ok: false, message: string }>}
 */
export async function ensureStripeCustomer(userId) {
	const rows = await db
		.select({
			username: profile.username,
			stripeCustomerId: profile.stripeCustomerId,
			name: user.name,
			email: user.email
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(eq(profile.userId, userId))
		.limit(1);

	const row = rows[0];
	if (!row) return { ok: false, message: 'We could not find your profile.' };
	if (row.stripeCustomerId) return { ok: true, customerId: row.stripeCustomerId };

	const customer = await getStripe().customers.create({
		email: row.email,
		name: row.name,
		metadata: { app: STRIPE_APP_TAG, userId, username: row.username }
	});

	await db
		.update(profile)
		.set({ stripeCustomerId: customer.id, updatedAt: new Date() })
		.where(eq(profile.userId, userId));

	return { ok: true, customerId: customer.id };
}

/**
 * Keep Stripe receipts/invoices on the same address as app sign-in.
 * Fail soft: verification must not fail because Stripe is down.
 * @param {string} userId
 * @param {string} email
 */
export async function syncStripeCustomerEmail(userId, email) {
	if (!billingEnabled) return;

	try {
		const rows = await db
			.select({ stripeCustomerId: profile.stripeCustomerId })
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);

		const customerId = rows[0]?.stripeCustomerId;
		if (!customerId) return;

		await getStripe().customers.update(customerId, { email });
	} catch (error) {
		console.error(
			`[stripe] could not sync customer email for ${userId}:`,
			error instanceof Error ? error.message : error
		);
	}
}
