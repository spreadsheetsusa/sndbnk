import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';
import { PUBLIC_BASE_DOMAIN } from '$app/env/public';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db';

const isLocalBase = PUBLIC_BASE_DOMAIN === 'localhost' || PUBLIC_BASE_DOMAIN === '127.0.0.1';

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: { enabled: true },
	// Apex + www (Caddy redirects www, but preflight/origin checks can still see it).
	trustedOrigins: [
		'https://sndbnk.com',
		'https://www.sndbnk.com',
		'http://localhost:5174',
		'http://127.0.0.1:5174'
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
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
