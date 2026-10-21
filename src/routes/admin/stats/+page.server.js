import { getAdminSystemStats } from '#lib/server/admin-stats';
import { requireAdmin } from '#lib/server/admin';

export const load = async ({ locals }) => {
	requireAdmin(locals);
	return getAdminSystemStats();
};
