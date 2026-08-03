import { error } from '@sveltejs/kit';

import {
	canViewPlaylist,
	getPlaylistWithOwner,
	getSocialForPlaylists,
	serializePlaylistForCard
} from '#lib/server/playlists';
import { isTenantResourceAllowed } from '#lib/server/tenant';

export const load = async ({ locals, params }) => {
	const row = await getPlaylistWithOwner(params.id);
	if (
		!row ||
		!isTenantResourceAllowed(locals, row.playlist.userId) ||
		!canViewPlaylist(row.playlist, locals.user?.id)
	) {
		error(404, 'Playlist not found');
	}

	const social = await getSocialForPlaylists([row.playlist.id], locals.user?.id ?? null);
	const playlist = await serializePlaylistForCard(
		row.playlist,
		row,
		social.get(row.playlist.id),
		locals.user
	);

	return {
		playlist,
		viewer: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name,
					image: locals.user.image ?? null
				}
			: null
	};
};
