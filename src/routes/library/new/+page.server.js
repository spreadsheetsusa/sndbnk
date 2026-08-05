import { safeRedirect } from '#lib/server/safe-redirect';

/** Former LOAD console — upload is drop/picker on `/library`. */
export const load = async () => {
	safeRedirect(302, '/library');
};
