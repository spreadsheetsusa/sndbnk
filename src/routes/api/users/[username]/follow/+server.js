import { error, json } from '@sveltejs/kit';

import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { toggleFollow } from '#lib/server/social';
import { getProfileByUsername, isTenantUsernameAllowed } from '#lib/server/tenant';
import { normalizeUsername } from '#lib/server/username';

export async function POST({ locals, params, request, url }) {
	if (!locals.user) {
		error(401, 'Sign in to follow creators.');
	}
	if (!isTrustedMutationRequest(request, url)) {
		error(403, 'Invalid request origin.');
	}

	const username = normalizeUsername(params.username ?? '');
	if (!isTenantUsernameAllowed(locals, username)) {
		error(404, 'Profile not found');
	}

	const row = await getProfileByUsername(username);
	if (!row) {
		error(404, 'Profile not found');
	}

	const result = await toggleFollow(locals.user.id, row.userId);
	if (!result.ok) {
		error(400, result.message);
	}

	return json({ following: result.following, followerCount: result.followerCount });
}
