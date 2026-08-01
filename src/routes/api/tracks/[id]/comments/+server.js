import { error, json } from '@sveltejs/kit';

import { db } from '#lib/server/db';
import { trackComment } from '#lib/server/db/schema';
import { getTrackById } from '#lib/server/tracks';

const BODY_MAX_LENGTH = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST({ locals, params, request }) {
	if (!locals.user) {
		error(401, 'Sign in to comment.');
	}

	const row = await getTrackById(params.id);
	if (!row) {
		error(404, 'Track not found');
	}

	/** @type {{ body?: unknown, atMs?: unknown }} */
	let payload;
	try {
		payload = await request.json();
	} catch {
		error(400, 'Invalid request body');
	}

	const body = typeof payload.body === 'string' ? payload.body.trim() : '';
	if (!body) {
		error(400, 'Comment cannot be empty.');
	}
	if (body.length > BODY_MAX_LENGTH) {
		error(400, `Comment must be ${BODY_MAX_LENGTH} characters or fewer.`);
	}

	/** @type {number | null} */
	let atMs = null;
	if (typeof payload.atMs === 'number' && Number.isFinite(payload.atMs)) {
		atMs = Math.max(0, Math.min(Math.round(payload.atMs), row.durationMs ?? DAY_MS));
	}

	const id = crypto.randomUUID();
	const createdAt = new Date();

	await db.insert(trackComment).values({
		id,
		trackId: row.id,
		userId: locals.user.id,
		body,
		atMs,
		createdAt
	});

	return json({
		comment: {
			id,
			body,
			atMs,
			createdAt: createdAt.getTime(),
			userId: locals.user.id,
			userName: locals.user.name ?? 'You',
			userImage: locals.user.image ?? null
		}
	});
}
