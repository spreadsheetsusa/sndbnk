import { ORIGIN } from '$app/env/private';

import { renderBioHtml } from '#lib/markdown/bio';
import { canRemoveBranding } from '#lib/server/billing/plans';
import { listRecentComments } from '#lib/server/feed';
import { listLikedItemsWithUploader, listListeningHistory } from '#lib/server/listens';
import { listLinksForUser } from '#lib/server/profile-links';
import { getSitePublic, resolveSidebarVisibility } from '#lib/server/site';
import { getProfileStats, isFollowing, listFansAlsoLike, listFollowers } from '#lib/server/social';
import { buildPublicUrls, getProfileByUsername } from '#lib/server/tenant';
import { serializeTimelineRows } from '#lib/server/timeline';
import { listProfileItemsWithUploader, serializeTrackRows } from '#lib/server/tracks';
import { normalizeUsername } from '#lib/server/username';

/** @typedef {'tracks' | 'likes' | 'history'} ProfileTab */

/**
 * @param {string | null | undefined} requested
 * @param {boolean} isOwner
 * @returns {ProfileTab}
 */
export function resolveProfileTab(requested, isOwner) {
	if (requested === 'likes') return 'likes';
	if (requested === 'history' && isOwner) return 'history';
	return 'tracks';
}

/**
 * Shared loader data for public profile surfaces (path URL + tenant hosts).
 * @param {{ username: string, locals: App.Locals, url?: URL }} input
 */
export async function loadPublicProfilePage({ username, locals, url }) {
	const normalized = normalizeUsername(username);
	const row = await getProfileByUsername(normalized);

	if (!row) {
		return null;
	}

	const urls = buildPublicUrls(row);
	const viaTenantHost = Boolean(locals.tenant);
	const hostKind = locals.tenant?.hostKind ?? null;
	const viewerId = locals.user?.id ?? null;
	const isOwner = Boolean(viewerId && viewerId === row.userId);
	const tab = resolveProfileTab(url?.searchParams.get('tab'), isOwner);

	const [links, page, stats, fansAlsoLike, followers, recentComments, viewerFollows, site] =
		await Promise.all([
			listLinksForUser(row.userId),
			tab === 'likes'
				? listLikedItemsWithUploader(row.userId)
				: tab === 'history'
					? listListeningHistory(row.userId)
					: listProfileItemsWithUploader(row.userId, { publishedOnly: true }),
			getProfileStats(row.userId),
			listFansAlsoLike(row.userId, viewerId),
			listFollowers(row.userId, viewerId),
			listRecentComments({ creatorId: row.userId }),
			isFollowing(viewerId, row.userId),
			getSitePublic(row.userId)
		]);

	const items =
		tab === 'history'
			? await serializeTrackRows(page.rows, locals.user)
			: await serializeTimelineRows(page.rows, locals.user);

	const publicSite = site
		? {
				...site,
				hideBranding: site.hideBranding && canRemoveBranding(row.plan)
			}
		: null;

	return {
		tab,
		items,
		nextCursor: page.nextCursor,
		profile: {
			userId: row.userId,
			username: row.username,
			name: row.name,
			plan: row.plan,
			bio: row.bio ?? null,
			bioHtml: row.bio ? renderBioHtml(row.bio) : null,
			location: row.location ?? null,
			avatarUrl: row.image ?? null,
			customDomain: row.customDomain,
			customDomainStatus: row.customDomainStatus
		},
		site: publicSite,
		links,
		urls,
		stats,
		sidebar: { fansAlsoLike, followers, recentComments },
		sidebarVisibility: resolveSidebarVisibility(hostKind, site),
		viaTenantHost,
		hostKind,
		// Tenant hosts only serve this profile, so cross-profile links need the apex.
		siteOrigin: ORIGIN.replace(/\/$/, ''),
		viewer: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name,
					image: locals.user.image ?? null,
					isOwner: locals.user.id === row.userId,
					isFollowing: viewerFollows
				}
			: null
	};
}
