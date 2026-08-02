import { building } from '$app/env';
import { sequence } from '@sveltejs/kit/hooks';
import { auth } from '#lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getRequestHostname, resolveTenantHost } from '#lib/server/tenant';

const APEX_ONLY_PREFIXES = [
	'/settings',
	'/signin',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/library',
	'/plans',
	'/privacy',
	'/terms',
	'/copyright',
	'/billing',
	'/admin',
	'/sitemap.xml',
	'/api/domain-tls-check',
	'/api/billing',
	'/api/stripe',
	'/api/admin'
];

/**
 * Paths that resolve normally on tenant hosts (public playback surfaces).
 */
const TENANT_ALLOWED_PREFIXES = [
	'/tracks',
	'/playlists',
	'/api/media',
	'/api/avatar',
	'/api/site-logo',
	'/api/site-og',
	'/api/tracks',
	'/api/playlists',
	'/api/users'
];

/**
 * Paths that should not be rewritten on tenant hosts (framework/assets/auth API).
 * @param {string} pathname
 */
function isPassthroughPath(pathname) {
	return (
		pathname.startsWith('/_app') ||
		pathname.startsWith('/api/auth') ||
		pathname === '/favicon.png' ||
		pathname === '/favicon.ico' ||
		pathname === '/robots.txt'
	);
}

/** @type {import('@sveltejs/kit').Handle} */
const handleTenant = async ({ event, resolve }) => {
	if (building) {
		return resolve(event);
	}

	const hostname = getRequestHostname(event);
	const outcome = await resolveTenantHost(hostname);

	if (outcome.type === 'apex') {
		return resolve(event);
	}

	if (outcome.type === 'not_found') {
		return new Response('Not Found', {
			status: 404,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}

	if (outcome.type === 'redirect') {
		return Response.redirect(outcome.location, 302);
	}

	// Tenant host: public profile is served from `/` (see root +page).
	event.locals.tenant = outcome.tenant;

	const { pathname } = event.url;

	if (isPassthroughPath(pathname)) {
		return resolve(event);
	}

	if (
		APEX_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
	) {
		return new Response('Not Found', {
			status: 404,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}

	if (pathname === '/') {
		return resolve(event);
	}

	if (
		TENANT_ALLOWED_PREFIXES.some(
			(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
		)
	) {
		return resolve(event);
	}

	// Canonicalize profile path URLs on tenant hosts back to `/`.
	if (pathname === `/users/${outcome.tenant.username}`) {
		return Response.redirect(`${event.url.protocol}//${event.url.host}/`, 302);
	}

	return new Response('Not Found', {
		status: 404,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
};

/** @type {import('@sveltejs/kit').Handle} */
const handleBetterAuth = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle = sequence(handleTenant, handleBetterAuth);
