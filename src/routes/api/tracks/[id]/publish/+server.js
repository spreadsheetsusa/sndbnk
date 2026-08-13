import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { setTrackPublished } from '#lib/server/tracks';

export async function POST({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	/** @type {{ published?: unknown }} */
	let payload;
	try {
		payload = await request.json();
	} catch {
		error(400, 'Invalid request body');
	}

	if (typeof payload.published !== 'boolean') {
		error(400, 'published must be a boolean.');
	}

	const result = await setTrackPublished(locals.user.id, params.id, payload.published);
	if (!result.ok) {
		error(404, result.message);
	}

	return json({ published: result.published });
}
