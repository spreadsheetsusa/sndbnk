import { error, json } from '@sveltejs/kit';

import { listFeedTracks } from '#lib/server/feed';
import { listFollowingIds } from '#lib/server/social';
import { getProfileByUsername } from '#lib/server/tenant';
import {
	listProfileItemsWithUploader,
	listTracksWithUploader,
	serializeTrackRows,
	TRACK_PAGE_SIZE
} from '#lib/server/tracks';
import { normalizeUsername } from '#lib/server/username';

/**
 * Paged track listings for every infinite-scroll surface. The page shape here
 * must match what the matching `load` returns, since the client appends one to
 * the other.
 */
export async function GET({ locals, url }) {
	const scope = url.searchParams.get('scope') ?? 'feed';
	const cursor = url.searchParams.get('cursor');
	const direction = url.searchParams.get('direction') === 'newer' ? 'newer' : 'older';
	const inclusive = url.searchParams.get('inclusive') === '1';
	const page = { limit: TRACK_PAGE_SIZE, cursor, direction, inclusive };

	if (scope === 'feed') {
		if (!locals.user) error(401, 'Sign in to browse the feed.');

		const following = url.searchParams.get('following') === '1';
		const { rows, nextCursor } = await listFeedTracks({
			...page,
			genre: url.searchParams.get('genre')?.trim() || null,
			followingIds: following ? await listFollowingIds(locals.user.id) : null
		});

		return json({ tracks: await serializeTrackRows(rows, locals.user), nextCursor });
	}

	if (scope === 'library') {
		if (!locals.user) error(401, 'Sign in to view your library.');

		const { rows, nextCursor } = await listTracksWithUploader(locals.user.id, page);
		return json({ tracks: await serializeTrackRows(rows, locals.user), nextCursor });
	}

	if (scope === 'profile') {
		const username = normalizeUsername(url.searchParams.get('username') ?? '');
		const owner = username ? await getProfileByUsername(username) : null;
		if (!owner) error(404, 'Profile not found.');

		const { rows, nextCursor } = await listProfileItemsWithUploader(owner.userId, {
			...page,
			publishedOnly: true
		});

		return json({ tracks: await serializeTrackRows(rows, locals.user), nextCursor });
	}

	error(400, 'Unknown scope.');
}
