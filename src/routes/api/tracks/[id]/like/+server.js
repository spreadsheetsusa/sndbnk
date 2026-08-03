import { error, json } from '@sveltejs/kit';
import { and, count, eq } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { trackLike } from '#lib/server/db/schema';
import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { isTenantResourceAllowed } from '#lib/server/tenant';
import { canViewTrack, getTrackById } from '#lib/server/tracks';

export async function POST({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Sign in to like tracks.');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId) || !canViewTrack(row, locals.user.id)) {
		error(404, 'Track not found');
	}

	const userId = locals.user.id;
	const existing = await db
		.select({ trackId: trackLike.trackId })
		.from(trackLike)
		.where(and(eq(trackLike.trackId, row.id), eq(trackLike.userId, userId)))
		.limit(1);

	let liked;
	if (existing.length > 0) {
		await db
			.delete(trackLike)
			.where(and(eq(trackLike.trackId, row.id), eq(trackLike.userId, userId)));
		liked = false;
	} else {
		await db.insert(trackLike).values({ trackId: row.id, userId });
		liked = true;
	}

	const [{ n: likeCount }] = await db
		.select({ n: count() })
		.from(trackLike)
		.where(eq(trackLike.trackId, row.id));

	return json({ liked, likeCount });
}
