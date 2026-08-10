import { ORIGIN } from '$app/env/private';

import { listAcceptedPeers } from '#lib/server/account-links';
import { canRemoveBranding } from '#lib/server/billing/plans';
import { getPlatformSettings } from '#lib/server/platform-settings';
import { getSitePublic, listNavSites } from '#lib/server/site';
import { getProfileByUserId } from '#lib/server/tenant';

const siteOrigin = ORIGIN.replace(/\/$/, '');

const emptySites = {
	siteId: null,
	hosts: /** @type {Array<{ label: string, href: string }>} */ ([])
};

const emptyNav = {
	id: null,
	name: null,
	username: null,
	image: null,
	isAdmin: false,
	linkedAccounts:
		/** @type {Array<{ userId: string, username: string, name: string, image: string | null }>} */ ([]),
	sites: emptySites
};

export const load = async ({ locals }) => {
	const playThresholds = await getPlatformSettings();

	if (locals.tenant) {
		const site = await getSitePublic(locals.tenant.userId);
		return {
			siteOrigin,
			playThresholds,
			nav: emptyNav,
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
						appearance: /** @type {'light' | 'dark'} */ ('light'),
						hideBranding: false,
						updatedAt: null
					}
		};
	}

	if (!locals.user) {
		return {
			siteOrigin,
			playThresholds,
			nav: emptyNav,
			tenantSite: null
		};
	}

	const [profile, linkedAccounts] = await Promise.all([
		getProfileByUserId(locals.user.id),
		listAcceptedPeers(locals.user.id)
	]);

	const sites = await listNavSites(profile);

	return {
		siteOrigin,
		playThresholds,
		nav: {
			id: locals.user.id,
			name: locals.user.name ?? locals.user.email,
			username: profile?.username ?? null,
			image: locals.user.image ?? null,
			isAdmin: locals.user.role === 'admin',
			linkedAccounts,
			sites
		},
		tenantSite: null
	};
};
