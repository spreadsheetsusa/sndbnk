import { error, fail } from '@sveltejs/kit';

import { safeRedirect } from '#lib/server/safe-redirect';
import { canEditSite, ensureSiteChrome, getOwnedSite } from '#lib/server/site';
import { ensureRootPage, listSitePages, updatePageProps } from '#lib/server/site-pages';
import { getProfileByUserId } from '#lib/server/tenant';

export const load = async ({ locals, params }) => {
	if (!locals.user) safeRedirect(302, '/signin');

	const profile = await getProfileByUserId(locals.user.id);
	if (!profile) safeRedirect(302, '/signup');

	if (!canEditSite(profile.plan)) {
		error(403, 'Site builder needs Vault or higher.');
	}

	const row = await getOwnedSite(locals.user.id, params.id);
	if (!row) error(404, 'Site not found');

	if (!row.setupCompletedAt) {
		safeRedirect(303, `/sites/${row.id}`);
	}

	const root = await ensureRootPage(row.id);
	const siteOwner = await ensureSiteChrome(row.id);
	if (!siteOwner) error(404, 'Site not found');
	const pages = await listSitePages(row.id);

	return {
		site: siteOwner,
		pages,
		currentPageId: root.id
	};
};

export const actions = {
	updatePage: async ({ locals, params, request }) => {
		if (!locals.user) safeRedirect(302, '/signin');

		const profile = await getProfileByUserId(locals.user.id);
		if (!profile) safeRedirect(302, '/signup');

		if (!canEditSite(profile.plan)) {
			return fail(403, { pageMessage: 'Site builder needs Vault or higher.' });
		}

		const row = await getOwnedSite(locals.user.id, params.id);
		if (!row) error(404, 'Site not found');

		const form = await request.formData();
		const pageId = form.get('pageId')?.toString() ?? '';
		const title = form.get('title')?.toString() ?? '';
		const slug = form.get('slug')?.toString() ?? '';
		const seoTitle = form.get('seoTitle')?.toString() ?? '';
		const seoDescription = form.get('seoDescription')?.toString() ?? '';

		const result = await updatePageProps({
			userId: locals.user.id,
			siteId: row.id,
			pageId,
			title,
			slug,
			seoTitle,
			seoDescription
		});

		if (!result.ok) {
			return fail(400, {
				pageMessage: result.message,
				pageId,
				title,
				slug,
				seoTitle,
				seoDescription
			});
		}

		return {
			pageSuccess: 'Page saved.',
			pageId: result.page.id,
			title: result.page.title,
			slug: result.page.slug,
			seoTitle: result.page.seoTitle,
			seoDescription: result.page.seoDescription
		};
	}
};
