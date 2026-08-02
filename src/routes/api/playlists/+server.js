import { error, json } from '@sveltejs/kit';

import { listPlaylistsForOwner } from '#lib/server/playlists';

/** Owner's playlists for the “Add to playlist” picker. */
export async function GET({ locals, url }) {
	if (!locals.user) error(401, 'Sign in to manage playlists.');
	if (url.searchParams.get('mine') !== '1') {
		error(400, 'Use mine=1 to list your playlists.');
	}

	return json({ playlists: await listPlaylistsForOwner(locals.user.id) });
}
