import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { profile } from '#lib/server/db/schema';
import { sendWelcomeMail } from '#lib/server/mail/templates';

/**
 * Send the welcome mail once the signup address is confirmed. Skips accounts
 * older than 48h so email-change verifications do not re-welcome veterans.
 *
 * @param {{ id: string, email: string, name: string, createdAt: Date | string | number }} user
 */
export async function sendWelcomeAfterVerification(user) {
	const createdAt = new Date(user.createdAt).getTime();
	if (!Number.isFinite(createdAt)) return;
	if (Date.now() - createdAt > 48 * 60 * 60 * 1000) return;

	const rows = await db
		.select({ username: profile.username, plan: profile.plan })
		.from(profile)
		.where(eq(profile.userId, user.id))
		.limit(1);
	const row = rows[0];
	if (!row) return;

	await sendWelcomeMail({
		to: user.email,
		name: user.name,
		username: row.username,
		planId: row.plan
	});
}
