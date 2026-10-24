import { trackPath } from '#lib/track-path.js';

/**
 * Public track URL on the origin the visitor is actually on.
 * Custom domains and subdomains stay on that host.
 *
 * @param {string} origin
 * @param {{ username?: string | null, slug?: string | null, id?: string }} track
 */
export function publicTrackUrl(origin, track) {
	const base = origin.replace(/\/$/, '');
	return `${base}${trackPath(track)}`;
}

/**
 * Web Share when the browser offers it. Otherwise copy `url`.
 * A dismissed share sheet does not fall through to the clipboard.
 *
 * @param {{ title: string, text?: string, url: string }} payload
 * @returns {Promise<'shared' | 'copied' | 'aborted' | 'failed'>}
 */
export async function shareOrCopy(payload) {
	const nav = globalThis.navigator;
	if (!nav) return 'failed';

	if (typeof nav.share === 'function') {
		const data = {
			title: payload.title,
			text: payload.text || payload.title,
			url: payload.url
		};
		const allowed = typeof nav.canShare !== 'function' || nav.canShare(data);
		if (allowed) {
			try {
				await nav.share(data);
				return 'shared';
			} catch (err) {
				if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
					return 'aborted';
				}
			}
		}
	}

	try {
		await nav.clipboard.writeText(payload.url);
		return 'copied';
	} catch {
		return 'failed';
	}
}
