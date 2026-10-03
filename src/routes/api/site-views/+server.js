import { error } from '@sveltejs/kit';

import { clientIp, rateLimit } from '#lib/server/rate-limit';
import { isTrustedMutationRequest } from '#lib/server/request-origin';
import { recordNavigationView, skipNavigationView } from '#lib/server/site-analytics';

/** @param {import('@sveltejs/kit').RequestEvent} event */
export async function POST(event) {
	const { locals, request, url } = event;
	if (!isTrustedMutationRequest(request, url)) error(403, 'Invalid request origin.');

	const tenant = locals.tenant;
	if (!tenant || tenant.hostKind !== 'custom') error(404, 'Not found');
	if (skipNavigationView(request, locals.user?.id, tenant.userId)) {
		return new Response(null, { status: 204 });
	}

	const limited = rateLimit(`site-view:${tenant.userId}:${clientIp(event)}`, {
		windowMs: 60_000,
		max: 40
	});
	if (!limited.ok) {
		return new Response(null, {
			status: 429,
			headers: { 'retry-after': String(limited.retryAfterSec) }
		});
	}

	let path = '';
	try {
		const body = await request.json();
		path = typeof body?.path === 'string' ? body.path : '';
	} catch {
		error(400, 'Invalid body');
	}

	let result;
	try {
		result = await recordNavigationView(tenant.userId, path);
	} catch (err) {
		console.error('[site-analytics] navigation', err);
		return new Response(null, { status: 204 });
	}
	if (!result.ok) error(400, 'Invalid path');

	return new Response(null, { status: 204 });
}
