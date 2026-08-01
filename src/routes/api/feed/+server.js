import { error, json } from '@sveltejs/kit';

import { listFeedTracks } from '#lib/server/feed';
import {
	getSocialForTracks,
	listTimedCommentsForTracks,
	serializeTrackForPlayer
} from '#lib/server/tracks';

export async function GET({ locals, url }) {
	if (!locals.user) {
		error(401, 'Sign in to browse the feed.');
	}

	const cursor = url.searchParams.get('cursor');
	const genre = url.searchParams.get('genre')?.trim() || null;

	const { rows, nextCursor } = await listFeedTracks({
		cursor,
		genre
	});

	const trackIds = rows.map((row) => row.track.id);
	const [social, timedComments] = await Promise.all([
		getSocialForTracks(trackIds, locals.user.id),
		listTimedCommentsForTracks(trackIds)
	]);

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

	return json({ tracks, nextCursor });
}
