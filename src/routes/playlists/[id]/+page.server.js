import { error } from '@sveltejs/kit';

import {
	canViewPlaylist,
	getPlaylistWithOwner,
	getSocialForPlaylists,
	serializePlaylistForCard
} from '#lib/server/playlists';
import { catalogHostOwnerId, redirectApexCatalogToDomain } from '#lib/server/platform-pool';
import { getProfileByUserId, isTenantResourceAllowed } from '#lib/server/tenant';

export const load = async ({ locals, params }) => {
	const row = await getPlaylistWithOwner(params.id);
	if (
		!row ||
		!isTenantResourceAllowed(locals, row.playlist.userId) ||
		!canViewPlaylist(row.playlist, locals.user?.id)
	) {
		error(404, 'Playlist not found');
	}

	const owner = await getProfileByUserId(row.playlist.userId);
	if (owner) {
		redirectApexCatalogToDomain(locals, owner, `/playlists/${row.playlist.id}`);
	}

	const social = await getSocialForPlaylists([row.playlist.id], locals.user?.id ?? null);
	const playlist = await serializePlaylistForCard(
		row.playlist,
		row,
		social.get(row.playlist.id),
		locals.user,
		undefined,
		catalogHostOwnerId(locals)
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
