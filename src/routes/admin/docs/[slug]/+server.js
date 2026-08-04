import { error } from '@sveltejs/kit';
import { join } from 'node:path';
import { requireAdmin } from '#lib/server/admin';

/** @type {Record<string, string>} */
const DOCS = {
	'business-plan': 'business-plan.html',
	'business-finance': 'business-finance.html',
	'drizzle-migrations': 'drizzle-migrations.html'
};

/**
 * @param {string} slug
 */
function resolveDocFile(slug) {
	const key = slug.replace(/\.html$/i, '');
	return DOCS[key] ?? null;
}

/** @type {import('./$types').RequestHandler} */
export const GET = async ({ locals, params }) => {
	requireAdmin(locals);

	const file = resolveDocFile(params.slug);
	if (!file) error(404, 'Not found.');

	const path = join(process.cwd(), 'docs', file);
	const bunFile = Bun.file(path);
	if (!(await bunFile.exists())) error(404, 'Not found.');

	return new Response(bunFile, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'private, no-store',
			'X-Robots-Tag': 'noindex, nofollow'
		}
	});
};
