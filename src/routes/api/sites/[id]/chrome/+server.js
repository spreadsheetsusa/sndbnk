import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { canEditSite, getOwnedSite, replaceSiteChrome } from '#lib/server/site';
import { getProfileByUserId } from '#lib/server/tenant';

export async function PUT({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Sign in to edit site chrome.');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile || !canEditSite(profile.plan)) {
		error(403, 'Site builder needs Vault or higher.');
	}

	const siteRow = await getOwnedSite(locals.user.id, params.id);
	if (!siteRow) error(404, 'Site not found');

	let body;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body.');
	}

	const result = await replaceSiteChrome({
		userId: locals.user.id,
		siteId: siteRow.id,
		header: body?.header,
		footer: body?.footer
	});

	if (!result.ok) {
		error(400, result.message);
	}

	return json({
		header: result.header,
		footer: result.footer,
		updatedAt: result.updatedAt
	});
}
