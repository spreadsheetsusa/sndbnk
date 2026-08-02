import { error, fail } from '@sveltejs/kit';

import {
	getOwnedPlaylist,
	listPlaylistTrackRows,
	removeTrackFromPlaylist,
	reorderPlaylistTracks,
	updatePlaylistFromForm
} from '#lib/server/playlists';
import { getProfileByUserId } from '#lib/server/tenant';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = async ({ locals, params }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) {
		safeRedirect(302, '/signup');
	}

	const row = await getOwnedPlaylist(locals.user.id, params.id);
	if (!row) error(404, 'Playlist not found');

	const members = await listPlaylistTrackRows(row.id);

	return {
		profile: { username: profile.username },
		playlist: {
			id: row.id,
			title: row.title,
			description: row.description ?? '',
			published: Boolean(row.published)
		},
		tracks: members.map((m) => ({
			id: m.track.id,
			title: m.track.title,
			artist: m.track.artist,
			uploaderName: m.uploaderName ?? m.username ?? 'Unknown',
			durationMs: m.track.durationMs,
			hasCover: Boolean(m.track.coverFilename)
		}))
	};
};

export const actions = {
	update: async ({ locals, params, request }) => {
		if (!locals.user) safeRedirect(302, '/signin');

		const formData = await request.formData();
		const result = await updatePlaylistFromForm(locals.user.id, params.id, formData);
		if (!result.ok) {
			return fail(400, {
				updateMessage: result.message,
				title: formData.get('title')?.toString() ?? '',
				description: formData.get('description')?.toString() ?? '',
				published: formData.get('published')?.toString() === 'true'
			});
		}

		return { updateSuccess: 'Playlist saved.' };
	},

	removeTrack: async ({ locals, params, request }) => {
		if (!locals.user) safeRedirect(302, '/signin');

		const formData = await request.formData();
		const trackId = formData.get('trackId')?.toString() ?? '';
		const result = await removeTrackFromPlaylist(locals.user.id, params.id, trackId);
		if (!result.ok) {
			return fail(400, { tracksMessage: result.message });
		}
		return { tracksSuccess: 'Track removed.' };
	},

	reorder: async ({ locals, params, request }) => {
		if (!locals.user) safeRedirect(302, '/signin');

		const formData = await request.formData();
		const raw = formData.get('trackIds')?.toString() ?? '[]';
		/** @type {string[]} */
		let trackIds;
		try {
			trackIds = JSON.parse(raw);
		} catch {
			return fail(400, { tracksMessage: 'Invalid track order.' });
		}

		const result = await reorderPlaylistTracks(locals.user.id, params.id, trackIds);
		if (!result.ok) {
			return fail(400, { tracksMessage: result.message });
		}
		return { tracksSuccess: 'Order saved.' };
	}
};
