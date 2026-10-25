import { error, json } from '@sveltejs/kit';

import { toggleTrackLike } from '#lib/server/engagement';
import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { isTenantResourceAllowed } from '#lib/server/tenant';
import { canViewTrack, getTrackById } from '#lib/server/tracks';

export async function POST({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Sign in to like tracks.');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId) || !canViewTrack(row, locals.user.id)) {
		error(404, 'Track not found');
	}

	const { liked, likeCount } = await toggleTrackLike(row.id, locals.user.id);
	return json({ liked, likeCount });
}
