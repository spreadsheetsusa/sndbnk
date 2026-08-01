import { error, json } from '@sveltejs/kit';

import { toggleRepost } from '#lib/server/social';
import { canViewTrack, getTrackById } from '#lib/server/tracks';

export async function POST({ locals, params }) {
	if (!locals.user) {
		error(401, 'Sign in to repost tracks.');
	}

	const row = await getTrackById(params.id);
	if (!row || !canViewTrack(row, locals.user.id)) {
		error(404, 'Track not found');
	}

	const result = await toggleRepost(locals.user.id, row.id, row.userId);
	if (!result.ok) {
		error(400, result.message);
	}

	return json({ reposted: result.reposted, repostCount: result.repostCount });
}
