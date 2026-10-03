import { error, json } from '@sveltejs/kit';

import { recordTrackPlay } from '#lib/server/listens';
import { recordSitePlay } from '#lib/server/site-analytics';
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

	const tenant = locals.tenant;
	if (tenant?.hostKind === 'custom' && locals.user?.id !== tenant.userId) {
		try {
			await recordSitePlay({
				siteUserId: tenant.userId,
				trackId: row.id,
				listenerUserId: locals.user?.id ?? null
			});
		} catch (err) {
			console.error('[site-analytics] play', err);
		}
	}

	return json({ playCount: result.playCount });
}
