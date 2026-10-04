/**
 * Source URL for the player element.
 *
 * A public media host is often a different origin from the page — a custom
 * domain especially. Phones will play that cross-origin element in the
 * foreground, then drop it when the app is backgrounded, because the captured
 * media is not owned by the document. On those devices the same-origin
 * `/api/media` proxy is the source the playback session can keep alive.
 * Desktop keeps the public URL so byte traffic stays on that host.
 */

/**
 * @param {{ userAgent?: string, platform?: string, maxTouchPoints?: number } | null | undefined} [nav]
 * @returns {boolean}
 */
export function prefersDocumentOriginPlayback(nav = globalThis.navigator) {
	if (!nav) return false;
	const ua = nav.userAgent || '';
	if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
	// iPadOS reports a desktop Macintosh UA and gives itself away with touch.
	return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/**
 * @param {string} trackId
 * @param {string | null | undefined} audioUrl
 * @param {string} pageHref
 * @param {boolean} [documentOrigin]
 * @returns {string}
 */
export function playbackSrc(trackId, audioUrl, pageHref, documentOrigin = false) {
	const page = new URL(pageHref);
	const proxy = new URL(`/api/media/${trackId}/audio`, page).href;
	const raw = typeof audioUrl === 'string' ? audioUrl.trim() : '';
	if (!raw) return proxy;

	let url;
	try {
		url = new URL(raw, page);
	} catch {
		return proxy;
	}

	if (documentOrigin && url.origin !== page.origin) return proxy;
	return url.href;
}
