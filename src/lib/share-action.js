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
 * `clipboard.writeText` only exists in a secure context. Copy from a textarea
 * in the same turn as the click so an http custom-domain host still confirms.
 * @param {string} url
 */
function copyWithTextarea(url) {
	const doc = globalThis.document;
	if (!doc?.body) return false;
	const input = doc.createElement('textarea');
	input.value = url;
	input.setAttribute('readonly', '');
	input.style.position = 'fixed';
	input.style.top = '0';
	input.style.left = '0';
	input.style.opacity = '0';
	doc.body.appendChild(input);
	input.focus();
	input.select();
	let ok = false;
	try {
		ok = doc.execCommand('copy');
	} catch {
		ok = false;
	}
	input.remove();
	return ok;
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

	if (!globalThis.isSecureContext) {
		return copyWithTextarea(payload.url) ? 'copied' : 'failed';
	}

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
		return copyWithTextarea(payload.url) ? 'copied' : 'failed';
	}
}
