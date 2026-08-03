import { error, fail } from '@sveltejs/kit';

import { embedTrackTags } from '#lib/server/media/embed-tags';
import { getProfileByUserId } from '#lib/server/tenant';
import { deleteTrackForUser, getOwnedTrack, updateTrackFromForm } from '#lib/server/tracks';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = async ({ locals, params }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) {
		safeRedirect(302, '/signup');
	}

	const row = await getOwnedTrack(locals.user.id, params.id);
	if (!row) {
		error(404, 'Track not found');
	}

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name
		},
		profile: {
			username: profile.username
		},
		track: {
			id: row.id,
			title: row.title,
			description: row.description ?? '',
			artist: row.artist ?? '',
			album: row.album ?? '',
			genre: row.genre ?? '',
			mediaType: row.mediaType ?? 'track',
			year: row.year ?? '',
			trackNumber: row.trackNumber ?? '',
			bpm: row.bpm ?? '',
			isrc: row.isrc ?? '',
			comment: row.comment ?? '',
			audioFilename: row.audioFilename,
			audioMime: row.audioMime,
			audioBytes: row.audioBytes,
			coverFilename: row.coverFilename,
			hasCover: Boolean(row.coverFilename),
			durationMs: row.durationMs ?? '',
			bitrate: row.bitrate ?? '',
			sampleRate: row.sampleRate ?? '',
			channels: row.channels ?? '',
			codec: row.codec ?? '',
			storageAdapter: row.storageAdapter
		}
	};
};

export const actions = {
	update: async ({ locals, request, params }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const result = await updateTrackFromForm(locals.user.id, params.id, formData);

		if (!result.ok) {
			return fail(400, {
				message: result.message,
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
			});
		}

		return { success: 'Track updated.' };
	},

	embedTags: async ({ locals, params }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const result = await embedTrackTags(locals.user.id, params.id);
		if (!result.ok) {
			return fail(400, { embedError: result.message });
		}

		return {
			embedded: result.written.length
				? `Wrote to the audio file: ${result.written.join(', ')}.`
				: 'Nothing to write — the audio file already has a value for every field.'
		};
	},

	delete: async ({ locals, params }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const result = await deleteTrackForUser(locals.user.id, params.id);
		if (!result.ok) {
			return fail(400, { message: result.message });
		}

		safeRedirect(303, '/library');
	}
};
