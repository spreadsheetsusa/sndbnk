import { resolveTrackOEmbed } from '#lib/server/oembed';

/**
 * oEmbed provider for public track URLs.
 * Discovery: `<link rel="alternate" type="application/json+oembed">` on the track page.
 *
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
export async function GET(event) {
	const result = await resolveTrackOEmbed(event);
	if (!result.ok) {
		return new Response(result.message, {
			status: result.status,
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'access-control-allow-origin': '*'
			}
		});
	}

	return new Response(JSON.stringify(result.body), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'access-control-allow-origin': '*',
			'cache-control': result.priv ? 'private, no-store' : 'public, max-age=300'
		}
	});
}
