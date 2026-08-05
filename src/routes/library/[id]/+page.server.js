import { safeRedirect } from '#lib/server/safe-redirect';

/** Former edit page — inline edit lives on `/library?track=&edit=1`. */
export const load = async ({ locals, params }) => {
	if (!locals.user) {
		safeRedirect(302, '/signin');
	}

	safeRedirect(302, `/library?track=${encodeURIComponent(params.id)}&edit=1`);
};
