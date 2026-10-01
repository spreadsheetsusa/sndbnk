/** @typedef {'cover' | 'contain' | 'auto' | 'tile'} BackgroundSize */
/** @typedef {'center' | 'top' | 'bottom' | 'left' | 'right'} BackgroundPosition */
/** @typedef {'scroll' | 'fixed'} BackgroundAttachment */

/**
 * Shared by the site-wide background and a future per-page override.
 * `trackId` null means no image. Display fields still describe how the next image paints.
 * @typedef {{
 *   trackId: string | null,
 *   size: BackgroundSize,
 *   position: BackgroundPosition,
 *   attachment: BackgroundAttachment
 * }} SiteBackground
 */

export const BACKGROUND_SIZES = /** @type {const} */ (['cover', 'contain', 'auto', 'tile']);
export const BACKGROUND_POSITIONS = /** @type {const} */ ([
	'center',
	'top',
	'bottom',
	'left',
	'right'
]);
export const BACKGROUND_ATTACHMENTS = /** @type {const} */ (['scroll', 'fixed']);

/** @type {Record<BackgroundSize, string>} */
export const BACKGROUND_SIZE_LABELS = {
	cover: 'Cover',
	contain: 'Contain',
	auto: 'Auto',
	tile: 'Tile'
};

/** @type {Record<BackgroundPosition, string>} */
export const BACKGROUND_POSITION_LABELS = {
	center: 'Center',
	top: 'Top',
	bottom: 'Bottom',
	left: 'Left',
	right: 'Right'
};

/** @type {Record<BackgroundAttachment, string>} */
export const BACKGROUND_ATTACHMENT_LABELS = {
	scroll: 'Scroll',
	fixed: 'Fixed'
};

/** @type {SiteBackground} */
export const EMPTY_BACKGROUND = {
	trackId: null,
	size: 'cover',
	position: 'center',
	attachment: 'scroll'
};

/**
 * Page image wins when it has one. Otherwise the site-wide image.
 * @param {SiteBackground | null | undefined} global
 * @param {SiteBackground | null | undefined} page
 * @returns {SiteBackground | null}
 */
export function resolveBackground(global, page) {
	if (page?.trackId) return page;
	if (global?.trackId) return global;
	return null;
}

/**
 * @param {unknown} raw
 * @returns {SiteBackground | null}
 */
export function parseSiteBackground(raw) {
	/** @type {unknown} */
	let value = raw;
	if (typeof raw === 'string') {
		if (!raw.trim()) return null;
		try {
			value = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!value || typeof value !== 'object') return null;
	const record = /** @type {Record<string, unknown>} */ (value);
	const trackId = typeof record.trackId === 'string' && record.trackId ? record.trackId : null;
	if (!trackId) return null;
	return {
		trackId,
		size: BACKGROUND_SIZES.includes(/** @type {BackgroundSize} */ (record.size))
			? /** @type {BackgroundSize} */ (record.size)
			: 'cover',
		position: BACKGROUND_POSITIONS.includes(/** @type {BackgroundPosition} */ (record.position))
			? /** @type {BackgroundPosition} */ (record.position)
			: 'center',
		attachment: BACKGROUND_ATTACHMENTS.includes(
			/** @type {BackgroundAttachment} */ (record.attachment)
		)
			? /** @type {BackgroundAttachment} */ (record.attachment)
			: 'scroll'
	};
}

/**
 * @param {unknown} input
 * @returns {{ ok: true, background: SiteBackground | null } | { ok: false, message: string }}
 */
export function normalizeSiteBackground(input) {
	if (!input || typeof input !== 'object') {
		return { ok: true, background: null };
	}
	const record = /** @type {Record<string, unknown>} */ (input);
	const rawId = record.trackId;
	if (rawId == null || rawId === '') return { ok: true, background: null };
	const trackId = rawId.toString().trim();
	if (!trackId) return { ok: true, background: null };
	const size = record.size?.toString() ?? '';
	const position = record.position?.toString() ?? '';
	const attachment = record.attachment?.toString() ?? '';
	if (!BACKGROUND_SIZES.includes(/** @type {BackgroundSize} */ (size))) {
		return { ok: false, message: 'Background size must be cover, contain, auto, or tile.' };
	}
	if (!BACKGROUND_POSITIONS.includes(/** @type {BackgroundPosition} */ (position))) {
		return {
			ok: false,
			message: 'Background position must be center, top, bottom, left, or right.'
		};
	}
	if (!BACKGROUND_ATTACHMENTS.includes(/** @type {BackgroundAttachment} */ (attachment))) {
		return { ok: false, message: 'Background attachment must be scroll or fixed.' };
	}
	return {
		ok: true,
		background: {
			trackId,
			size: /** @type {BackgroundSize} */ (size),
			position: /** @type {BackgroundPosition} */ (position),
			attachment: /** @type {BackgroundAttachment} */ (attachment)
		}
	};
}

/**
 * Longhand background declarations. Empty when there is no image URL.
 * @param {SiteBackground | null | undefined} background
 * @param {string | null | undefined} imageUrl
 */
export function backgroundStyle(background, imageUrl) {
	const url = imageUrl?.trim() ?? '';
	if (!background?.trackId || !url) return '';
	const size =
		background.size === 'cover' ? 'cover' : background.size === 'contain' ? 'contain' : 'auto';
	const repeat = background.size === 'tile' ? 'repeat' : 'no-repeat';
	const position = {
		center: 'center center',
		top: 'center top',
		bottom: 'center bottom',
		left: 'left center',
		right: 'right center'
	}[background.position];
	const attachment = background.attachment === 'fixed' ? 'fixed' : 'scroll';
	const safeUrl = url.replace(/["\\()]/g, '');
	return `background-image:url("${safeUrl}");background-repeat:${repeat};background-size:${size};background-position:${position};background-attachment:${attachment}`;
}
