/**
 * Conventions shared by the app and `scripts/stripe-bootstrap.js`.
 *
 * The `plan` table is the editable source of truth for copy and amounts; Stripe
 * mirrors it. Nothing here duplicates a price — only the naming rules that let
 * the bootstrap script find its own objects again on a later run.
 */

/** Tags every SNDBNK object so it is distinguishable from other products in the account. */
export const STRIPE_APP_TAG = 'sndbnk';

/** @type {import('#lib/server/db/schema').BillingInterval[]} */
export const BILLING_INTERVALS = ['month', 'year'];

/**
 * @param {string | null | undefined} value
 * @returns {value is import('#lib/server/db/schema').BillingInterval}
 */
export function isBillingInterval(value) {
	return value === 'month' || value === 'year';
}

/**
 * Stable handle for a price. Amounts change by creating a new Price and
 * transferring this key, so application code never stores a `price_...` id.
 * @param {string} planId
 * @param {import('#lib/server/db/schema').BillingInterval} interval
 */
export function priceLookupKey(planId, interval) {
	return `${STRIPE_APP_TAG}_${planId}_${interval === 'year' ? 'yearly' : 'monthly'}`;
}

/**
 * @param {{ id: string, label: string, blurb: string }} planRow
 */
export function productPayload(planRow) {
	return {
		name: `SNDBNK ${planRow.label}`,
		description: planRow.blurb,
		statement_descriptor: `SNDBNK ${planRow.label}`.slice(0, 22).toUpperCase(),
		metadata: { app: STRIPE_APP_TAG, plan: planRow.id }
	};
}
