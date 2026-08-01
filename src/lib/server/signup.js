import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';

import { auth } from '#lib/server/auth';
import { db } from '#lib/server/db';
import { profile } from '#lib/server/db/schema';
import { sendWelcomeMail } from '#lib/server/mail/templates';
import { validateUsername } from '#lib/server/username';

/**
 * Create a better-auth user plus its profile row, signed in on the returned
 * headers. Shared by `/signup` and the inline signup on `/plans`, which must not
 * drift — new accounts always start on Basic and upgrade through Stripe.
 *
 * @param {{ name: string, username: string, email: string, password: string, headers: Headers }} input
 * @returns {Promise<{ ok: true, userId: string, username: string } | { ok: false, message: string }>}
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
		signedUp = await auth.api.signUpEmail({ body: { name, email, password }, headers });
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
		return {
			ok: false,
			message: 'Account created but we could not reserve your username. Try settings after sign-in.'
		};
	}

	await sendWelcomeMail({ to: email, name, username });

	return { ok: true, userId, username };
}
