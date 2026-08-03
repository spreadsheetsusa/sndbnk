import { error } from '@sveltejs/kit';

import { AVATAR_FOLDER_KEY, getAvatarRecord } from '#lib/server/avatar';
import { createLocalAdapter } from '#lib/server/storage/local.js';

export async function GET({ params, setHeaders }) {
	// Public read: avatars appear on public profiles, tracks, and comments.
	const record = await getAvatarRecord(params.userId);
	if (!record?.avatarFilename) {
		error(404, 'Not found');
	}

	try {
		const object = await createLocalAdapter(params.userId).get(
			AVATAR_FOLDER_KEY,
			record.avatarFilename
		);

		setHeaders({
			// Safe to cache hard: the URL carries a `?v=` stamp that changes on upload.
			'cache-control': 'public, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		});

		return new Response(/** @type {BodyInit} */ (object.body), {
			headers: {
				'content-type': record.avatarMime || object.contentType,
				'content-length': String(object.size)
			}
		});
	} catch {
		error(404, 'Not found');
	}
}
