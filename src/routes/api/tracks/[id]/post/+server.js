import { error, json } from '@sveltejs/kit';

import { loadContentImages, renderTrackPostHtml } from '#lib/server/media/track-post';
import { isTenantResourceAllowed } from '#lib/server/tenant';
import { canViewTrack, getTrackById } from '#lib/server/tracks';

export async function GET({ locals, params }) {
	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId) || !canViewTrack(row, locals.user?.id)) {
		error(404, 'Track not found');
	}

	const images = await loadContentImages(row);
	return json({ html: renderTrackPostHtml(row.id, row.description, images) });
}
