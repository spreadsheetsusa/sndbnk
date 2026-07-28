import { getProfileByUserId } from '#lib/server/tenant';
import {
	getSocialForTracks,
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
	const social = await getSocialForTracks(
		rows.map((row) => row.track.id),
		locals.user.id
	);

	const tracks = await Promise.all(
		rows.map((row) =>
			serializeTrackForPlayer(row.track, row, social.get(row.track.id), locals.user)
		)
	);

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name
		},
		profile: {
			username: profile.username
		},
		tracks
	};
};
