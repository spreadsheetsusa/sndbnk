import { ORIGIN } from '$app/env/private';
import { eq } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { profile, track } from '#lib/server/db/schema';

/**
 * @param {string} value
 */
const escapeXml = (value) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET = async () => {
	const origin = ORIGIN.replace(/\/$/, '');

	const [profiles, tracks] = await Promise.all([
		db.select({ username: profile.username }).from(profile),
		db.select({ id: track.id }).from(track).where(eq(track.published, true))
	]);

	/** @type {string[]} */
	const locs = [
		`${origin}/`,
		`${origin}/plans`,
		`${origin}/privacy`,
		`${origin}/terms`,
		`${origin}/copyright`,
		...profiles.map((row) => `${origin}/users/${row.username}`),
		...tracks.map((row) => `${origin}/tracks/${row.id}`)
	];

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...locs.map((loc) => `  <url><loc>${escapeXml(loc)}</loc></url>`),
		'</urlset>',
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'max-age=3600'
		}
	});
};
