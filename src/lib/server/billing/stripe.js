import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$app/env/private';

/** @type {Stripe | null} */
let client = null;

/** Billing surfaces check this and report a clear error instead of throwing at import time. */
export const billingEnabled = Boolean(STRIPE_SECRET_KEY);

/**
 * @returns {Stripe}
 */
export function getStripe() {
	if (!STRIPE_SECRET_KEY) {
		throw new Error('STRIPE_SECRET_KEY is not set. Add it to .env.local to enable billing.');
	}

	client ??= new Stripe(STRIPE_SECRET_KEY);
	return client;
}
