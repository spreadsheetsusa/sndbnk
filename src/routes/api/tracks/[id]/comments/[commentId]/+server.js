import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { isTenantResourceAllowed } from '#lib/server/tenant';
import {
	canViewTrack,
	deleteCommentForUser,
	getTrackById,
	updateCommentAtMsForUser
} from '#lib/server/tracks';

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

/**
 * Reposition a timed comment on the waveform. Author-only; body edits are out of scope.
 */
export async function PATCH({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Sign in to move a comment.');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId) || !canViewTrack(row, locals.user.id)) {
		error(404, 'Track not found');
	}

	/** @type {{ atMs?: unknown }} */
	let payload;
	try {
		payload = await request.json();
	} catch {
		error(400, 'Invalid request body');
	}

	if (typeof payload.atMs !== 'number' || !Number.isFinite(payload.atMs)) {
		error(400, 'Comment position is required.');
	}

	const result = await updateCommentAtMsForUser(
		locals.user.id,
		row.id,
		params.commentId,
		payload.atMs,
		row.durationMs
	);
	if (!result.ok) {
		error(404, result.message);
	}

	return json({ comment: result.comment });
}
