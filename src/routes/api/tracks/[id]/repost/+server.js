import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { toggleRepost } from '#lib/server/social';
import { isTenantResourceAllowed } from '#lib/server/tenant';
import { canViewTrack, getTrackById } from '#lib/server/tracks';

export async function POST({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Sign in to repost tracks.');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId) || !canViewTrack(row, locals.user.id)) {
		error(404, 'Track not found');
	}

	const result = await toggleRepost(locals.user.id, row.id, row.userId, row);
	if (!result.ok) {
		error(400, result.message);
	}

	return json({ reposted: result.reposted, repostCount: result.repostCount });
}
