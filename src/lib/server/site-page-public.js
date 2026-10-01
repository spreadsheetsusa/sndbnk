import { resolveBackground } from '#lib/builder/site-background.js';
import { canRemoveBranding } from '#lib/server/billing/plans';
import { loadPublicProfilePage } from '#lib/server/profile-page';
import { ensureSiteChrome, ensureSiteRow, getSitePublic, libraryCoverUrl } from '#lib/server/site';
import { ensureRootPage, getSitePageByPath } from '#lib/server/site-pages';

/**
 * Load one composed tenant-site page and its optional live catalog data.
 *
 * @param {{ locals: App.Locals, url: URL, path: string }} input
 */
export async function loadTenantSitePage({ locals, url, path }) {
	if (!locals.tenant) return null;

	const row = await ensureSiteRow(
		locals.tenant.userId,
		locals.tenant.name || locals.tenant.username
	);
	await ensureRootPage(row.id);

	let [site, page] = await Promise.all([
		getSitePublic(locals.tenant.userId),
		getSitePageByPath(row.id, path)
	]);
	if (site && (!site.header || !site.footer)) {
		await ensureSiteChrome(row.id);
		site = await getSitePublic(locals.tenant.userId);
	}
	if (!site || !page) return null;

	const background = resolveBackground(site.background, page.background);
	const backgroundUrl = background?.trackId
		? await libraryCoverUrl(locals.tenant.userId, background.trackId)
		: null;

	const needsCatalog = page.blocks.some(
		(block) => block.type === 'catalog.profile' || block.type === 'catalog.stream'
	);
	const catalog = needsCatalog
		? await loadPublicProfilePage({
				username: locals.tenant.username,
				locals,
				url
			})
		: null;

	return {
		mode: /** @type {const} */ ('tenant-site'),
		site: {
			...site,
			name: site.name || locals.tenant.name || locals.tenant.username,
			hideBranding: site.hideBranding && canRemoveBranding(locals.tenant.plan),
			background,
			backgroundUrl
		},
		page,
		catalog,
		siteOrigin: url.origin
	};
}
