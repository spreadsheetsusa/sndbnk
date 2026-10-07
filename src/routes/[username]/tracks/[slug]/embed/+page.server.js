import { error } from '@sveltejs/kit';

import { resolveStreamSource } from '#lib/server/media/assets';
import { loadViewableTrack } from '#lib/server/oembed';
import { redirectApexCatalogToDomain } from '#lib/server/platform-pool';
import { safeRedirect } from '#lib/server/safe-redirect';
import { serializeTrackForPlayer } from '#lib/server/tracks';

export const trailingSlash = 'always';

export const load = async ({ locals, params }) => {
	const loaded = await loadViewableTrack(
		locals,
		params.username,
		params.slug,
		locals.user?.id ?? null
	);
	if (!loaded.ok) error(404, 'Track not found');

	if (params.username !== loaded.username || params.slug !== loaded.slug) {
		safeRedirect(301, `/${loaded.username}/tracks/${loaded.slug}/embed/`);
	}

	if (loaded.owner) {
		redirectApexCatalogToDomain(
			locals,
			loaded.owner,
			`/${loaded.username}/tracks/${loaded.slug}/embed/`
		);
	}

	const track = await serializeTrackForPlayer(
		loaded.row.track,
		loaded.row,
		undefined,
		locals.user,
		undefined
	);
	const stream = resolveStreamSource(loaded.row.track);

	return {
		track,
		description: loaded.row.track.description,
		streamMime: stream?.mime ?? null,
		coverMime: loaded.row.track.coverMime ?? null
	};
};
