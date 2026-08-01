import { error } from '@sveltejs/kit';

import {
	getSocialForTracks,
	getTrackWithUploader,
	listCommentsForTrack,
	serializeTrackForPlayer
} from '#lib/server/tracks';

export const load = async ({ locals, params }) => {
	const row = await getTrackWithUploader(params.id);
	if (!row) {
		error(404, 'Track not found');
	}

	const social = await getSocialForTracks([row.track.id], locals.user?.id ?? null);
	const comments = await listCommentsForTrack(row.track.id);
	const timedComments = comments
		.filter((comment) => comment.atMs != null)
		.map((comment) => ({ ...comment, atMs: /** @type {number} */ (comment.atMs) }))
		.sort((a, b) => a.atMs - b.atMs);
	const track = await serializeTrackForPlayer(
		row.track,
		row,
		social.get(row.track.id),
		locals.user,
		timedComments
	);

	return {
		track,
		description: row.track.description,
		comments,
		viaTenantHost: Boolean(locals.tenant),
		viewer: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name,
					image: locals.user.image ?? null
				}
			: null
	};
};
