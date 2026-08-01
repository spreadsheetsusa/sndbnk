import { getProfileByUserId } from '#lib/server/tenant';
import {
	getSocialForTracks,
	listTimedCommentsForTracks,
	listTracksWithUploader,
	serializeTrackForPlayer
} from '#lib/server/tracks';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = async ({ locals }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) {
		safeRedirect(302, '/signup');
	}

	const rows = await listTracksWithUploader(locals.user.id);
	const trackIds = rows.map((row) => row.track.id);
	const social = await getSocialForTracks(trackIds, locals.user.id);
	const timedComments = await listTimedCommentsForTracks(trackIds);

	const tracks = await Promise.all(
		rows.map((row) =>
			serializeTrackForPlayer(
				row.track,
				row,
				social.get(row.track.id),
				locals.user,
				timedComments.get(row.track.id)
			)
		)
	);

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			image: locals.user.image ?? null
		},
		profile: {
			username: profile.username
		},
		tracks
	};
};
