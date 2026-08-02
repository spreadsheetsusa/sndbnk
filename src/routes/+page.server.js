import { error } from '@sveltejs/kit';

import { auth } from '#lib/server/auth';
import { loadPublicProfilePage } from '#lib/server/profile-page';
import { safeRedirect } from '#lib/server/safe-redirect';
import { getSiteStats, listShowcaseTracks, pickHeroTrack } from '#lib/server/showcase';

export const load = async ({ cookies, locals }) => {
	if (locals.tenant) {
		const profilePage = await loadPublicProfilePage({
			username: locals.tenant.username,
			locals
		});

		if (!profilePage) {
			error(404, 'Profile not found');
		}

		return {
			mode: /** @type {const} */ ('tenant-profile'),
			...profilePage
		};
	}

	const authNoticeType = cookies.get('sndbnk-auth-notice');
	let authNotice = null;

	if (authNoticeType) {
		cookies.delete('sndbnk-auth-notice', { path: '/' });

		authNotice =
			authNoticeType === 'account-created'
				? 'Account created. Welcome to SNDBNK.'
				: authNoticeType === 'signed-in'
					? 'Signed in successfully. Welcome back.'
					: null;
	}

	const [showcase, stats, heroTrack] = await Promise.all([
		listShowcaseTracks(),
		getSiteStats(),
		pickHeroTrack(locals.user)
	]);

	return {
		mode: /** @type {const} */ ('marketing'),
		user: locals.user ?? null,
		authNotice,
		showcase,
		stats,
		heroTrack
	};
};

export const actions = {
	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		safeRedirect(303, '/');
	}
};
