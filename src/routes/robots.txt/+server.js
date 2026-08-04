import { ORIGIN } from '$app/env/private';

const DISALLOW = [
	'/feed',
	'/library',
	'/settings',
	'/signin',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/admin',
	'/billing',
	'/playlists/new'
];

export const GET = () => {
	const origin = ORIGIN.replace(/\/$/, '');
	const body = [
		'User-agent: *',
		...DISALLOW.map((path) => `Disallow: ${path}`),
		'',
		`Sitemap: ${origin}/sitemap.xml`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'max-age=3600'
		}
	});
};
