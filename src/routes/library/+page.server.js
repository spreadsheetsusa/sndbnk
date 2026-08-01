import { getProfileByUserId } from '#lib/server/tenant';
import { listTracksWithUploader, serializeTrackRows } from '#lib/server/tracks';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = async ({ locals }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) {
		safeRedirect(302, '/signup');
	}

	const { rows, nextCursor } = await listTracksWithUploader(locals.user.id);

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			image: locals.user.image ?? null
		},
		profile: {
			username: profile.username
		},
		tracks: await serializeTrackRows(rows, locals.user),
		nextCursor
	};
};
