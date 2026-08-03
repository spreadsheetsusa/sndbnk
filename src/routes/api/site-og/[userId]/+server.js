import { error } from '@sveltejs/kit';

import { SITE_OG_FOLDER_KEY, getSiteOgRecord } from '#lib/server/site';
import { createLocalAdapter } from '#lib/server/storage/local.js';

export async function GET({ params, setHeaders }) {
	const record = await getSiteOgRecord(params.userId);
	if (!record?.ogImageFilename) {
		error(404, 'Not found');
	}

	try {
		const object = await createLocalAdapter(params.userId).get(
			SITE_OG_FOLDER_KEY,
			record.ogImageFilename
		);

		setHeaders({
			'cache-control': 'public, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		});

		return new Response(/** @type {BodyInit} */ (object.body), {
			headers: {
				'content-type': record.ogImageMime || object.contentType,
				'content-length': String(object.size)
			}
		});
	} catch {
		error(404, 'Not found');
	}
}
