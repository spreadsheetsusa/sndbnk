import { error, json } from '@sveltejs/kit';

import { getPlaylistById, togglePlaylistLike } from '#lib/server/playlists';
import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { isTenantResourceAllowed } from '#lib/server/tenant';

export async function POST({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Sign in to like playlists.');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const playlist = await getPlaylistById(params.id);
	if (!playlist || !isTenantResourceAllowed(locals, playlist.userId)) {
		error(404, 'Playlist not found');
	}

	const result = await togglePlaylistLike(locals.user.id, params.id);
	if (!result.ok) error(404, result.message);

	return json({ liked: result.liked, likeCount: result.likeCount });
}
