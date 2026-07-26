import { buildPublicUrls, getProfileByUsername } from '#lib/server/tenant';
import { normalizeUsername } from '#lib/server/username';

/**
 * Shared loader data for public profile surfaces (path URL + tenant hosts).
 * @param {{ username: string, locals: App.Locals }} input
 */
export async function loadPublicProfilePage({ username, locals }) {
	const normalized = normalizeUsername(username);
	const row = await getProfileByUsername(normalized);

	if (!row) {
		return null;
	}

	const urls = buildPublicUrls(row);
	const viaTenantHost = Boolean(locals.tenant);

	return {
		profile: {
			username: row.username,
			name: row.name,
			plan: row.plan,
			customDomain: row.customDomain,
			customDomainStatus: row.customDomainStatus
		},
		urls,
		viaTenantHost,
		viewer: locals.user
			? {
					id: locals.user.id,
					isOwner: locals.user.id === row.userId
				}
			: null
	};
}
