import { error } from '@sveltejs/kit';

import { loadTenantSitePage } from '#lib/server/site-page-public';
import { getPublicOrigin } from '#lib/server/tenant';

export const load = async (event) => {
	const { locals, params, url } = event;
	if (!locals.tenant) error(404, 'Page not found');

	const path = `/${params.path?.replace(/^\/+|\/+$/g, '') ?? ''}`;
	const sitePage = await loadTenantSitePage({
		locals,
		url,
		path,
		origin: getPublicOrigin(event)
	});
	if (!sitePage) error(404, 'Site page not found');
	return sitePage;
};
