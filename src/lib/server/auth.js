import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';
import { PUBLIC_BASE_DOMAIN } from '$app/env/public';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { multiSession } from 'better-auth/plugins/multi-session';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { linkedAccountSwitch } from '#lib/server/auth-linked-switch';
import { syncStripeCustomerEmail } from '#lib/server/billing/customer';
import { db } from '#lib/server/db';
import { sendResetPasswordMail, sendVerifyEmailChangeMail } from '#lib/server/mail/templates';

const isLocalBase = PUBLIC_BASE_DOMAIN === 'localhost' || PUBLIC_BASE_DOMAIN === '127.0.0.1';

/**
 * @returns {string[]}
 */
function authTrustedOrigins() {
	/** @type {string[]} */
	const origins = [];
	try {
		origins.push(new URL(ORIGIN).origin);
	} catch {
		// ignore a malformed ORIGIN; other entries still apply
	}
	if (isLocalBase) {
		origins.push('http://localhost:5174', 'http://127.0.0.1:5174');
	} else {
		origins.push(`https://www.${PUBLIC_BASE_DOMAIN}`);
	}
	return [...new Set(origins)];
}

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: {
		enabled: true,
		revokeSessionsOnPasswordReset: true,
		// Fire-and-forget so timing does not leak whether the address exists.
		sendResetPassword: async ({ user, url }) => {
			void sendResetPasswordMail({ to: user.email, name: user.name, url });
		}
	},
	user: {
		changeEmail: { enabled: true }
	},
	emailVerification: {
		// Fire-and-forget so timing does not leak whether the address is new.
		sendVerificationEmail: async ({ user, url }) => {
			void sendVerifyEmailChangeMail({ to: user.email, name: user.name, url });
		},
		afterEmailVerification: async (user) => {
			await syncStripeCustomerEmail(user.id, user.email);
		}
	},
	trustedOrigins: authTrustedOrigins(),
	// Close HTTP paths that bypass app signup (profile creation) or expose
	// unused admin capabilities. Server-side auth.api.setRole / ban / unban remain.
	disabledPaths: [
		'/sign-up/email',
		'/admin/impersonate-user',
		'/admin/stop-impersonating',
		'/admin/create-user',
		'/admin/remove-user',
		'/admin/set-user-password',
		'/admin/update-user',
		'/admin/revoke-user-session',
		'/admin/revoke-user-sessions',
		'/admin/set-role',
		'/admin/ban-user',
		'/admin/unban-user',
		'/admin/list-users',
		'/admin/get-user',
		'/admin/list-user-sessions'
	],
	advanced: {
		crossSubDomainCookies: isLocalBase
			? { enabled: false }
			: {
					enabled: true,
					domain: PUBLIC_BASE_DOMAIN
				}
	},
	plugins: [
		admin(),
		multiSession({ maximumSessions: 5 }),
		linkedAccountSwitch(),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
