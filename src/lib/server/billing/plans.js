import { asc } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { plan } from '#lib/server/db/schema';

/** @typedef {typeof plan.$inferSelect} PlanRow */
/** @typedef {Omit<PlanRow, 'features'> & { features: string[] }} PlanDetail */

const CACHE_MS = 5000;

/** @type {{ rows: PlanDetail[], at: number } | null} */
let cache = null;

/**
 * Entitlements for a plan id that is missing from the table — deny hosting
 * rather than hand out features when the seed has not run.
 * @type {PlanDetail}
 */
const UNKNOWN_PLAN = {
	id: 'free',
	label: 'Free',
	blurb: '',
	features: [],
	maxTracks: null,
	maxLocalBytes: 5 * 1024 * 1024 * 1024,
	allowStorageAdapters: true,
	allowSubdomain: false,
	allowCustomDomain: false,
	allowRemoveBranding: false,
	maxTeamSeats: 0,
	monthlyAmount: 0,
	yearlyAmount: 0,
	currency: 'usd',
	stripeProductId: null,
	stripePriceMonthlyId: null,
	stripePriceYearlyId: null,
	sortOrder: 0,
	active: true,
	createdAt: new Date(0),
	updatedAt: new Date(0)
};

/**
 * @param {PlanRow} row
 * @returns {PlanDetail}
 */
function toDetail(row) {
	let features = [];
	try {
		const parsed = JSON.parse(row.features);
		if (Array.isArray(parsed)) features = parsed.map(String);
	} catch {
		// A hand-edited `features` column should not take the pricing page down.
	}

	return { ...row, features };
}

/**
 * `bun:sqlite` is a synchronous driver, so plan lookups stay synchronous and
 * every existing caller — `buildPublicUrls`, `resolveTenantHost` — is unchanged.
 * @returns {PlanDetail[]}
 */
function readPlans() {
	if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;

	const rows = db.select().from(plan).orderBy(asc(plan.sortOrder)).all().map(toDetail);
	cache = { rows, at: Date.now() };
	return rows;
}

/** Call after any write to the `plan` table so the next read is fresh. */
export function invalidatePlanCache() {
	cache = null;
}

/** Plans offered to new subscribers, cheapest first. */
export function getPlans() {
	return readPlans().filter((row) => row.active);
}

/** Every plan including retired ones, for the admin panel. */
export function getAllPlans() {
	return readPlans();
}

/**
 * @param {string | null | undefined} planId
 * @returns {PlanDetail | null}
 */
export function getPlan(planId) {
	return readPlans().find((row) => row.id === planId) ?? null;
}

/**
 * @param {string | null | undefined} planId
 * @returns {PlanDetail}
 */
export function planOrDefault(planId) {
	return getPlan(planId) ?? getPlan('free') ?? UNKNOWN_PLAN;
}

/**
 * @param {string | null | undefined} planId
 */
export function isPlan(planId) {
	return Boolean(getPlan(planId));
}

/**
 * @param {string | null | undefined} planId
 */
export function canUseSubdomain(planId) {
	return planOrDefault(planId).allowSubdomain;
}

/**
 * @param {string | null | undefined} planId
 */
export function canUseCustomDomain(planId) {
	return planOrDefault(planId).allowCustomDomain;
}

/**
 * @param {string | null | undefined} planId
 */
export function canUseStorageAdapters(planId) {
	return planOrDefault(planId).allowStorageAdapters;
}

/**
 * @param {string | null | undefined} planId
 */
export function canRemoveBranding(planId) {
	return planOrDefault(planId).allowRemoveBranding;
}

/**
 * @param {string | null | undefined} planId
 * @returns {number}
 */
export function getMaxTeamSeats(planId) {
	return planOrDefault(planId).maxTeamSeats;
}

/**
 * @param {string | null | undefined} planId
 */
export function hasTeamSeats(planId) {
	return getMaxTeamSeats(planId) > 0;
}

/**
 * The Stripe price for a plan and interval, or null when the plan is free or
 * `stripe:bootstrap` has not run against this environment yet.
 * @param {string} planId
 * @param {import('#lib/server/db/schema').BillingInterval} interval
 */
export function priceIdFor(planId, interval) {
	const row = getPlan(planId);
	if (!row) return null;
	return (interval === 'year' ? row.stripePriceYearlyId : row.stripePriceMonthlyId) ?? null;
}

/**
 * @param {string} priceId
 * @returns {{ planId: string, interval: import('#lib/server/db/schema').BillingInterval } | null}
 */
export function planForPriceId(priceId) {
	for (const row of readPlans()) {
		if (row.stripePriceMonthlyId === priceId) return { planId: row.id, interval: 'month' };
		if (row.stripePriceYearlyId === priceId) return { planId: row.id, interval: 'year' };
	}
	return null;
}

/** Plans that require a Stripe subscription. */
export function isPaidPlan(planId) {
	const row = getPlan(planId);
	return Boolean(row && (row.monthlyAmount > 0 || row.yearlyAmount > 0));
}
