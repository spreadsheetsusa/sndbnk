import { error, fail } from '@sveltejs/kit';

import { safeRedirect } from '#lib/server/safe-redirect';
import {
	MAX_SITE_DESCRIPTION_LENGTH,
	MAX_SITE_NAME_LENGTH,
	SITE_INTENTS,
	canEditSite,
	completeSiteSetup,
	getOwnedSite,
	serializeSiteOwner
} from '#lib/server/site';
import { getProfileByUserId } from '#lib/server/tenant';

export const load = async ({ locals, params }) => {
	if (!locals.user) safeRedirect(302, '/signin');

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) safeRedirect(302, '/signup');

	if (!canEditSite(profile.plan)) {
		error(403, 'Site setup needs Vault or higher.');
	}

	const row = await getOwnedSite(locals.user.id, params.id);
	if (!row) error(404, 'Site not found');

	if (row.setupCompletedAt) {
		safeRedirect(303, `/sites/${row.id}/builder`);
	}

	return {
		profile: { username: profile.username },
		site: serializeSiteOwner(row),
		intents: SITE_INTENTS,
		limits: {
			siteName: MAX_SITE_NAME_LENGTH,
			siteDescription: MAX_SITE_DESCRIPTION_LENGTH
		}
	};
};

export const actions = {
	completeSetup: async ({ locals, params, request }) => {
		if (!locals.user) safeRedirect(302, '/signin');

		const profile = await getProfileByUserId(locals.user.id);
		if (!profile) safeRedirect(302, '/signup');

		const row = await getOwnedSite(locals.user.id, params.id);
		if (!row) error(404, 'Site not found');

		if (row.setupCompletedAt) {
			safeRedirect(303, `/sites/${row.id}/builder`);
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString() ?? '';
		const description = formData.get('description')?.toString() ?? '';
		const accentColor = formData.get('accentColor')?.toString() ?? '';
		const appearance = formData.get('appearance')?.toString() ?? 'light';
		const siteIntent = formData.get('siteIntent')?.toString() ?? '';
		const wantBlog = formData.get('wantBlog') === 'on';
		const wantEvents = formData.get('wantEvents') === 'on';
		const wantEcommerce = formData.get('wantEcommerce') === 'on';
		const logoField = formData.get('logo');
		const logo =
			logoField instanceof File && logoField.size > 0 ? logoField : /** @type {null} */ (null);

		const result = await completeSiteSetup({
			userId: locals.user.id,
			plan: profile.plan,
			name,
			description,
			accentColor,
			appearance,
			siteIntent,
			wantBlog,
			wantEvents,
			wantEcommerce,
			logo
		});

		if (!result.ok) {
			return fail(400, {
				message: result.message,
				name,
				description,
				accentColor,
				appearance,
				siteIntent,
				wantBlog,
				wantEvents,
				wantEcommerce
			});
		}

		safeRedirect(303, `/sites/${row.id}/builder`);
	}
};
