import { building } from '$app/env';
import { sequence } from '@sveltejs/kit/hooks';
import { auth } from '#lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { handleSecurityHeaders } from '#lib/server/security-headers';
import { getRequestHostname, resolveTenantHost } from '#lib/server/tenant';

const APEX_ONLY_PREFIXES = [
	'/settings',
	'/signin',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/library',
	'/sites',
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
	'/api/admin',
	'/api/sites'
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
	const limited = rateLimitAuthHttp(event);
	if (limited) return limited;

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const AUTH_SIGNIN_PREFIX = '/api/auth/sign-in';
const AUTH_RESET_PATHS = ['/api/auth/request-password-reset', '/api/auth/forget-password'];
const AUTH_RESET_PREFIX = '/api/auth/reset-password';

/**
 * Rate-limit credential stuffing and reset-email spam on better-auth HTTP paths.
 * Form actions have their own limits; this covers direct `/api/auth/*` POSTs.
 * Loopback is skipped so the deploy smoke probe cannot 429.
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @returns {Response | null}
 */
function rateLimitAuthHttp(event) {
	if (event.request.method !== 'POST') return null;

	const path = event.url.pathname;
	const isSignIn = path === AUTH_SIGNIN_PREFIX || path.startsWith(`${AUTH_SIGNIN_PREFIX}/`);
	const isReset =
		path === AUTH_RESET_PREFIX ||
		path.startsWith(`${AUTH_RESET_PREFIX}/`) ||
		AUTH_RESET_PATHS.includes(path);
	if (!isSignIn && !isReset) return null;

	const ip = clientIp(event);
	if (isLoopbackIp(ip)) return null;

	const limited = isSignIn
		? rateLimit(`auth-signin:${ip}`, { windowMs: 10 * 60 * 1000, max: 20 })
		: rateLimit(`auth-reset:${ip}`, { windowMs: 60 * 60 * 1000, max: 5 });
	if (limited.ok) return null;

	return new Response(JSON.stringify({ message: 'Too many attempts. Try again later.' }), {
		status: 429,
		headers: {
			'content-type': 'application/json',
			'retry-after': String(limited.retryAfterSec)
		}
	});
}

/**
 * @param {string} ip
 */
function isLoopbackIp(ip) {
	return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
}

/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({ error, event, status, message }) {
	const detail = error instanceof Error ? error.message : String(error);
	console.error(`[error] ${status} ${event.url.pathname}: ${detail}`);
	return { message };
}

export const handle = sequence(handleTenant, handleBetterAuth, handleSecurityHeaders);
