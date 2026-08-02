import { ORIGIN } from '$app/env/private';

import { canRemoveBranding } from '#lib/server/billing/plans';
import { getSitePublic } from '#lib/server/site';
import { getProfileByUserId } from '#lib/server/tenant';

const siteOrigin = ORIGIN.replace(/\/$/, '');

export const load = async ({ locals }) => {
	if (locals.tenant) {
		const site = await getSitePublic(locals.tenant.userId);
		return {
			siteOrigin,
			nav: { name: null, username: null, image: null, isAdmin: false },
			tenantSite: site
				? {
						...site,
						name: site.name || locals.tenant.name || locals.tenant.username,
						hideBranding: site.hideBranding && canRemoveBranding(locals.tenant.plan)
					}
				: {
						name: locals.tenant.name || locals.tenant.username,
						description: null,
						logoUrl: null,
						ogImageUrl: null,
						accentColor: null,
						hideBranding: false,
						updatedAt: null
					}
		};
	}

	if (!locals.user) {
		return {
			siteOrigin,
			nav: { name: null, username: null, image: null, isAdmin: false },
			tenantSite: null
		};
	}

	const profile = await getProfileByUserId(locals.user.id);

	return {
		siteOrigin,
		nav: {
			name: locals.user.name ?? locals.user.email,
			username: profile?.username ?? null,
			image: locals.user.image ?? null,
			isAdmin: locals.user.role === 'admin'
		},
		tenantSite: null
	};
};
