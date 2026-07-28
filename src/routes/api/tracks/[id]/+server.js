import { error, json } from '@sveltejs/kit';

import { deleteTrackForUser } from '#lib/server/tracks';

export async function DELETE({ locals, params }) {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const result = await deleteTrackForUser(locals.user.id, params.id);
	if (!result.ok) {
		error(404, result.message);
	}

	return json({ ok: true });
}
