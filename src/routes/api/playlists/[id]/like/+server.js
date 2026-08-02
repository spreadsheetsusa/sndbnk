import { error, json } from '@sveltejs/kit';

import { togglePlaylistLike } from '#lib/server/playlists';

export async function POST({ locals, params }) {
	if (!locals.user) {
		error(401, 'Sign in to like playlists.');
	}

	const result = await togglePlaylistLike(locals.user.id, params.id);
	if (!result.ok) error(404, result.message);

	return json({ liked: result.liked, likeCount: result.likeCount });
}
