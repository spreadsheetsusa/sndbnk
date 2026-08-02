import { ORIGIN } from '$app/env/private';

import { getProfileByUserId } from '#lib/server/tenant';

const siteOrigin = ORIGIN.replace(/\/$/, '');

export const load = async ({ locals }) => {
	if (locals.tenant || !locals.user) {
		return { siteOrigin, nav: { name: null, username: null, image: null, isAdmin: false } };
	}

	const profile = await getProfileByUserId(locals.user.id);

	return {
		siteOrigin,
		nav: {
			name: locals.user.name ?? locals.user.email,
			username: profile?.username ?? null,
			image: locals.user.image ?? null,
			isAdmin: locals.user.role === 'admin'
		}
	};
};
