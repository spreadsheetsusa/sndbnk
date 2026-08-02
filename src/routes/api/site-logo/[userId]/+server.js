import { error } from '@sveltejs/kit';

import { SITE_LOGO_FOLDER_KEY, getSiteLogoRecord } from '#lib/server/site';
import { createLocalAdapter } from '#lib/server/storage/local.js';

export async function GET({ params, setHeaders }) {
	const record = await getSiteLogoRecord(params.userId);
	if (!record?.logoFilename) {
		error(404, 'Not found');
	}

	try {
		const object = await createLocalAdapter(params.userId).get(
			SITE_LOGO_FOLDER_KEY,
			record.logoFilename
		);

		setHeaders({
			'cache-control': 'public, max-age=31536000, immutable'
		});

		return new Response(/** @type {BodyInit} */ (object.body), {
			headers: {
				'content-type': record.logoMime || object.contentType,
				'content-length': String(object.size)
			}
		});
	} catch {
		error(404, 'Not found');
	}
}
