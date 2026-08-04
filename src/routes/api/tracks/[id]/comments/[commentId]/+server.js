import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { isTenantResourceAllowed } from '#lib/server/tenant';
import { canViewTrack, deleteCommentForUser, getTrackById } from '#lib/server/tracks';

export async function DELETE({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Sign in to delete a comment.');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId) || !canViewTrack(row, locals.user.id)) {
		error(404, 'Track not found');
	}

	const result = await deleteCommentForUser(locals.user.id, row.id, params.commentId);
	if (!result.ok) {
		error(404, result.message);
	}

	return json({ ok: true });
}
