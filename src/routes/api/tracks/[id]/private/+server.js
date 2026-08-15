import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { setTrackPrivate } from '#lib/server/tracks';

export async function POST({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	/** @type {{ isPrivate?: unknown }} */
	let payload;
	try {
		payload = await request.json();
	} catch {
		error(400, 'Invalid request body');
	}

	if (typeof payload.isPrivate !== 'boolean') {
		error(400, 'isPrivate must be a boolean.');
	}

	const result = await setTrackPrivate(locals.user.id, params.id, payload.isPrivate);
	if (!result.ok) {
		error(404, result.message);
	}

	return json({ isPrivate: result.isPrivate });
}
