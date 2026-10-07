import { ORIGIN } from '$app/env/private';

import { EMBED_PLAYER_HEIGHT, EMBED_PLAYER_WIDTH } from '#lib/embed-player.js';
import { customDomainMatches } from '#lib/server/domain-verify';
import { isCatalogDomainExclusive } from '#lib/server/platform-pool';
import {
	buildPublicUrls,
	classifyHost,
	getProfileByUserId,
	isTenantResourceAllowed
} from '#lib/server/tenant';
import {
	canViewTrack,
	ensureTrackSlug,
	getTrackByUsernameAndSlug,
	getTrackWithUploader
} from '#lib/server/tracks';
import { normalizeUsername } from '#lib/server/username';
import { trackPath } from '#lib/track-path.js';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TRACK_PATH_RE = /^\/([^/]+)\/tracks\/([^/]+?)(?:\/embed)?\/?$/;
const LEGACY_PATH_RE = /^\/tracks\/([A-Za-z0-9-]{8,80})\/?$/;

/**
 * @typedef {{
 *   track: import('#lib/server/db/schema').track.$inferSelect,
 *   username: string | null,
 *   uploaderName: string | null
 * }} TrackRow
 */

/**
 * @param {string} hostname
 * @param {string} requestHost
 */
function hostMayQuery(hostname, requestHost) {
	const host = hostname.toLowerCase().replace(/\.$/, '');
	const here = requestHost.toLowerCase().replace(/\.$/, '');
	if (host === here) return true;
	const classified = classifyHost(host);
	if (classified === 'apex') return true;
	return typeof classified === 'object' && classified.kind === 'subdomain';
}

/**
 * Origin that can play this track. Domain-exclusive catalogs leave the apex,
 * and a foreign subdomain must not host another artist's widget.
 *
 * @param {NonNullable<Awaited<ReturnType<typeof getProfileByUserId>>>} owner
 * @param {URL} resourceUrl
 */
function playerOrigin(owner, resourceUrl) {
	if (isCatalogDomainExclusive(owner)) {
		const { customDomainUrl } = buildPublicUrls(owner);
		if (customDomainUrl) return customDomainUrl.replace(/\/$/, '');
	}

	const classified = classifyHost(resourceUrl.hostname);
	if (classified === 'apex') return resourceUrl.origin;
	if (
		typeof classified === 'object' &&
		classified.kind === 'subdomain' &&
		classified.username === owner.username
	) {
		return resourceUrl.origin;
	}
	if (
		typeof classified === 'object' &&
		classified.kind === 'custom' &&
		owner.customDomain &&
		customDomainMatches(owner.customDomain, resourceUrl.hostname)
	) {
		return resourceUrl.origin;
	}
	return ORIGIN.replace(/\/$/, '');
}

/**
 * @param {string} value
 */
function escapeAttr(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/**
 * @param {string | null | undefined} value
 * @param {string} fallback
 */
function plainText(value, fallback) {
	const text = String(value ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	const chosen = text || fallback;
	return chosen.length > 300 ? `${chosen.slice(0, 297)}…` : chosen;
}

/**
 * @param {number | string | null} raw
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function clampPx(raw, fallback, min, max) {
	const value = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(value) || value <= 0) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Published track addressed by a public path. `viewerId` null means anonymous,
 * so drafts stay hidden from unfurlers.
 *
 * @param {{ tenant?: { userId: string } | null }} locals
 * @param {string} username
 * @param {string} slug
 * @param {string | null} viewerId
 * @returns {Promise<{ ok: true, username: string, slug: string, row: TrackRow, owner: NonNullable<Awaited<ReturnType<typeof getProfileByUserId>>> | null } | { ok: false }>}
 */
export async function loadViewableTrack(locals, username, slug, viewerId) {
	const normalizedUser = normalizeUsername(username);
	const normalizedSlug = slug.trim().toLowerCase();
	if (!normalizedUser || !SLUG_RE.test(normalizedSlug)) return { ok: false };

	const row = await getTrackByUsernameAndSlug(normalizedUser, normalizedSlug);
	if (
		!row ||
		!isTenantResourceAllowed(locals, row.track.userId) ||
		!canViewTrack(row.track, viewerId)
	) {
		return { ok: false };
	}

	const owner = await getProfileByUserId(row.track.userId);
	return { ok: true, username: normalizedUser, slug: normalizedSlug, row, owner };
}

/**
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @returns {Promise<
 *   { ok: true, body: Record<string, unknown>, priv: boolean } |
 *   { ok: false, status: number, message: string }
 * >}
 */
export async function resolveTrackOEmbed(event) {
	const format = (event.url.searchParams.get('format') || 'json').toLowerCase();
	if (format !== 'json') return { ok: false, status: 501, message: 'Unsupported format.' };

	const rawUrl = event.url.searchParams.get('url')?.trim() ?? '';
	if (!rawUrl || rawUrl.length > 2048) {
		return { ok: false, status: 400, message: 'Missing url.' };
	}

	let resource;
	try {
		resource = new URL(rawUrl);
	} catch {
		return { ok: false, status: 400, message: 'Invalid url.' };
	}
	if (resource.protocol !== 'http:' && resource.protocol !== 'https:') {
		return { ok: false, status: 400, message: 'Invalid url.' };
	}
	if (!hostMayQuery(resource.hostname, event.url.hostname)) {
		return { ok: false, status: 404, message: 'Track not found.' };
	}

	const loaded = await loadTrackFromUrl(event.locals, resource);
	if (!loaded) return { ok: false, status: 404, message: 'Track not found.' };

	const { row, owner } = loaded;
	const username = row.username;
	const slug = row.track.slug;
	if (!username || !slug || !owner) {
		return { ok: false, status: 404, message: 'Track not found.' };
	}

	const origin = playerOrigin(owner, resource);
	const onTenant = classifyHost(new URL(origin).hostname) !== 'apex';
	const canonical = `${origin}${trackPath({ username, slug, id: row.track.id })}`;
	const artist = row.track.artist || row.uploaderName || username;
	const autoplay =
		event.url.searchParams.get('auto_play') === 'true' ||
		event.url.searchParams.get('autoplay') === '1' ||
		event.url.searchParams.get('autoplay') === 'true';
	const width = clampPx(event.url.searchParams.get('maxwidth'), EMBED_PLAYER_WIDTH, 240, 800);
	const height = clampPx(
		event.url.searchParams.get('maxheight'),
		EMBED_PLAYER_HEIGHT,
		120,
		EMBED_PLAYER_HEIGHT
	);
	const src = `${canonical}embed/${autoplay ? '?autoplay=1' : ''}`;
	const title = `${row.track.title} by ${artist}`;
	const html = `<iframe width="${width}" height="${height}" scrolling="no" frameborder="0" allow="autoplay" title="${escapeAttr(title)}" src="${escapeAttr(src)}"></iframe>`;

	const providerName =
		onTenant && event.locals.tenant && event.url.origin === origin
			? event.locals.tenant.name || event.locals.tenant.username || 'SNDBNK'
			: 'SNDBNK';

	/** @type {Record<string, unknown>} */
	const body = {
		version: '1.0',
		type: 'rich',
		provider_name: providerName,
		provider_url: origin,
		title,
		author_name: artist,
		author_url: onTenant ? `${origin}/` : `${origin}/users/${username}`,
		description: plainText(
			row.track.description,
			`Listen to ${row.track.title} by ${artist} on ${providerName}.`
		),
		html,
		width,
		height,
		cache_age: 300
	};

	if (row.track.coverFilename) {
		body.thumbnail_url = `${origin}/api/media/${row.track.id}/cover`;
	}

	return { ok: true, body, priv: Boolean(row.track.isPrivate) };
}

/**
 * @param {import('@sveltejs/kit').RequestEvent['locals']} locals
 * @param {URL} resource
 * @returns {Promise<{ row: TrackRow, owner: NonNullable<Awaited<ReturnType<typeof getProfileByUserId>>> | null } | null>}
 */
async function loadTrackFromUrl(locals, resource) {
	const legacy = LEGACY_PATH_RE.exec(resource.pathname);
	if (legacy) {
		const row = await getTrackWithUploader(legacy[1]);
		if (
			!row?.username ||
			!isTenantResourceAllowed(locals, row.track.userId) ||
			!canViewTrack(row.track, null)
		) {
			return null;
		}
		await ensureTrackSlug(row.track);
		const owner = await getProfileByUserId(row.track.userId);
		return { row, owner };
	}

	const match = TRACK_PATH_RE.exec(resource.pathname);
	if (!match) return null;
	const loaded = await loadViewableTrack(locals, match[1], match[2], null);
	if (!loaded.ok) return null;
	return { row: loaded.row, owner: loaded.owner };
}
