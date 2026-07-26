import { error } from '@sveltejs/kit';

import { loadPublicProfilePage } from '#lib/server/profile-page';

export const load = async ({ locals, params }) => {
	const data = await loadPublicProfilePage({
		username: params.username ?? '',
		locals
	});

	if (!data) {
		error(404, 'Profile not found');
	}

	return data;
};
