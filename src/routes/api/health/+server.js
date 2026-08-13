import { error, json } from '@sveltejs/kit';

import { pingDatabase } from '#lib/server/db';

/**
 * Apex liveness: app process + SQLite. Redis/ffmpeg are fail-soft and omitted.
 * @type {import('./$types').RequestHandler}
 */
export async function GET() {
	try {
		pingDatabase();
	} catch {
		error(503, 'unhealthy');
	}
	return json({ ok: true });
}
