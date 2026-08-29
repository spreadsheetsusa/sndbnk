import { error, fail } from '@sveltejs/kit';

import { loadPublicProfilePage } from '#lib/server/profile-page';
import { safeRedirect } from '#lib/server/safe-redirect';
import { canEditSite, ensureSiteChrome, getOwnedSite } from '#lib/server/site';
import {
	createSitePage,
	deleteSitePage,
	ensureRootPage,
	listSitePages,
	updatePageProps
} from '#lib/server/site-pages';
import { getProfileByUserId } from '#lib/server/tenant';

export const load = async ({ locals, params, url }) => {
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
	const catalog = await loadPublicProfilePage({ username: profile.username, locals, url });

	return {
		site: siteOwner,
		pages,
		currentPageId: root.id,
		profileCatalog: catalog
	};
};

export const actions = {
	createPage: async ({ locals, params, request }) => {
		if (!locals.user) safeRedirect(302, '/signin');

		const profile = await getProfileByUserId(locals.user.id);
		if (!profile) safeRedirect(302, '/signup');
		if (!canEditSite(profile.plan)) {
			return fail(403, { pagesMessage: 'Site builder needs Vault or higher.' });
		}

		const row = await getOwnedSite(locals.user.id, params.id);
		if (!row) error(404, 'Site not found');
		const form = await request.formData();
		const title = form.get('title')?.toString() ?? '';
		const slug = form.get('slug')?.toString() ?? '';
		const result = await createSitePage({
			userId: locals.user.id,
			siteId: row.id,
			title,
			slug
		});

		if (!result.ok) return fail(400, { pagesMessage: result.message, title, slug });
		return { pagesSuccess: 'Page created.', createdPageId: result.page.id };
	},

	deletePage: async ({ locals, params, request }) => {
		if (!locals.user) safeRedirect(302, '/signin');

		const profile = await getProfileByUserId(locals.user.id);
		if (!profile) safeRedirect(302, '/signup');
		if (!canEditSite(profile.plan)) {
			return fail(403, { pagesMessage: 'Site builder needs Vault or higher.' });
		}

		const row = await getOwnedSite(locals.user.id, params.id);
		if (!row) error(404, 'Site not found');
		const form = await request.formData();
		const pageId = form.get('pageId')?.toString() ?? '';
		const result = await deleteSitePage({
			userId: locals.user.id,
			siteId: row.id,
			pageId
		});

		if (!result.ok) return fail(400, { pagesMessage: result.message });
		return { pagesSuccess: 'Page deleted.', deletedPageId: pageId };
	},

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
