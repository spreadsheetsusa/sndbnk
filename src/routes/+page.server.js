import { redirect } from '@sveltejs/kit';

import { auth } from '#lib/server/auth';

export const load = ({ locals }) => {
	return { user: locals.user ?? null };
};

export const actions = {
	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		return redirect(303, '/');
	}
};
