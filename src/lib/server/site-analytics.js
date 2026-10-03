import { and, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { profile, siteListen, siteStatDay, track, user } from '#lib/server/db/schema';
import { getProfileByUserId } from '#lib/server/tenant';

/** Daily rows and listener rows older than this are deleted on write. */
const RETENTION_DAYS = 400;

const TOP_LIMIT = 8;
const LISTENER_LIMIT = 40;
const MAX_PATH_LENGTH = 180;

const BOT_UA =
	/bot|crawler|spider|slurp|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|slackbot|discordbot|linkedinbot|pinterestbot|petalbot|ahrefs|semrush|bytespider|gptbot|claudebot|amazonbot|bingpreview|applebot|duckduckbot|yandexbot|baiduspider|headlesschrome|chrome-lighthouse|wget\/|curl\//i;

const SKIP_PATH =
	/^\/(?:_app|api|favicon|icons)(?:\/|$)|\/robots\.txt$|\/manifest\.webmanifest$|\/sitemap\.xml$/;

const dayLabel = new Intl.DateTimeFormat('en', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});

/**
 * @param {Date} [date]
 * @returns {string}
 */
function utcDay(date = new Date()) {
	return date.toISOString().slice(0, 10);
}

/**
 * @param {string} day
 * @param {number} delta
 * @returns {string}
 */
function shiftUtcDay(day, delta) {
	const date = new Date(`${day}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + delta);
	return date.toISOString().slice(0, 10);
}

/**
 * @param {number} value
 * @returns {7 | 28 | 90}
 */
export function audienceRange(value) {
	if (value === 7 || value === 90) return value;
	return 28;
}

/**
 * @param {string | null | undefined} ua
 * @returns {boolean}
 */
function isKnownBot(ua) {
	if (!ua) return false;
	return BOT_UA.test(ua);
}

/**
 * Browser prefetch and prerender must not count as a visit.
 * @param {Request} request
 * @returns {boolean}
 */
function isPrefetch(request) {
	const blob = [
		request.headers.get('purpose'),
		request.headers.get('sec-purpose'),
		request.headers.get('x-purpose'),
		request.headers.get('x-moz')
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
	return blob.includes('prefetch') || blob.includes('prerender');
}

/**
 * @param {string} pathname
 * @returns {string | null}
 */
export function normalizePagePath(pathname) {
	if (!pathname || pathname.includes('__data.json') || pathname.includes('://')) return null;
	let path = pathname;
	if (path.length > 1) path = path.replace(/\/+$/, '') || '/';
	if (!path.startsWith('/') || path.includes('..') || path.length > MAX_PATH_LENGTH) return null;
	if (SKIP_PATH.test(path)) return null;
	if (
		/\.(?:js|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|txt|xml|json|webmanifest)$/i.test(path)
	) {
		return null;
	}
	return path;
}

/**
 * External referrer hostname, or `''` for Direct (missing, same site, or www pair).
 * @param {string | null} header
 * @param {string} requestHost
 * @returns {string}
 */
function referrerHost(header, requestHost) {
	if (!header) return '';
	let host = '';
	try {
		host = new URL(header).host.toLowerCase();
	} catch {
		return '';
	}
	const here = requestHost.toLowerCase();
	if (host === here || host === `www.${here}` || `www.${host}` === here) return '';
	const bare = host.replace(/^www\./, '');
	return bare.slice(0, 253);
}

/**
 * @param {string} siteUserId
 * @param {string} day
 * @param {import('#lib/server/db/schema').SiteStatKind} kind
 * @param {string} key
 * @param {number} views
 * @param {number} plays
 */
async function upsertStat(siteUserId, day, kind, key, views, plays) {
	await db
		.insert(siteStatDay)
		.values({ siteUserId, day, kind, key, views, plays })
		.onConflictDoUpdate({
			target: [siteStatDay.siteUserId, siteStatDay.day, siteStatDay.kind, siteStatDay.key],
			set: {
				views: sql`${siteStatDay.views} + ${views}`,
				plays: sql`${siteStatDay.plays} + ${plays}`
			}
		});
}

/**
 * @param {string} siteUserId
 */
async function pruneSiteAudience(siteUserId) {
	const cutoff = shiftUtcDay(utcDay(), -RETENTION_DAYS);
	await db
		.delete(siteStatDay)
		.where(and(eq(siteStatDay.siteUserId, siteUserId), lt(siteStatDay.day, cutoff)));
	await db
		.delete(siteListen)
		.where(
			and(
				eq(siteListen.siteUserId, siteUserId),
				lt(siteListen.lastPlayedAt, new Date(`${cutoff}T00:00:00.000Z`))
			)
		);
}

/**
 * @param {string} siteUserId
 */
async function pruneQuiet(siteUserId) {
	try {
		await pruneSiteAudience(siteUserId);
	} catch (error) {
		console.error('[site-analytics] prune', error);
	}
}

/**
 * @param {string} siteUserId
 * @param {string} path
 * @param {string | null} referrer `null` skips the referrer bucket (in-site navigation).
 */
async function recordPageLoad(siteUserId, path, referrer) {
	const day = utcDay();
	await upsertStat(siteUserId, day, 'page', path, 1, 0);
	await upsertStat(siteUserId, day, 'total', '', 1, 0);
	if (referrer !== null) await upsertStat(siteUserId, day, 'referrer', referrer, 1, 0);
	await pruneQuiet(siteUserId);
}

/**
 * Count one HTML document load on an active custom domain.
 * Skips the owner, known crawlers, prefetch, and non-pages. Never throws.
 *
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @param {Response} response
 */
export async function recordDocumentView(event, response) {
	try {
		if (event.request.method !== 'GET') return;
		const tenant = event.locals.tenant;
		if (!tenant || tenant.hostKind !== 'custom') return;
		if (event.locals.user?.id === tenant.userId) return;
		if (response.status !== 200) return;
		const type = response.headers.get('content-type') ?? '';
		if (!type.includes('text/html')) return;
		if (isPrefetch(event.request) || isKnownBot(event.request.headers.get('user-agent'))) return;
		const dest = event.request.headers.get('sec-fetch-dest');
		if (dest && dest !== 'document') return;
		const path = normalizePagePath(event.url.pathname);
		if (!path) return;
		await recordPageLoad(
			tenant.userId,
			path,
			referrerHost(event.request.headers.get('referer'), event.url.host)
		);
	} catch (error) {
		console.error('[site-analytics] page view', error);
	}
}

/**
 * Count a later page in the same visit. Does not record a referrer.
 *
 * @param {string} siteUserId
 * @param {string} path
 * @returns {Promise<{ ok: true } | { ok: false }>}
 */
export async function recordNavigationView(siteUserId, path) {
	const normalized = normalizePagePath(path);
	if (!normalized) return { ok: false };
	await recordPageLoad(siteUserId, normalized, null);
	return { ok: true };
}

/**
 * True when this beacon should be ignored (owner, bot, prefetch).
 * @param {Request} request
 * @param {string | null | undefined} userId
 * @param {string} siteUserId
 * @returns {boolean}
 */
export function skipNavigationView(request, userId, siteUserId) {
	if (userId === siteUserId) return true;
	if (isPrefetch(request) || isKnownBot(request.headers.get('user-agent'))) return true;
	return false;
}

/**
 * Count a qualified play that happened on the custom domain.
 * Apex and feed plays stay on `track.playCount` only. The owner's session is ignored.
 *
 * @param {{ siteUserId: string, trackId: string, listenerUserId?: string | null }} input
 */
export async function recordSitePlay({ siteUserId, trackId, listenerUserId = null }) {
	if (!siteUserId || !trackId) return;
	if (listenerUserId && listenerUserId === siteUserId) return;

	const day = utcDay();
	const now = new Date();
	await upsertStat(siteUserId, day, 'track', trackId, 0, 1);
	await upsertStat(siteUserId, day, 'total', '', 0, 1);

	if (listenerUserId) {
		await db
			.insert(siteListen)
			.values({
				siteUserId,
				listenerUserId,
				trackId,
				playCount: 1,
				lastPlayedAt: now
			})
			.onConflictDoUpdate({
				target: [siteListen.siteUserId, siteListen.listenerUserId, siteListen.trackId],
				set: {
					lastPlayedAt: now,
					playCount: sql`${siteListen.playCount} + 1`
				}
			});
	}

	await pruneQuiet(siteUserId);
}

/**
 * @param {Array<{ kind: string, key: string, views: number, plays: number }>} rows
 * @param {string} kind
 * @param {'views' | 'plays'} field
 */
function topCounts(rows, kind, field) {
	/** @type {Map<string, number>} */
	const totals = new Map();
	for (const row of rows) {
		if (row.kind !== kind) continue;
		totals.set(row.key, (totals.get(row.key) ?? 0) + row[field]);
	}
	return [...totals.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, TOP_LIMIT);
}

/**
 * @param {string} userId
 * @param {number} days
 */
export async function getSiteAudience(userId, days) {
	const range = audienceRange(days);
	const owner = await getProfileByUserId(userId);
	const domain = owner?.customDomain ?? null;
	const domainActive = owner?.customDomainStatus === 'active' && Boolean(domain);
	const until = utcDay();
	const since = shiftUtcDay(until, -(range - 1));

	/** @type {{ day: string, label: string, pageLoads: number, plays: number }[]} */
	const emptySeries = [];
	if (!domainActive || !owner) {
		return {
			domainActive: false,
			domain,
			days: range,
			pageLoads: 0,
			plays: 0,
			series: emptySeries,
			topPages: [],
			topTracks: [],
			topReferrers: [],
			listeners: []
		};
	}

	const rows = await db
		.select({
			day: siteStatDay.day,
			kind: siteStatDay.kind,
			key: siteStatDay.key,
			views: siteStatDay.views,
			plays: siteStatDay.plays
		})
		.from(siteStatDay)
		.where(
			and(
				eq(siteStatDay.siteUserId, userId),
				gte(siteStatDay.day, since),
				lte(siteStatDay.day, until)
			)
		);

	/** @type {Map<string, { views: number, plays: number }>} */
	const byDay = new Map();
	for (const row of rows) {
		if (row.kind !== 'total') continue;
		byDay.set(row.day, { views: row.views, plays: row.plays });
	}

	/** @type {{ day: string, label: string, pageLoads: number, plays: number }[]} */
	const series = [];
	for (
		let day = since, guard = 0;
		day <= until && guard < 120;
		day = shiftUtcDay(day, 1), guard += 1
	) {
		const bucket = byDay.get(day);
		series.push({
			day,
			label: dayLabel.format(new Date(`${day}T00:00:00.000Z`)),
			pageLoads: bucket?.views ?? 0,
			plays: bucket?.plays ?? 0
		});
	}

	const pageLoads = series.reduce((sum, point) => sum + point.pageLoads, 0);
	const plays = series.reduce((sum, point) => sum + point.plays, 0);

	const topPages = topCounts(rows, 'page', 'views').map(([path, views]) => ({
		path,
		label: path === '/' ? 'Home' : path,
		views
	}));

	const topReferrers = topCounts(rows, 'referrer', 'views').map(([host, views]) => ({
		host: host || 'Direct',
		views
	}));

	const rankedTracks = topCounts(rows, 'track', 'plays');
	const trackIds = rankedTracks.map(([id]) => id).filter(Boolean);
	const trackRows = trackIds.length
		? await db
				.select({
					id: track.id,
					title: track.title,
					artist: track.artist,
					slug: track.slug
				})
				.from(track)
				.where(inArray(track.id, trackIds))
		: [];
	const trackById = new Map(trackRows.map((row) => [row.id, row]));
	const topTracks = rankedTracks.map(([id, trackPlays]) => {
		const row = trackById.get(id);
		return {
			title: row?.title ?? 'Removed track',
			artist: row?.artist ?? null,
			href: row?.slug ? `/${owner.username}/tracks/${row.slug}/` : null,
			plays: trackPlays
		};
	});

	const listenerRows = await db
		.select({
			username: profile.username,
			trackTitle: track.title,
			trackSlug: track.slug,
			playCount: siteListen.playCount,
			lastPlayedAt: siteListen.lastPlayedAt
		})
		.from(siteListen)
		.innerJoin(user, eq(user.id, siteListen.listenerUserId))
		.innerJoin(profile, eq(profile.userId, siteListen.listenerUserId))
		.innerJoin(track, eq(track.id, siteListen.trackId))
		.where(
			and(
				eq(siteListen.siteUserId, userId),
				gte(siteListen.lastPlayedAt, new Date(`${since}T00:00:00.000Z`))
			)
		)
		.orderBy(desc(siteListen.lastPlayedAt))
		.limit(LISTENER_LIMIT);

	const listeners = listenerRows.map((row) => ({
		username: row.username,
		trackTitle: row.trackTitle,
		href: row.trackSlug ? `/${owner.username}/tracks/${row.trackSlug}/` : null,
		playCount: row.playCount,
		lastPlayedAt:
			row.lastPlayedAt instanceof Date ? row.lastPlayedAt.getTime() : Number(row.lastPlayedAt)
	}));

	return {
		domainActive: true,
		domain,
		days: range,
		pageLoads,
		plays,
		series,
		topPages,
		topTracks,
		topReferrers,
		listeners
	};
}
