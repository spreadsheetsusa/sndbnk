import { PUBLIC_BASE_DOMAIN } from '$app/env/public';

import { canUseCustomDomain, canUseSubdomain } from '#lib/server/plans';
import { classifyHost, getProfileByCustomDomain, getProfileByUsername } from '#lib/server/tenant';

/**
 * Caddy on_demand_tls ask endpoint.
 * Returns 200 only when the hostname is an allowed premium tenant host.
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url }) {
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
		row.customDomain === classified.hostname
	) {
		return new Response('ok', { status: 200 });
	}

	return new Response('domain not allowed', { status: 400 });
}
