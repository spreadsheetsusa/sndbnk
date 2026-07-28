import { buildPublicUrls, getProfileByUsername } from '#lib/server/tenant';
import {
	getSocialForTracks,
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

	const trackRows = await listTracksWithUploader(row.userId);
	const social = await getSocialForTracks(
		trackRows.map((r) => r.track.id),
		locals.user?.id ?? null
	);
	const tracks = await Promise.all(
		trackRows.map((r) => serializeTrackForPlayer(r.track, r, social.get(r.track.id), locals.user))
	);

	return {
		tracks,
		profile: {
			username: row.username,
			name: row.name,
			plan: row.plan,
			customDomain: row.customDomain,
			customDomainStatus: row.customDomainStatus
		},
		urls,
		viaTenantHost,
		viewer: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name,
					isOwner: locals.user.id === row.userId
				}
			: null
	};
}
