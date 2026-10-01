import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { canEditSite, getOwnedSite } from '#lib/server/site';
import { createSiteMedia, listSiteMedia } from '#lib/server/site-media';
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

export async function GET({ locals, params }) {
	const { siteRow } = await ownedEditableSite(locals, params.id);
	const items = await listSiteMedia(siteRow.id);
	return json({ items });
}

export async function POST({ locals, params, request, url }) {
	if (!isTrustedMutationRequest(request, url)) error(403, 'Invalid request origin.');
	const { profile, siteRow, userId } = await ownedEditableSite(locals, params.id);

	let form;
	try {
		form = await request.formData();
	} catch {
		error(400, 'Upload a file.');
	}

	const file = form.get('file');
	if (!(file instanceof File)) error(400, 'Choose an image or video to upload.');

	const result = await createSiteMedia({
		userId,
		plan: profile.plan,
		siteId: siteRow.id,
		file
	});
	if (!result.ok) error(400, result.message);
	return json({ item: result.item });
}
