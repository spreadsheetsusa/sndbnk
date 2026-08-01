/**
 * Mirror the `plan` table into Stripe, then write the resulting ids back.
 *
 * Idempotent, so it is safe to re-run after an amount changes in the admin panel.
 * Run it once per environment (the SNDBNK sandbox, then live) — that is what keeps
 * the two catalogs identical:
 *
 *   STRIPE_SECRET_KEY=rk_test_... bun run stripe:bootstrap
 *
 * Products are matched by `metadata.app=sndbnk` + `metadata.plan`, prices by
 * `lookup_key`. Changing a price creates a new Price and transfers the lookup key
 * across, so existing subscribers keep the amount they signed up at.
 */
import { Database } from 'bun:sqlite';
import Stripe from 'stripe';

import {
	priceLookupKey,
	productPayload,
	STRIPE_APP_TAG
} from '../src/lib/server/billing/catalog.js';

const dbPath = process.env.DATABASE_URL;
if (!dbPath) throw new Error('DATABASE_URL is not set');

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
	throw new Error('STRIPE_SECRET_KEY is not set. Put it in .env.local or pass it inline.');
}

const stripe = new Stripe(apiKey);
const db = new Database(dbPath, { create: false });

const mode = apiKey.includes('_test_') ? 'sandbox/test' : 'LIVE';
console.log(`Bootstrapping Stripe catalog in ${mode} mode against ${dbPath}\n`);

const plans = db
	.query(
		`SELECT id, label, blurb, monthly_amount, yearly_amount, currency, stripe_product_id
		 FROM plan WHERE active = true ORDER BY sort_order`
	)
	.all();

/**
 * @param {string} planId
 */
async function findProduct(planId) {
	const search = await stripe.products.search({
		query: `metadata['app']:'${STRIPE_APP_TAG}' AND metadata['plan']:'${planId}'`,
		limit: 1
	});
	return search.data[0] ?? null;
}

/**
 * @param {string} lookupKey
 */
async function findPrice(lookupKey) {
	const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
	return prices.data[0] ?? null;
}

/**
 * @param {{ id: string, label: string, blurb: string }} plan
 * @param {string | null} knownProductId
 */
async function ensureProduct(plan, knownProductId) {
	const payload = productPayload(plan);

	const existing = knownProductId
		? await stripe.products.retrieve(knownProductId).catch(() => null)
		: await findProduct(plan.id);

	if (existing) {
		await stripe.products.update(existing.id, {
			name: payload.name,
			description: payload.description,
			metadata: payload.metadata
		});
		console.log(`  product ${existing.id} (updated)`);
		return existing.id;
	}

	const created = await stripe.products.create({ ...payload, type: 'service' });
	console.log(`  product ${created.id} (created)`);
	return created.id;
}

/**
 * @param {string} productId
 * @param {string} planId
 * @param {'month' | 'year'} interval
 * @param {number} amount
 * @param {string} currency
 */
async function ensurePrice(productId, planId, interval, amount, currency) {
	const lookupKey = priceLookupKey(planId, interval);
	const existing = await findPrice(lookupKey);

	if (existing && existing.unit_amount === amount && existing.currency === currency) {
		console.log(`  price ${lookupKey} → ${existing.id} (unchanged)`);
		return existing.id;
	}

	// Transferring the lookup key retires the old price for new signups while
	// leaving current subscribers on the amount they agreed to.
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

	if (existing) {
		await stripe.prices.update(existing.id, { active: false });
		console.log(`  price ${lookupKey} → ${created.id} (replaced ${existing.id})`);
	} else {
		console.log(`  price ${lookupKey} → ${created.id} (created)`);
	}

	return created.id;
}

const update = db.prepare(
	`UPDATE plan SET stripe_product_id = ?, stripe_price_monthly_id = ?,
	 stripe_price_yearly_id = ?, updated_at = ? WHERE id = ?`
);

for (const plan of plans) {
	const paid = plan.monthly_amount > 0 || plan.yearly_amount > 0;
	console.log(`${plan.label} (${plan.id})${paid ? '' : ' — free, no Stripe objects'}`);

	if (!paid) {
		update.run(null, null, null, Date.now(), plan.id);
		continue;
	}

	const productId = await ensureProduct(plan, plan.stripe_product_id);
	const monthlyId = await ensurePrice(
		productId,
		plan.id,
		'month',
		plan.monthly_amount,
		plan.currency
	);
	const yearlyId = await ensurePrice(productId, plan.id, 'year', plan.yearly_amount, plan.currency);

	await stripe.products.update(productId, { default_price: monthlyId });
	update.run(productId, monthlyId, yearlyId, Date.now(), plan.id);
	console.log('');
}

console.log('Done. Plan rows now carry their Stripe ids.');
db.close();
