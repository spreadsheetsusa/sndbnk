import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { canEditSite, getOwnedSite } from '#lib/server/site';
import { deleteSiteMedia, renameSiteMedia } from '#lib/server/site-media';
import { getProfileByUserId } from '#lib/server/tenant';

/**
 * @param {App.Locals} locals
 * @param {string} siteId
 */
async function ownedEditableSite(locals, siteId) {
	if (!locals.user) error(401, 'Sign in to manage site media.');
	const profile = await getProfileByUserId(locals.user.id);
	if (!profile || !canEditSite(profile.plan)) {
		error(403, 'Site builder needs Vault or higher.');
	}
	const siteRow = await getOwnedSite(locals.user.id, siteId);
	if (!siteRow) error(404, 'Site not found');
	return { profile, siteRow, userId: locals.user.id };
}

export async function PATCH({ locals, params, request, url }) {
	if (!isTrustedMutationRequest(request, url)) error(403, 'Invalid request origin.');
	const { profile, siteRow, userId } = await ownedEditableSite(locals, params.id);

	let body;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body.');
	}

	const result = await renameSiteMedia({
		userId,
		plan: profile.plan,
		siteId: siteRow.id,
		assetId: params.assetId,
		name: body?.name?.toString() ?? ''
	});
	if (!result.ok) error(400, result.message);
	return json({ item: result.item });
}

export async function DELETE({ locals, params, request, url }) {
	if (!isTrustedMutationRequest(request, url)) error(403, 'Invalid request origin.');
	const { profile, siteRow, userId } = await ownedEditableSite(locals, params.id);

	const result = await deleteSiteMedia({
		userId,
		plan: profile.plan,
		siteId: siteRow.id,
		assetId: params.assetId
	});
	if (!result.ok) error(400, result.message);
	return json({ id: result.id });
}
