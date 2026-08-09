import { error } from '@sveltejs/kit';

import { isTenantResourceAllowed } from '#lib/server/tenant';
import {
	canViewTrack,
	getSocialForTracks,
	getTrackWithUploader,
	listCommentsForTrack,
	serializeTrackForPlayer
} from '#lib/server/tracks';

export const load = async ({ locals, params }) => {
	const row = await getTrackWithUploader(params.id);
	if (
		!row ||
		!isTenantResourceAllowed(locals, row.track.userId) ||
		!canViewTrack(row.track, locals.user?.id)
	) {
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
		meta: {
			album: row.track.album ?? null,
			albumArtist: row.track.albumArtist ?? null,
			year: row.track.year ?? null,
			trackNumber: row.track.trackNumber ?? null,
			discNumber: row.track.discNumber ?? null,
			bpm: row.track.bpm ?? null,
			isrc: row.track.isrc ?? null,
			composer: row.track.composer ?? null
		},
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
