import { resolveBackground } from '#lib/builder/site-background.js';
import { canRemoveBranding } from '#lib/server/billing/plans';
import { loadPublicProfilePage } from '#lib/server/profile-page';
import {
	ensureSiteChrome,
	ensureSiteRow,
	getSitePublic,
	resolvePickedImageUrl
} from '#lib/server/site';
import { ensureRootPage, getSitePageByPath } from '#lib/server/site-pages';
import { loadStreamFacets, loadStreamSeeds } from '#lib/server/stream-blocks';

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
		? await resolvePickedImageUrl(locals.tenant.userId, row.id, background.trackId)
		: null;

	const needsCatalog = page.blocks.some(
		(block) =>
			block.hidden !== true && (block.type === 'catalog.profile' || block.type === 'catalog.stream')
	);
	const catalog = needsCatalog
		? await loadPublicProfilePage({
				username: locals.tenant.username,
				locals,
				url
			})
		: null;

	const [streamPages, streamFacets] = await Promise.all([
		loadStreamSeeds(locals.tenant.userId, page.blocks, locals),
		loadStreamFacets(locals.tenant.userId, page.blocks, locals)
	]);

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
		streamPages,
		streamFacets,
		siteOrigin: url.origin
	};
}
