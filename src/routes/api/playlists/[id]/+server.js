import { error, json } from '@sveltejs/kit';

import { deletePlaylistForUser } from '#lib/server/playlists';
import { isTrustedMutationRequest } from '#lib/server/request-origin';

export async function DELETE({ locals, params, request, url }) {
	if (!locals.user) error(401, 'Sign in to delete playlists.');
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const result = await deletePlaylistForUser(locals.user.id, params.id);
	if (!result.ok) error(404, result.message);

	return json({ ok: true });
}
