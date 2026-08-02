import {
	listFeedTracks,
	listGenres,
	listMostLikedTracks,
	listNewArtists,
	listRecentComments
} from '#lib/server/feed';
import { listFollowingIds } from '#lib/server/social';
import { getProfileByUserId } from '#lib/server/tenant';
import { serializeTimelineRows } from '#lib/server/timeline';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = async ({ locals, url }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) {
		safeRedirect(302, '/signup');
	}

	const genreParam = url.searchParams.get('genre')?.trim() || null;
	const following = url.searchParams.get('following') === '1';
	const followingIds = following ? await listFollowingIds(locals.user.id) : null;

	const [{ rows, nextCursor }, mostLiked, newArtists, recentComments, genres] = await Promise.all([
		listFeedTracks({ genre: genreParam, followingIds }),
		listMostLikedTracks(),
		listNewArtists({ viewerId: locals.user.id }),
		listRecentComments(),
		listGenres()
	]);

	const items = await serializeTimelineRows(rows, locals.user);

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			image: locals.user.image ?? null
		},
		items,
		nextCursor,
		genre: genreParam,
		following,
		followingCount: followingIds?.length ?? null,
		sidebar: {
			mostLiked,
			newArtists,
			recentComments,
			genres
		}
	};
};
