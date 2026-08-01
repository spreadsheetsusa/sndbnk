import { getProfileByUserId } from '#lib/server/tenant';

export const load = async ({ locals }) => {
	if (locals.tenant || !locals.user) {
		return { nav: { name: null, username: null, image: null } };
	}

	const profile = await getProfileByUserId(locals.user.id);

	return {
		nav: {
			name: locals.user.name ?? locals.user.email,
			username: profile?.username ?? null,
			image: locals.user.image ?? null
		}
	};
};
