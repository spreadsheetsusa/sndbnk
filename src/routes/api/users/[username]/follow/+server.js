import { error, json } from '@sveltejs/kit';

import { toggleFollow } from '#lib/server/social';
import { getProfileByUsername } from '#lib/server/tenant';
import { normalizeUsername } from '#lib/server/username';

export async function POST({ locals, params }) {
	if (!locals.user) {
		error(401, 'Sign in to follow creators.');
	}

	const row = await getProfileByUsername(normalizeUsername(params.username ?? ''));
	if (!row) {
		error(404, 'Profile not found');
	}

	const result = await toggleFollow(locals.user.id, row.userId);
	if (!result.ok) {
		error(400, result.message);
	}

	return json({ following: result.following, followerCount: result.followerCount });
}
