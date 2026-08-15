import { ORIGIN } from '$app/env/private';
import { eq, inArray } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { playlist, profile, track } from '#lib/server/db/schema';
import { trackListedCondition } from '#lib/server/tracks';

/**
 * @param {string} value
 */
const escapeXml = (value) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {Date | null | undefined} value
 */
const toLastmod = (value) => {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
};

/**
 * @param {string} loc
 * @param {Date | null | undefined} [lastmod]
 */
const urlEntry = (loc, lastmod) => {
	const iso = toLastmod(lastmod);
	return iso
		? `  <url><loc>${escapeXml(loc)}</loc><lastmod>${iso}</lastmod></url>`
		: `  <url><loc>${escapeXml(loc)}</loc></url>`;
};

export const GET = async () => {
	const origin = ORIGIN.replace(/\/$/, '');

	const [tracks, playlists] = await Promise.all([
		db
			.select({
				id: track.id,
				userId: track.userId,
				updatedAt: track.updatedAt,
				createdAt: track.createdAt
			})
			.from(track)
			.where(trackListedCondition()),
		db
			.select({
				id: playlist.id,
				userId: playlist.userId,
				updatedAt: playlist.updatedAt,
				createdAt: playlist.createdAt
			})
			.from(playlist)
			.where(eq(playlist.published, true))
	]);

	const activeUserIds = [
		...new Set([...tracks.map((r) => r.userId), ...playlists.map((r) => r.userId)])
	];
	const profiles =
		activeUserIds.length === 0
			? []
			: await db
					.select({
						username: profile.username,
						updatedAt: profile.updatedAt,
						createdAt: profile.createdAt
					})
					.from(profile)
					.where(inArray(profile.userId, activeUserIds));

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		urlEntry(`${origin}/`),
		urlEntry(`${origin}/plans`),
		urlEntry(`${origin}/privacy`),
		urlEntry(`${origin}/terms`),
		urlEntry(`${origin}/copyright`),
		...profiles.map((row) =>
			urlEntry(`${origin}/users/${row.username}`, row.updatedAt ?? row.createdAt)
		),
		...tracks.map((row) => urlEntry(`${origin}/tracks/${row.id}`, row.updatedAt ?? row.createdAt)),
		...playlists.map((row) =>
			urlEntry(`${origin}/playlists/${row.id}`, row.updatedAt ?? row.createdAt)
		),
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
