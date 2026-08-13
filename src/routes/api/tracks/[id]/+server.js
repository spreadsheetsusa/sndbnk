import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { deleteTrackForUser } from '#lib/server/tracks';

export async function DELETE({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const result = await deleteTrackForUser(locals.user.id, params.id);
	if (!result.ok) {
		error(404, result.message);
	}

	return json({ ok: true });
}
