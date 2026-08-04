import { error, json } from '@sveltejs/kit';

import { recordTrackPlay } from '#lib/server/listens';
import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { isTenantResourceAllowed } from '#lib/server/tenant';
import { getTrackById } from '#lib/server/tracks';

export async function POST({ locals, params, request, url }) {
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const row = await getTrackById(params.id);
	if (!row || !isTenantResourceAllowed(locals, row.userId)) {
		error(404, 'Track not found');
	}

	const result = await recordTrackPlay(row.id, { userId: locals.user?.id ?? null });
	if (!result.ok) error(result.status ?? 400, result.message);

	return json({ playCount: result.playCount });
}
