import { Redirect } from '@sveltejs/kit/internal/server';
import { eq, or, sql } from 'drizzle-orm';

import { canUseCustomDomain } from '#lib/server/billing/plans';
import { plan, profile } from '#lib/server/db/schema';
import { customDomainMatches } from '#lib/server/domain-verify';
import { buildPublicUrls } from '#lib/server/tenant';

/**
 * Studio+ creator with a live custom domain who has not opted into the sndbnk.com pool.
 * @param {{
 *   plan?: string | null,
 *   customDomainStatus?: string | null,
 *   publishToSndbnk?: boolean | null
 * }} row
 */
export function isCatalogDomainExclusive(row) {
	return (
		row.customDomainStatus === 'active' && !row.publishToSndbnk && canUseCustomDomain(row.plan)
	);
}

/**
 * Whose domain-only catalog this request may include.
 * Tenant hosts include that creator. On apex, only the signed-in owner
 * (builder preview and their own paging) — public visitors stay on the pool.
 *
 * @param {{ tenant?: { userId?: string } | null | undefined, user?: { id?: string } | null | undefined }} locals
 * @param {string} subjectUserId
 * @returns {string | null}
 */
export function listingHostOwnerId(locals, subjectUserId) {
	if (locals.tenant) {
		return locals.tenant.userId === subjectUserId ? subjectUserId : null;
	}
	return locals.user?.id === subjectUserId ? subjectUserId : null;
}

/**
 * Tenant host owner. Playlist members use this so an apex view never
 * treats the signed-in user as a reason to surface a domain-only track.
 *
 * @param {{ tenant?: { userId?: string } | null | undefined }} locals
 * @returns {string | null}
 */
export function catalogHostOwnerId(locals) {
	return locals.tenant?.userId ?? null;
}

/**
 * SQL filter for public listings. `owner` is the uploader profile already joined
 * in the query. A domain-only catalog stays visible on that creator's tenant host.
 *
 * @param {typeof profile} owner
 * @param {import('drizzle-orm').SQLWrapper} ownerUserId
 * @param {string | null} [hostOwnerId]
 */
export function visibleOnHostCondition(owner, ownerUserId, hostOwnerId = null) {
	const inPool = sql`NOT (
		coalesce(${owner.customDomainStatus}, '') = 'active'
		AND coalesce(${owner.publishToSndbnk}, 0) = 0
		AND EXISTS (
			SELECT 1 FROM ${plan}
			WHERE ${plan.id} = ${owner.plan}
				AND ${plan.allowCustomDomain} = 1
		)
	)`;
	if (!hostOwnerId) return inPool;
	return or(inPool, eq(ownerUserId, hostOwnerId));
}

/**
 * Apex requests for a domain-only catalog go to the custom domain.
 * Subdomain and custom-domain hosts keep serving that creator.
 *
 * @param {App.Locals} locals
 * @param {{
 *   plan?: string | null,
 *   customDomain?: string | null,
 *   customDomainStatus?: string | null,
 *   publishToSndbnk?: boolean | null,
 *   username: string
 * }} owner
 * @param {string} pathname
 */
export function redirectApexCatalogToDomain(locals, owner, pathname) {
	if (locals.tenant) return;
	if (!isCatalogDomainExclusive(owner)) return;
	const { customDomainUrl } = buildPublicUrls(owner);
	if (!customDomainUrl || !owner.customDomain) return;
	const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
	const location = path === '/' ? `${customDomainUrl}/` : `${customDomainUrl}${path}`;
	let target;
	try {
		target = new URL(location);
	} catch {
		return;
	}
	// safeRedirect only allows the apex and Stripe. This hop is the creator's
	// verified custom domain, checked against the stored hostname.
	if (target.protocol !== 'http:' && target.protocol !== 'https:') return;
	if (!customDomainMatches(owner.customDomain, target.hostname)) return;
	throw new Redirect(302, target.toString());
}
