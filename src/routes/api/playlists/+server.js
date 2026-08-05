import { error, json } from '@sveltejs/kit';

import { createPlaylistForUser, listPlaylistsForOwner } from '#lib/server/playlists';
import { isTrustedMutationRequest } from '#lib/server/request-origin';

/** Owner's playlists for the “Add to playlist” picker. */
export async function GET({ locals, url }) {
	if (!locals.user) error(401, 'Sign in to manage playlists.');
	if (url.searchParams.get('mine') !== '1') {
		error(400, 'Use mine=1 to list your playlists.');
	}

	// Session owner's own playlists (for picker UX on apex and tenant hosts).
	return json({ playlists: await listPlaylistsForOwner(locals.user.id) });
}

/** Inline create from the library media sidebar. */
export async function POST({ locals, request, url }) {
	if (!locals.user) error(401, 'Sign in to create playlists.');
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const body = await request.json().catch(() => null);
	const title = typeof body?.title === 'string' ? body.title : '';
	const result = await createPlaylistForUser(locals.user.id, title);
	if (!result.ok) error(400, result.message);

	return json({ playlist: result.playlist });
}
