import { getProfileByUserId } from '#lib/server/tenant';
import { listTracksForUser } from '#lib/server/tracks';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = async ({ locals }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) {
		safeRedirect(302, '/signup');
	}

	const tracks = await listTracksForUser(locals.user.id);

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name
		},
		profile: {
			username: profile.username
		},
		tracks: tracks.map((t) => ({
			id: t.id,
			title: t.title,
			artist: t.artist,
			album: t.album,
			genre: t.genre,
			durationMs: t.durationMs,
			storageAdapter: t.storageAdapter,
			hasCover: Boolean(t.coverFilename),
			createdAt: t.createdAt
		}))
	};
};
