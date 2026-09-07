import { error, json } from '@sveltejs/kit';

import { parseTagEmbedStatus } from '#lib/media/tag-embed-status.js';
import { getOwnedTrack } from '#lib/server/tracks';

export async function GET({ locals, params }) {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const row = await getOwnedTrack(locals.user.id, params.id);
	if (!row) {
		error(404, 'Track not found');
	}

	return json({
		status: parseTagEmbedStatus(row.tagEmbedStatus),
		message: row.tagEmbedMessage ?? null,
		updatedAt: row.tagEmbedUpdatedAt?.getTime() ?? null
	});
}
