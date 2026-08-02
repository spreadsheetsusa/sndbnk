import { ORIGIN } from '$app/env/private';

import { canRemoveBranding } from '#lib/server/billing/plans';
import { listRecentComments } from '#lib/server/feed';
import { listLinksForUser } from '#lib/server/profile-links';
import { getSitePublic, resolveSidebarVisibility } from '#lib/server/site';
import { getProfileStats, isFollowing, listFansAlsoLike, listFollowers } from '#lib/server/social';
import { buildPublicUrls, getProfileByUsername } from '#lib/server/tenant';
import { listProfileItemsWithUploader, serializeTrackRows } from '#lib/server/tracks';
import { normalizeUsername } from '#lib/server/username';

/**
 * Shared loader data for public profile surfaces (path URL + tenant hosts).
 * @param {{ username: string, locals: App.Locals }} input
 */
export async function loadPublicProfilePage({ username, locals }) {
	const normalized = normalizeUsername(username);
	const row = await getProfileByUsername(normalized);

	if (!row) {
		return null;
	}

	const urls = buildPublicUrls(row);
	const viaTenantHost = Boolean(locals.tenant);
	const hostKind = locals.tenant?.hostKind ?? null;
	const viewerId = locals.user?.id ?? null;

	const [links, page, stats, fansAlsoLike, followers, recentComments, viewerFollows, site] =
		await Promise.all([
			listLinksForUser(row.userId),
			listProfileItemsWithUploader(row.userId, { publishedOnly: true }),
			getProfileStats(row.userId),
			listFansAlsoLike(row.userId, viewerId),
			listFollowers(row.userId, viewerId),
			listRecentComments({ creatorId: row.userId }),
			isFollowing(viewerId, row.userId),
			getSitePublic(row.userId)
		]);

	const tracks = await serializeTrackRows(page.rows, locals.user);
	const publicSite = site
		? {
				...site,
				hideBranding: site.hideBranding && canRemoveBranding(row.plan)
			}
		: null;

	return {
		tracks,
		nextCursor: page.nextCursor,
		profile: {
			username: row.username,
			name: row.name,
			plan: row.plan,
			bio: row.bio ?? null,
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
