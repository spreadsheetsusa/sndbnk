import { fail } from '@sveltejs/kit';

import { getProfileByUserId } from '#lib/server/tenant';
import { createTrackFromForm } from '#lib/server/tracks';
import { safeRedirect } from '#lib/server/safe-redirect';

export const load = async ({ locals }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) {
		safeRedirect(302, '/signup');
	}

	return {
		user: {
			id: locals.user.id,
			name: locals.user.name
		},
		profile: {
			username: profile.username
		}
	};
};

export const actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) {
			safeRedirect(302, '/signin');
		}

		const formData = await request.formData();
		const result = await createTrackFromForm(locals.user.id, formData);

		if (!result.ok) {
			return fail(400, {
				message: result.message,
				title: formData.get('title')?.toString() ?? '',
				description: formData.get('description')?.toString() ?? '',
				artist: formData.get('artist')?.toString() ?? '',
				album: formData.get('album')?.toString() ?? '',
				genre: formData.get('genre')?.toString() ?? '',
				year: formData.get('year')?.toString() ?? '',
				trackNumber: formData.get('trackNumber')?.toString() ?? '',
				bpm: formData.get('bpm')?.toString() ?? '',
				isrc: formData.get('isrc')?.toString() ?? '',
				comment: formData.get('comment')?.toString() ?? ''
			});
		}

		safeRedirect(303, `/library/${result.trackId}`);
	}
};
