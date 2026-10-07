import { and, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { ORIGIN } from '$app/env/private';
import { PUBLIC_BASE_DOMAIN } from '$app/env/public';

import { customDomainCandidates, customDomainMatches } from '#lib/server/domain-verify';
import { db } from '#lib/server/db';
import { authHandoff, profile, site, siteAccount, user } from '#lib/server/db/schema';
import { getSitePublic } from '#lib/server/site';
import { classifyHost, getRequestHostname } from '#lib/server/tenant';

const HANDOFF_TTL_MS = 90_000;
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const isLocalBase = PUBLIC_BASE_DOMAIN === 'localhost' || PUBLIC_BASE_DOMAIN === '127.0.0.1';

/**
 * @typedef {{ name: string, value: string, maxAge: number }} AuthCookie
 * @typedef {{ siteId: string, name: string, logoUrl: string | null }} DomainAuthBrand
 */

/**
 * Relative in-app path. Rejects protocol-relative and off-site values.
 * @param {string | null | undefined} value
 */
export function safeNextPath(value) {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return '/';
	}
	if (value.length > 512) return '/';
	return value;
}

/**
 * Apex pages keep the platform auth UI. Other hosts are hidden unless this
 * custom domain has opted into visitor accounts.
 * @param {App.Locals} locals
 * @returns {Promise<
 *   { kind: 'apex' } | { kind: 'hidden' } | { kind: 'domain', brand: DomainAuthBrand }
 * >}
 */
export async function domainAuthBrand(locals) {
	if (!locals.tenant) return { kind: 'apex' };
	if (locals.tenant.hostKind !== 'custom') return { kind: 'hidden' };

	const row = await getSitePublic(locals.tenant.userId);
	if (!row?.allowDomainAuth || !row.id) return { kind: 'hidden' };

	return {
		kind: 'domain',
		brand: {
			siteId: row.id,
			name: row.name || locals.tenant.name || locals.tenant.username,
			logoUrl: row.logoUrl ?? null
		}
	};
}

/**
 * Where to send a custom-domain sign-in page so an existing apex session can
 * be copied over. Falls through to the branded form when the apex has none.
 * @param {URL} requestUrl
 * @param {string | null | undefined} nextPath
 */
export function domainSignInBridgeLocation(requestUrl, nextPath) {
	const next = safeNextPath(nextPath);
	const ret = new URL(next, requestUrl.origin);
	const fallback = new URL('/signin', requestUrl.origin);
	if (next !== '/') fallback.searchParams.set('next', next);
	const issue = new URL('/auth/network/issue', ORIGIN);
	issue.searchParams.set('return', ret.toString());
	issue.searchParams.set('fallback', fallback.toString());
	return issue.toString();
}

/**
 * Origin of an active custom domain, for better-auth's origin check.
 * @param {Request | undefined} request
 * @returns {Promise<string | null>}
 */
export async function activeCustomDomainOrigin(request) {
	const raw = request?.headers?.get('origin');
	if (!raw) return null;

	let url;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}

	const host = url.hostname.toLowerCase();
	const classified = classifyHost(host);
	if (classified === 'apex' || classified.kind !== 'custom') return null;
	if (!(await isActiveCustomDomain(host))) return null;
	return url.origin;
}

/**
 * @param {string} hostname
 */
export async function isActiveCustomDomain(hostname) {
	const candidates = customDomainCandidates(hostname);
	if (candidates.length === 0) return false;

	const rows = await db
		.select({
			customDomain: profile.customDomain,
			customDomainStatus: profile.customDomainStatus
		})
		.from(profile)
		.where(inArray(profile.customDomain, candidates))
		.limit(4);

	return rows.some(
		(row) =>
			row.customDomainStatus === 'active' &&
			row.customDomain &&
			customDomainMatches(row.customDomain, hostname)
	);
}

/**
 * Custom domain that currently allows visitor accounts, or null.
 * @param {string} hostname
 * @returns {Promise<{ userId: string, siteId: string } | null>}
 */
export async function customDomainAuthTarget(hostname) {
	const candidates = customDomainCandidates(hostname);
	if (candidates.length === 0) return null;

	const rows = await db
		.select({
			userId: profile.userId,
			customDomain: profile.customDomain,
			customDomainStatus: profile.customDomainStatus
		})
		.from(profile)
		.where(inArray(profile.customDomain, candidates))
		.limit(4);

	const match = rows.find(
		(row) =>
			row.customDomainStatus === 'active' &&
			row.customDomain &&
			customDomainMatches(row.customDomain, hostname)
	);
	if (!match) return null;

	const sites = await db
		.select({ id: site.id, allowDomainAuth: site.allowDomainAuth })
		.from(site)
		.where(eq(site.userId, match.userId))
		.limit(1);
	const row = sites[0];
	if (!row?.allowDomainAuth) return null;
	return { userId: match.userId, siteId: row.id };
}

/**
 * @param {Headers} headers
 * @returns {AuthCookie[]}
 */
export function sessionCookiesFromHeaders(headers) {
	const fromList = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
	const lines =
		fromList.length > 0 ? fromList : splitSetCookieHeader(headers.get('set-cookie') ?? '');
	/** @type {AuthCookie[]} */
	const cookies = [];
	for (const line of lines) {
		const cookie = readSetCookieLine(line);
		if (!cookie || cookie.maxAge <= 0) continue;
		if (!isAuthCookieName(cookie.name)) continue;
		cookies.push(cookie);
	}
	return cookies;
}

/**
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @returns {AuthCookie[]}
 */
export function sessionCookiesFromRequest(event) {
	const header = event.request.headers.get('cookie') ?? '';
	/** @type {AuthCookie[]} */
	const cookies = [];
	for (const part of header.split(';')) {
		const trimmed = part.trim();
		const eqAt = trimmed.indexOf('=');
		if (eqAt < 1) continue;
		const name = trimmed.slice(0, eqAt);
		if (!isAuthCookieName(name)) continue;
		let value = trimmed.slice(eqAt + 1);
		try {
			value = decodeURIComponent(value);
		} catch {
			// keep the raw value
		}
		cookies.push({ name, value, maxAge: SESSION_MAX_AGE });
	}
	return cookies;
}

/**
 * @param {string} name
 */
function isAuthCookieName(name) {
	return name.includes('better-auth');
}

/**
 * Headers#get joins multiple Set-Cookie lines with commas. Split only when the
 * next segment looks like another cookie name.
 * @param {string} header
 * @returns {string[]}
 */
function splitSetCookieHeader(header) {
	if (!header) return [];
	/** @type {string[]} */
	const lines = [];
	let start = 0;
	for (let i = 0; i < header.length; i += 1) {
		if (header[i] !== ',') continue;
		let j = i + 1;
		while (header[j] === ' ') j += 1;
		let k = j;
		while (k < header.length && header[k] !== '=' && header[k] !== ';' && header[k] !== ',') k += 1;
		if (header[k] !== '=') continue;
		const part = header.slice(start, i).trim();
		if (part) lines.push(part);
		start = j;
		i = j;
	}
	const last = header.slice(start).trim();
	if (last) lines.push(last);
	return lines;
}

/**
 * @param {string} line
 * @returns {AuthCookie | null}
 */
function readSetCookieLine(line) {
	const parts = line.split(';').map((part) => part.trim());
	const pair = parts[0] ?? '';
	const eqAt = pair.indexOf('=');
	if (eqAt < 1) return null;
	const name = pair.slice(0, eqAt);
	let value = pair.slice(eqAt + 1);
	if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
	try {
		value = decodeURIComponent(value);
	} catch {
		// keep
	}
	let maxAge = SESSION_MAX_AGE;
	for (const part of parts.slice(1)) {
		const [key, raw] = part.split('=');
		if (key?.toLowerCase() === 'max-age') maxAge = Number(raw ?? '0');
	}
	if (!name || !Number.isFinite(maxAge)) return null;
	return { name, value, maxAge };
}

/**
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @param {AuthCookie[]} cookies
 * @param {{ hostOnly: boolean }} options
 */
export function writeAuthCookies(event, cookies, { hostOnly }) {
	const secure = event.url.protocol === 'https:';
	for (const cookie of cookies) {
		event.cookies.set(cookie.name, cookie.value, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure,
			maxAge: cookie.maxAge,
			...(hostOnly || isLocalBase ? {} : { domain: PUBLIC_BASE_DOMAIN })
		});
	}
}

/**
 * Drop whatever auth cookies arrived on this request.
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @param {{ hostOnly: boolean }} options
 */
export function clearAuthCookies(event, { hostOnly }) {
	const secure = event.url.protocol === 'https:';
	const names = sessionCookiesFromRequest(event).map((cookie) => cookie.name);
	for (const name of names) {
		const base = {
			path: '/',
			httpOnly: true,
			sameSite: /** @type {'lax'} */ ('lax'),
			secure,
			maxAge: 0
		};
		event.cookies.set(name, '', base);
		if (!hostOnly && !isLocalBase) {
			event.cookies.set(name, '', { ...base, domain: PUBLIC_BASE_DOMAIN });
		}
	}
}

/**
 * Copy a fresh auth response onto this host, then — on a custom domain —
 * bounce through the apex so sndbnk.com receives the same session.
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @param {Headers | null | undefined} authHeaders
 * @param {string} returnPath
 * @returns {Promise<string | null>} absolute handoff URL, or null when this host is enough
 */
export async function establishDomainSession(event, authHeaders, returnPath) {
	const hostOnly = event.locals.tenant?.hostKind === 'custom';
	if (!hostOnly) return null;

	const cookies = authHeaders ? sessionCookiesFromHeaders(authHeaders) : [];
	if (cookies.length === 0) return null;

	writeAuthCookies(event, cookies, { hostOnly: true });

	const next = safeNextPath(returnPath);
	const returnUrl = new URL(next, event.url.origin).toString();
	const code = await createHandoff({
		destHost: apexHostname(),
		returnUrl,
		cookies
	});
	const redeem = new URL('/auth/network', ORIGIN);
	redeem.searchParams.set('code', code);
	return redeem.toString();
}

/**
 * @param {{ destHost: string, returnUrl: string, cookies: AuthCookie[] }} input
 */
export async function createHandoff(input) {
	const now = new Date();
	await db.delete(authHandoff).where(lt(authHandoff.expiresAt, now));

	const id = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
	await db.insert(authHandoff).values({
		id,
		destHost: input.destHost,
		returnUrl: input.returnUrl,
		cookiesJson: JSON.stringify(input.cookies),
		expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS),
		createdAt: now
	});
	return id;
}

/**
 * @param {string} code
 * @returns {Promise<{ destHost: string, returnUrl: string, cookies: AuthCookie[] } | null>}
 */
export async function consumeHandoff(code) {
	if (!code || code.length > 128) return null;
	const now = new Date();
	const rows = await db
		.delete(authHandoff)
		.where(and(eq(authHandoff.id, code), gt(authHandoff.expiresAt, now)))
		.returning();
	const row = rows[0];
	if (!row) return null;

	/** @type {AuthCookie[]} */
	let cookies = [];
	try {
		const parsed = JSON.parse(row.cookiesJson);
		if (Array.isArray(parsed)) {
			cookies = parsed.filter(
				(cookie) =>
					cookie &&
					typeof cookie.name === 'string' &&
					typeof cookie.value === 'string' &&
					isAuthCookieName(cookie.name)
			);
		}
	} catch {
		return null;
	}
	if (cookies.length === 0) return null;
	return { destHost: row.destHost, returnUrl: row.returnUrl, cookies };
}

/**
 * Return target after a handoff cookie is set.
 * The redeemer may land on itself, or the apex may send the browser back to
 * the custom domain that started the sign-in.
 * @param {string} requestHost
 * @param {string} returnUrl
 */
export async function resolveHandoffReturn(requestHost, returnUrl) {
	let url;
	try {
		url = new URL(returnUrl);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	if (url.username || url.password) return null;

	const host = url.hostname.toLowerCase();
	if (host === requestHost) return url;
	if (requestHost === apexHostname() && (await isActiveCustomDomain(host))) return url;
	if (host === apexHostname() && (await isActiveCustomDomain(requestHost))) return url;
	return null;
}

/**
 * @returns {string}
 */
export function apexHostname() {
	return new URL(ORIGIN).hostname.toLowerCase();
}

/**
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
export function requestIsApex(event) {
	return getRequestHostname(event) === apexHostname();
}

/**
 * Accounts created through this site's custom domain.
 * @param {string} siteId
 */
export async function listSiteAccounts(siteId) {
	const rows = await db
		.select({
			userId: siteAccount.userId,
			name: user.name,
			email: user.email,
			username: profile.username,
			createdAt: siteAccount.createdAt
		})
		.from(siteAccount)
		.innerJoin(user, eq(user.id, siteAccount.userId))
		.leftJoin(profile, eq(profile.userId, siteAccount.userId))
		.where(eq(siteAccount.siteId, siteId))
		.orderBy(desc(siteAccount.createdAt))
		.limit(100);

	return rows.map((row) => ({
		userId: row.userId,
		name: row.name,
		email: row.email,
		username: row.username ?? null,
		createdAt: row.createdAt.getTime()
	}));
}

/**
 * @param {{ siteId: string, userId: string, hostname: string }} input
 */
export async function recordSiteAccount(input) {
	await db
		.insert(siteAccount)
		.values({
			siteId: input.siteId,
			userId: input.userId,
			hostname: input.hostname,
			createdAt: new Date()
		})
		.onConflictDoNothing();
}
