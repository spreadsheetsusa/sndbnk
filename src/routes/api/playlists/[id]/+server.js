import { error, json } from '@sveltejs/kit';

import { deletePlaylistForUser } from '#lib/server/playlists';

export async function DELETE({ locals, params }) {
	if (!locals.user) error(401, 'Sign in to delete playlists.');

	const result = await deletePlaylistForUser(locals.user.id, params.id);
	if (!result.ok) error(404, result.message);

	return json({ ok: true });
}
