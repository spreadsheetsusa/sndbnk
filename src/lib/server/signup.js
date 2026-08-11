import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';

import { auth } from '#lib/server/auth';
import { db } from '#lib/server/db';
import { user } from '#lib/server/db/auth.schema';
import { profile } from '#lib/server/db/schema';
import { validateUsername } from '#lib/server/username';

/**
 * Create a better-auth user plus its profile row. With
 * `requireEmailVerification`, better-auth does not open a session — the user
 * must confirm email before sign-in. Shared by `/signup` and anonymous checkout
 * on `/plans`; new accounts always start on Free.
 *
 * @param {{ name: string, username: string, email: string, password: string, headers: Headers }} input
 * @returns {Promise<
 *   | { ok: true, userId: string, username: string, pendingVerification: true }
 *   | { ok: false, message: string }
 * >}
 */
export async function createAccount({
	name: nameRaw,
	username: usernameRaw,
	email: emailRaw,
	password,
	headers
}) {
	const name = nameRaw.trim();
	const email = emailRaw.trim();
	const usernameResult = validateUsername(usernameRaw);

	if (!usernameResult.ok) return usernameResult;
	if (!name || !email || !password) {
		return { ok: false, message: 'Complete all fields to continue.' };
	}

	const { username } = usernameResult;

	const existing = await db
		.select({ userId: profile.userId })
		.from(profile)
		.where(eq(profile.username, username))
		.limit(1);

	if (existing.length > 0) {
		return { ok: false, message: 'That username is already taken.' };
	}

	/** @type {{ user: { id: string } } | null} */
	let signedUp = null;
	try {
		signedUp = await auth.api.signUpEmail({
			body: {
				name,
				email,
				password,
				callbackURL: '/?verified=1'
			},
			headers
		});
	} catch (error) {
		if (error instanceof APIError) {
			return { ok: false, message: error.message || 'We could not create your account.' };
		}
		return { ok: false, message: 'Something went wrong. Please try again.' };
	}

	const userId = signedUp?.user?.id;
	if (!userId) {
		return {
			ok: false,
			message: 'Account created but profile setup failed. Please contact support.'
		};
	}

	// requireEmailVerification returns a synthetic user for duplicate emails —
	// only continue when the id actually exists in the user table.
	const realUser = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);

	if (!realUser[0]) {
		return {
			ok: false,
			message: 'If that email is new, check your inbox for a confirmation link. Otherwise sign in.'
		};
	}

	try {
		const now = new Date();
		await db.insert(profile).values({
			userId,
			username,
			plan: 'free',
			customDomainStatus: 'none',
			createdAt: now,
			updatedAt: now
		});
	} catch {
		return {
			ok: false,
			message: 'Account created but we could not reserve your username. Try a different one.'
		};
	}

	return { ok: true, userId, username, pendingVerification: true };
}
