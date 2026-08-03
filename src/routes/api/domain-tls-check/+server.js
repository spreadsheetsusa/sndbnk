import { PUBLIC_BASE_DOMAIN } from '$app/env/public';

import { canUseCustomDomain, canUseSubdomain } from '#lib/server/billing/plans';
import { customDomainMatches } from '#lib/server/domain-verify';
import { classifyHost, getProfileByCustomDomain, getProfileByUsername } from '#lib/server/tenant';

/**
 * Caddy on_demand_tls ask endpoint (loopback only).
 * Returns 200 only when the hostname is an allowed entitled tenant host.
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, getClientAddress, request }) {
	if (!isLoopbackAsk(request, getClientAddress)) {
		return new Response('Not Found', { status: 404 });
	}

	const domain = url.searchParams.get('domain')?.trim().toLowerCase() ?? '';

	if (!domain) {
		return new Response('missing domain', { status: 400 });
	}

	const classified = classifyHost(domain, PUBLIC_BASE_DOMAIN);

	if (classified === 'apex') {
		return new Response('apex uses managed certs', { status: 400 });
	}

	if (classified.kind === 'subdomain') {
		const row = await getProfileByUsername(classified.username);
		if (row && canUseSubdomain(row.plan)) {
			return new Response('ok', { status: 200 });
		}
		return new Response('unknown subdomain', { status: 400 });
	}

	const row = await getProfileByCustomDomain(classified.hostname);
	if (
		row &&
		canUseCustomDomain(row.plan) &&
		row.customDomainStatus === 'active' &&
		customDomainMatches(row.customDomain, classified.hostname)
	) {
		return new Response('ok', { status: 200 });
	}

	return new Response('domain not allowed', { status: 400 });
}

/**
 * Caddy asks over a direct loopback connection (no reverse-proxy headers).
 * Public probes arrive via the proxy with X-Real-IP / X-Forwarded-For.
 * @param {Request} request
 * @param {() => string} getClientAddress
 */
function isLoopbackAsk(request, getClientAddress) {
	if (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')) {
		return false;
	}
	try {
		const addr = getClientAddress();
		return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
	} catch {
		return false;
	}
}
