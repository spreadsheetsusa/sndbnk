import { listLinksForUser } from '#lib/server/profile-links';
import { buildPublicUrls, getProfileByUsername } from '#lib/server/tenant';
import {
	getSocialForTracks,
	listTimedCommentsForTracks,
	listTracksWithUploader,
	serializeTrackForPlayer
} from '#lib/server/tracks';
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
	const links = await listLinksForUser(row.userId);

	const trackRows = await listTracksWithUploader(row.userId);
	const trackIds = trackRows.map((r) => r.track.id);
	const social = await getSocialForTracks(trackIds, locals.user?.id ?? null);
	const timedComments = await listTimedCommentsForTracks(trackIds);
	const tracks = await Promise.all(
		trackRows.map((r) =>
			serializeTrackForPlayer(
				r.track,
				r,
				social.get(r.track.id),
				locals.user,
				timedComments.get(r.track.id)
			)
		)
	);

	return {
		tracks,
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
		links,
		urls,
		viaTenantHost,
		viewer: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name,
					image: locals.user.image ?? null,
					isOwner: locals.user.id === row.userId
				}
			: null
	};
}
