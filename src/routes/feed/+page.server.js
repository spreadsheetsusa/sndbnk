import {
	listFeedTracks,
	listGenres,
	listMostLikedTracks,
	listNewArtists,
	listRecentComments
} from '#lib/server/feed';
import { getProfileByUserId } from '#lib/server/tenant';
import {
	getSocialForTracks,
	listTimedCommentsForTracks,
	serializeTrackForPlayer
} from '#lib/server/tracks';
import { safeRedirect } from '#lib/server/safe-redirect';

/**
 * @param {Awaited<ReturnType<typeof listFeedTracks>>['rows']} rows
 * @param {{ id: string } | null} viewer
 */
async function serializeFeedRows(rows, viewer) {
	const trackIds = rows.map((row) => row.track.id);
	const [social, timedComments] = await Promise.all([
		getSocialForTracks(trackIds, viewer?.id ?? null),
		listTimedCommentsForTracks(trackIds)
	]);

	return Promise.all(
		rows.map((row) =>
			serializeTrackForPlayer(
				row.track,
				row,
				social.get(row.track.id),
				viewer,
				timedComments.get(row.track.id)
			)
		)
	);
}

export const load = async ({ locals, url }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) {
		safeRedirect(302, '/signup');
	}

	const genreParam = url.searchParams.get('genre')?.trim() || null;

	const [{ rows, nextCursor }, mostLiked, newArtists, recentComments, genres] = await Promise.all([
		listFeedTracks({ genre: genreParam }),
		listMostLikedTracks(),
		listNewArtists(),
		listRecentComments(),
		listGenres()
	]);

	const tracks = await serializeFeedRows(rows, locals.user);

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			image: locals.user.image ?? null
		},
		tracks,
		nextCursor,
		genre: genreParam,
		sidebar: {
			mostLiked,
			newArtists,
			recentComments,
			genres
		}
	};
};
