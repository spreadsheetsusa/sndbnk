import { eq, inArray } from 'drizzle-orm';

import { PUBLIC_BASE_DOMAIN } from '$app/env/public';
import { ORIGIN } from '$app/env/private';

import { db } from '#lib/server/db';
import { profile, user } from '#lib/server/db/schema';
import { canUseCustomDomain, canUseSubdomain } from '#lib/server/billing/plans';
import { customDomainCandidates, customDomainMatches } from '#lib/server/domain-verify';
import { RESERVED_USERNAMES } from '#lib/server/username';

/**
 * @typedef {{
 *   userId: string,
 *   username: string,
 *   plan: string,
 *   name: string,
 *   customDomain: string | null,
 *   customDomainStatus: string,
 *   hostKind: 'subdomain' | 'custom'
 * }} TenantContext
 */

/**
 * @param {string | null} hostHeader
 * @returns {string}
 */
export function parseHostname(hostHeader) {
	if (!hostHeader) return '';
	return hostHeader.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? '';
}

/**
 * Prefer X-Forwarded-Host when present. Production Bun binds loopback-only
 * (see systemd.service), so only the local reverse proxy can set this header.
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @returns {string}
 */
export function getRequestHostname(event) {
	const forwarded = event.request.headers.get('x-forwarded-host');
	const host = event.request.headers.get('host');
	return parseHostname(forwarded || host || event.url.host);
}

/**
 * On tenant hosts, resources must belong to the tenant creator. Apex is open.
 * @param {{ tenant?: TenantContext | null | undefined }} locals
 * @param {string | null | undefined} ownerUserId
 */
export function isTenantResourceAllowed(locals, ownerUserId) {
	if (!locals.tenant) return true;
	return Boolean(ownerUserId) && locals.tenant.userId === ownerUserId;
}

/**
 * On tenant hosts, profile-scoped APIs may only target the tenant username.
 * @param {{ tenant?: TenantContext | null | undefined }} locals
 * @param {string | null | undefined} username
 */
export function isTenantUsernameAllowed(locals, username) {
	if (!locals.tenant) return true;
	return Boolean(username) && locals.tenant.username === username;
}

/**
 * @param {string} hostname
 * @param {string} [baseDomain]
 * @returns {'apex' | { kind: 'subdomain', username: string } | { kind: 'custom', hostname: string }}
 */
export function classifyHost(hostname, baseDomain = PUBLIC_BASE_DOMAIN) {
	const host = hostname.toLowerCase();
	const base = baseDomain.toLowerCase();

	if (
		!host ||
		host === base ||
		host === `www.${base}` ||
		host === 'localhost' ||
		host === '127.0.0.1'
	) {
		return 'apex';
	}

	if (host.endsWith(`.${base}`)) {
		const sub = host.slice(0, -(base.length + 1));
		if (!sub || sub.includes('.') || RESERVED_USERNAMES.has(sub) || sub === 'www') {
			return 'apex';
		}
		return { kind: 'subdomain', username: sub };
	}

	return { kind: 'custom', hostname: host };
}

const PROFILE_COLUMNS = {
	userId: profile.userId,
	username: profile.username,
	plan: profile.plan,
	bio: profile.bio,
	location: profile.location,
	customDomain: profile.customDomain,
	customDomainStatus: profile.customDomainStatus,
	domainVerifyToken: profile.domainVerifyToken,
	customDomainVerifiedAt: profile.customDomainVerifiedAt,
	stripeCustomerId: profile.stripeCustomerId,
	stripeSubscriptionId: profile.stripeSubscriptionId,
	planInterval: profile.planInterval,
	subscriptionStatus: profile.subscriptionStatus,
	currentPeriodEnd: profile.currentPeriodEnd,
	cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
	createdAt: profile.createdAt,
	updatedAt: profile.updatedAt,
	name: user.name,
	email: user.email,
	image: user.image
};

/**
 * @param {import('drizzle-orm').SQL | undefined} where
 */
async function selectProfile(where) {
	const rows = await db
		.select(PROFILE_COLUMNS)
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(where)
		.limit(1);

	return rows[0] ?? null;
}

/**
 * @param {string} username
 */
export function getProfileByUsername(username) {
	return selectProfile(eq(profile.username, username));
}

/**
 * @param {string} userId
 */
export function getProfileByUserId(userId) {
	return selectProfile(eq(profile.userId, userId));
}

/**
 * @param {string} hostname
 */
export async function getProfileByCustomDomain(hostname) {
	const candidates = customDomainCandidates(hostname);
	if (candidates.length === 0) return null;

	const rows = await db
		.select(PROFILE_COLUMNS)
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(inArray(profile.customDomain, candidates));

	const exact = normalizeHostname(hostname);
	return rows.find((row) => row.customDomain === exact) ?? rows[0] ?? null;
}

/**
 * @param {string} hostname
 */
function normalizeHostname(hostname) {
	return hostname.trim().toLowerCase().replace(/\.$/, '');
}

/**
 * @param {{ username: string, plan?: string | null, customDomain?: string | null, customDomainStatus?: string | null }} profileRow
 */
export function buildPublicUrls(profileRow) {
	const origin = ORIGIN.replace(/\/$/, '');
	const base = PUBLIC_BASE_DOMAIN;
	const protocol = origin.startsWith('https') ? 'https' : 'http';
	const port = (() => {
		try {
			const url = new URL(ORIGIN);
			return url.port ? `:${url.port}` : '';
		} catch {
			return '';
		}
	})();

	const pathUrl = `${origin}/users/${profileRow.username}`;
	const subdomainUrl = canUseSubdomain(profileRow.plan)
		? `${protocol}://${profileRow.username}.${base}${port}`
		: null;
	const customDomainUrl =
		canUseCustomDomain(profileRow.plan) &&
		profileRow.customDomain &&
		profileRow.customDomainStatus === 'active'
			? `${protocol}://${profileRow.customDomain}`
			: null;

	return {
		pathUrl,
		subdomainUrl,
		customDomainUrl,
		cnameTarget: `${profileRow.username}.${base}`
	};
}

/**
 * Resolve tenant host into a rewrite, redirect, or error outcome.
 * @param {string} hostname
 * @returns {Promise<
 *   | { type: 'apex' }
 *   | { type: 'rewrite', tenant: TenantContext, pathname: string }
 *   | { type: 'redirect', location: string }
 *   | { type: 'not_found' }
 * >}
 */
export async function resolveTenantHost(hostname) {
	const classified = classifyHost(hostname);

	if (classified === 'apex') {
		return { type: 'apex' };
	}

	if (classified.kind === 'subdomain') {
		const row = await getProfileByUsername(classified.username);
		if (!row) {
			return { type: 'not_found' };
		}

		if (!canUseSubdomain(row.plan)) {
			return {
				type: 'redirect',
				location: `${ORIGIN.replace(/\/$/, '')}/users/${row.username}`
			};
		}

		return {
			type: 'rewrite',
			tenant: {
				userId: row.userId,
				username: row.username,
				plan: row.plan,
				name: row.name,
				customDomain: row.customDomain,
				customDomainStatus: row.customDomainStatus,
				hostKind: 'subdomain'
			},
			pathname: `/users/${row.username}`
		};
	}

	const row = await getProfileByCustomDomain(classified.hostname);
	if (
		!row ||
		!canUseCustomDomain(row.plan) ||
		row.customDomainStatus !== 'active' ||
		!customDomainMatches(row.customDomain, classified.hostname)
	) {
		return { type: 'not_found' };
	}

	return {
		type: 'rewrite',
		tenant: {
			userId: row.userId,
			username: row.username,
			plan: row.plan,
			name: row.name,
			customDomain: row.customDomain,
			customDomainStatus: row.customDomainStatus,
			hostKind: 'custom'
		},
		pathname: `/users/${row.username}`
	};
}
