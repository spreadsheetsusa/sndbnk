import { error } from '@sveltejs/kit';

import { loadTenantSitePage } from '#lib/server/site-page-public';

export const load = async ({ locals, params, url }) => {
	if (!locals.tenant) error(404, 'Page not found');

	const path = `/${params.path?.replace(/^\/+|\/+$/g, '') ?? ''}`;
	const sitePage = await loadTenantSitePage({ locals, url, path });
	if (!sitePage) error(404, 'Site page not found');
	return sitePage;
};
