import { redirect } from '@sveltejs/kit';

import { auth } from '#lib/server/auth';

export const load = ({ cookies, locals }) => {
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

	return { user: locals.user ?? null, authNotice };
};

export const actions = {
	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		return redirect(303, '/');
	}
};
