import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';

import { auth } from '#lib/server/auth';
import { db } from '#lib/server/db';
import { profile } from '#lib/server/db/schema';
import { safeRedirect } from '#lib/server/safe-redirect';
import { validateUsername } from '#lib/server/username';

export const load = ({ locals }) => {
	if (locals.user) {
		safeRedirect(302, '/');
	}
};

export const actions = {
	default: async ({ cookies, request, url }) => {
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const usernameRaw = formData.get('username')?.toString() ?? '';
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		const usernameResult = validateUsername(usernameRaw);

		if (!name || !email || !password || !usernameResult.ok) {
			return fail(400, {
				message: !usernameResult.ok
					? usernameResult.message
					: 'Complete all fields to continue.',
				name,
				username: usernameRaw.trim(),
				email
			});
		}

		const { username } = usernameResult;

		const existing = await db
			.select({ userId: profile.userId })
			.from(profile)
			.where(eq(profile.username, username))
			.limit(1);

		if (existing.length > 0) {
			return fail(400, {
				message: 'That username is already taken.',
				name,
				username,
				email
			});
		}

		/** @type {{ user: { id: string } } | null} */
		let signedUp = null;

		try {
			signedUp = await auth.api.signUpEmail({
				body: { name, email, password },
				headers: request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					message: error.message || 'We could not create your account.',
					name,
					username,
					email
				});
			}
			return fail(500, {
				message: 'Something went wrong. Please try again.',
				name,
				username,
				email
			});
		}

		const userId = signedUp?.user?.id;
		if (!userId) {
			return fail(500, {
				message: 'Account created but profile setup failed. Please contact support.',
				name,
				username,
				email
			});
		}

		try {
			const now = new Date();
			await db.insert(profile).values({
				userId,
				username,
				plan: 'basic',
				customDomainStatus: 'none',
				createdAt: now,
				updatedAt: now
			});
		} catch {
			return fail(500, {
				message: 'Account created but we could not reserve your username. Try settings after sign-in.',
				name,
				username,
				email
			});
		}

		cookies.set('sndbnk-auth-notice', 'account-created', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60
		});

		safeRedirect(303, '/');
	}
};
