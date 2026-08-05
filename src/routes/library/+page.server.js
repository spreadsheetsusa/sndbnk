import { fail } from '@sveltejs/kit';

import { isTrackMediaType } from '#lib/media/track-media-type.js';
import { embedTrackTags } from '#lib/server/media/embed-tags';
import { listPlaylistsForOwner } from '#lib/server/playlists';
import { getUsage } from '#lib/server/quota';
import { getProfileByUserId } from '#lib/server/tenant';
import {
	createTrackFromForm,
	getOwnedTrack,
	listTracksWithUploader,
	serializeLibraryTrackRows,
	updateTrackFromForm
} from '#lib/server/tracks';
import { safeRedirect } from '#lib/server/safe-redirect';

/**
 * @param {FormData} formData
 * @param {string} trackId
 */
function echoEditorial(formData, trackId) {
	return {
		trackId,
		title: formData.get('title')?.toString() ?? '',
		description: formData.get('description')?.toString() ?? '',
		artist: formData.get('artist')?.toString() ?? '',
		album: formData.get('album')?.toString() ?? '',
		genre: formData.get('genre')?.toString() ?? '',
		mediaType: formData.get('mediaType')?.toString() ?? '',
		year: formData.get('year')?.toString() ?? '',
		trackNumber: formData.get('trackNumber')?.toString() ?? '',
		bpm: formData.get('bpm')?.toString() ?? '',
		isrc: formData.get('isrc')?.toString() ?? '',
		comment: formData.get('comment')?.toString() ?? ''
	};
}

export const load = async ({ locals, url }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) {
		safeRedirect(302, '/signup');
	}

	const mediaTypeRaw = url.searchParams.get('mediaType')?.trim() || null;
	const mediaType = isTrackMediaType(mediaTypeRaw) ? mediaTypeRaw : null;

	const [{ rows, nextCursor }, usage, playlists] = await Promise.all([
		listTracksWithUploader(locals.user.id, { mediaType }),
		getUsage(locals.user.id),
		listPlaylistsForOwner(locals.user.id)
	]);

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			image: locals.user.image ?? null
		},
		profile: {
			username: profile.username
		},
		mediaType,
		items: await serializeLibraryTrackRows(rows, locals.user),
		nextCursor,
		playlists,
		usage
	};
};

export const actions = {
	create: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const result = await createTrackFromForm(locals.user.id, formData);
		if (!result.ok) {
			return fail(400, { message: result.message });
		}

		const row = await getOwnedTrack(locals.user.id, result.trackId);
		if (!row) {
			return fail(500, { message: 'Track uploaded but could not be loaded.' });
		}

		const profile = await getProfileByUserId(locals.user.id);
		const [item] = await serializeLibraryTrackRows(
			[
				{
					track: row,
					username: profile?.username ?? null,
					uploaderName: locals.user.name,
					kind: /** @type {const} */ ('track'),
					repostedAt: null
				}
			],
			locals.user
		);

		return {
			success: 'Track uploaded.',
			trackId: result.trackId,
			item
		};
	},

	update: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const trackId = formData.get('trackId')?.toString() ?? '';
		if (!trackId) {
			return fail(400, { message: 'Missing track.', trackId: '' });
		}

		const result = await updateTrackFromForm(locals.user.id, trackId, formData);
		if (!result.ok) {
			return fail(400, {
				message: result.message,
				...echoEditorial(formData, trackId)
			});
		}

		/** @type {string[] | undefined} */
		let tagsWritten;
		/** @type {string | undefined} */
		let tagsMessage;
		if (formData.get('writeTags') === '1') {
			const tags = await embedTrackTags(locals.user.id, trackId, { mode: 'overwrite' });
			if (tags.ok) {
				tagsWritten = tags.written;
				if (tags.written.length === 0) {
					tagsMessage = 'Saved. No tags were written to the file.';
				}
			} else {
				tagsMessage = `Saved, but tags were not written: ${tags.message}`;
			}
		}

		return {
			success: 'Track updated.',
			...echoEditorial(formData, trackId),
			hasCover: Boolean(result.hasCover),
			tagsWritten,
			tagsMessage
		};
	}
};
