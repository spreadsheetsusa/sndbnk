import { error } from '@sveltejs/kit';

import { safeRedirect } from '#lib/server/safe-redirect';
import { isTenantResourceAllowed } from '#lib/server/tenant';
import { canViewTrack, ensureTrackSlug, getTrackWithUploader } from '#lib/server/tracks';
import { trackPath } from '#lib/track-path.js';

export const load = async ({ locals, params }) => {
	const row = await getTrackWithUploader(params.id);
	if (
		!row ||
		!isTenantResourceAllowed(locals, row.track.userId) ||
		!canViewTrack(row.track, locals.user?.id)
	) {
		error(404, 'Track not found');
	}

	const slug = await ensureTrackSlug(row.track);
	if (!row.username || !slug) {
		error(404, 'Track not found');
	}

	safeRedirect(301, trackPath({ username: row.username, slug }));
};
