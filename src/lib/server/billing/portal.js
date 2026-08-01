import { eq } from 'drizzle-orm';

import { ORIGIN } from '$app/env/private';

import { db } from '#lib/server/db';
import { profile } from '#lib/server/db/schema';
import { stripeMessage } from './checkout';
import { billingEnabled, getStripe } from './stripe';

/**
 * Hand card updates, interval switches, invoice history, and cancellation to
 * Stripe's Customer Portal rather than rebuilding them.
 * @param {string} userId
 * @returns {Promise<{ ok: true, url: string } | { ok: false, message: string }>}
 */
export async function createPortalSession(userId) {
	if (!billingEnabled) return { ok: false, message: 'Billing is not configured on this server.' };

	const rows = await db
		.select({ stripeCustomerId: profile.stripeCustomerId })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	const customerId = rows[0]?.stripeCustomerId;
	if (!customerId) return { ok: false, message: 'You have no billing history yet.' };

	try {
		const session = await getStripe().billingPortal.sessions.create({
			customer: customerId,
			return_url: `${ORIGIN.replace(/\/$/, '')}/settings?tab=billing`
		});
		return { ok: true, url: session.url };
	} catch (error) {
		return { ok: false, message: stripeMessage(error, 'We could not open the billing portal.') };
	}
}
