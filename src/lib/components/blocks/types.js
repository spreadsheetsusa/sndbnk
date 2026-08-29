import { sanitizeBlockUrlProps } from '#lib/safe-href.js';

/**
 * Server-safe allowlist of block types (no Svelte imports).
 * Keep in sync with `#lib/components/blocks/registry.js`.
 */
export const BLOCK_TYPES = [
	'header.logo-links-cta',
	'header.logo-divider-nav',
	'header.center-logo',
	'header.logo-center-nav',
	'catalog.profile',
	'hero.split-copy-image',
	'hero.centered-image',
	'hero.split-image-copy',
	'hero.split-wide-cta',
	'hero.split-image-wide-cta',
	'hero.centered-wide-cta',
	'content.four-list-columns',
	'content.four-media-cards',
	'content.six-icon-cards',
	'content.split-body-lists',
	'content.split-heading-body',
	'content.split-avatar-media',
	'content.two-media-columns',
	'content.three-media-cards',
	'cta.inline-button',
	'cta.copy-form',
	'cta.centered-three',
	'cta.eyebrow-two',
	'blog.three-media-cards',
	'blog.three-overlay-cards',
	'blog.two-text-posts',
	'blog.stacked-date-rows',
	'blog.three-text-columns',
	'contact.map-form',
	'contact.map-panel-form',
	'contact.centered-form',
	'ecommerce.eight-product-grid',
	'ecommerce.split-image-detail',
	'ecommerce.split-detail-image',
	'feature.three-icon-columns',
	'feature.three-icon-cta',
	'feature.split-media-list',
	'feature.two-icon-cards',
	'feature.three-icon-cards',
	'feature.alternating-icon-rows',
	'feature.six-chip-grid',
	'feature.four-check-columns',
	'gallery.asymmetric-tiles',
	'gallery.featured-pair',
	'gallery.six-image-grid',
	'pricing.four-tier-cards',
	'pricing.comparison-table',
	'statistic.four-inline',
	'statistic.split-stats-media',
	'statistic.four-icon-cards',
	'step.timeline-media',
	'step.tabs-media',
	'step.icon-timeline-media',
	'team.nine-avatar-cards',
	'team.four-media-rows',
	'team.eight-portrait-grid',
	'testimonial.two-quote-cards',
	'testimonial.centered-quote',
	'testimonial.three-quote-columns',
	'footer.link-columns-bar',
	'footer.link-columns-mark-bar',
	'footer.newsletter-bar',
	'footer.minimal',
	'footer.columns-newsletter-bar'
];

/** @type {Set<string>} */
export const BLOCK_TYPE_SET = new Set(BLOCK_TYPES);

export const HEADER_TYPES = /** @type {const} */ ([
	'header.logo-links-cta',
	'header.logo-divider-nav',
	'header.center-logo',
	'header.logo-center-nav'
]);

export const FOOTER_TYPES = /** @type {const} */ ([
	'footer.link-columns-bar',
	'footer.link-columns-mark-bar',
	'footer.newsletter-bar',
	'footer.minimal',
	'footer.columns-newsletter-bar'
]);

/** @type {Set<string>} */
export const HEADER_TYPE_SET = new Set(HEADER_TYPES);

/** @type {Set<string>} */
export const FOOTER_TYPE_SET = new Set(FOOTER_TYPES);

export const DEFAULT_HEADER_TYPE = 'header.logo-links-cta';
export const DEFAULT_FOOTER_TYPE = 'footer.minimal';

/** Narrowest centered body-block width on the builder artboard (~500 breakpoint). */
export const BLOCK_MIN_WIDTH_PX = 512;

/** Common centered widths the builder snaps to while resizing. */
export const BLOCK_WIDTH_BREAKPOINTS_PX = [512, 640, 768, 1024, 1280, 1536];

/** Magnetic threshold (px of width) for snapping to a breakpoint during resize. */
export const BLOCK_WIDTH_SNAP_PX = 12;

/**
 * @typedef {{
 *   maxWidth?: number
 * }} PageBlockLayout
 */

/**
 * @typedef {{
 *   id: string,
 *   type: string,
 *   props: Record<string, unknown>,
 *   layout?: PageBlockLayout
 * }} PageBlockInstance
 */

/**
 * Parse optional instance layout; drop invalid / empty shapes.
 * @param {unknown} value
 * @returns {PageBlockLayout | undefined}
 */
export function parseBlockLayout(value) {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
	const row = /** @type {Record<string, unknown>} */ (value);
	if (typeof row.maxWidth !== 'number' || !Number.isFinite(row.maxWidth)) return undefined;
	const maxWidth = Math.round(row.maxWidth);
	if (maxWidth < BLOCK_MIN_WIDTH_PX) return undefined;
	return { maxWidth };
}

/**
 * Clamp a drag/persist width between the floor and the artboard.
 * Floor collapses to artboard when the canvas is narrower than {@link BLOCK_MIN_WIDTH_PX}.
 * @param {number} width
 * @param {number} artboardWidth
 */
export function clampBlockMaxWidth(width, artboardWidth) {
	const board = Math.max(1, Math.round(artboardWidth));
	const floor = Math.min(BLOCK_MIN_WIDTH_PX, board);
	const raw = Number.isFinite(width) ? Math.round(width) : board;
	return Math.min(board, Math.max(floor, raw));
}

/**
 * Breakpoints that fit strictly inside the artboard (guides omit full-bleed board edges).
 * @param {number} artboardWidth
 * @returns {number[]}
 */
export function visibleBlockWidthBreakpoints(artboardWidth) {
	const board = Math.max(1, Math.round(artboardWidth));
	const floor = Math.min(BLOCK_MIN_WIDTH_PX, board);
	return BLOCK_WIDTH_BREAKPOINTS_PX.filter((bp) => bp >= floor && bp < board);
}

/**
 * Clamp then magnetically snap to a common breakpoint or the full artboard.
 * @param {number} width
 * @param {number} artboardWidth
 * @param {number} [snapPx]
 */
export function snapBlockMaxWidth(width, artboardWidth, snapPx = BLOCK_WIDTH_SNAP_PX) {
	const board = Math.max(1, Math.round(artboardWidth));
	const clamped = clampBlockMaxWidth(width, board);
	const threshold = Number.isFinite(snapPx) ? Math.max(0, snapPx) : BLOCK_WIDTH_SNAP_PX;
	let best = clamped;
	let bestDist = Infinity;
	for (const bp of BLOCK_WIDTH_BREAKPOINTS_PX) {
		if (bp > board) continue;
		const dist = Math.abs(clamped - bp);
		if (dist <= threshold && dist < bestDist) {
			best = bp;
			bestDist = dist;
		}
	}
	const boardDist = Math.abs(clamped - board);
	if (boardDist <= threshold && boardDist < bestDist) {
		best = board;
		bestDist = boardDist;
	}
	return clampBlockMaxWidth(best, board);
}

/**
 * Persistable layout, or `undefined` when full-artboard (default).
 * @param {number | null | undefined} maxWidth
 * @param {number} artboardWidth
 * @returns {PageBlockLayout | undefined}
 */
export function layoutFromMaxWidth(maxWidth, artboardWidth) {
	if (maxWidth == null || !Number.isFinite(maxWidth)) return undefined;
	const board = Math.max(1, Math.round(artboardWidth));
	const clamped = clampBlockMaxWidth(maxWidth, board);
	if (clamped >= board) return undefined;
	return { maxWidth: clamped };
}

/**
 * @param {string} type
 */
export function isHeaderBlockType(type) {
	return HEADER_TYPE_SET.has(type);
}

/**
 * @param {string} type
 */
export function isFooterBlockType(type) {
	return FOOTER_TYPE_SET.has(type);
}

/**
 * Body blocks only — headers/footers live on site chrome.
 * @param {string} type
 */
export function isPageBodyBlockType(type) {
	return BLOCK_TYPE_SET.has(type) && !isHeaderBlockType(type) && !isFooterBlockType(type);
}

/**
 * Clone block/chrome props and strip unsafe hrefs (`javascript:`, `data:`, …).
 * Used on both parse (public render) and normalize (save).
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export function cloneBlockProps(value) {
	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		return sanitizeBlockUrlProps(/** @type {Record<string, unknown>} */ (structuredClone(value)));
	}
	return {};
}

/** @param {unknown} value */
function cloneProps(value) {
	return cloneBlockProps(value);
}

/**
 * Server-safe defaults for site chrome (mirrors registry defaults).
 * @param {string} type
 * @param {string} [siteName]
 * @returns {Record<string, unknown> | null}
 */
export function defaultChromeProps(type, siteName = 'Site') {
	const brand = siteName?.trim() || 'Site';
	if (type === 'header.logo-links-cta') {
		return {
			logoText: brand,
			links: [
				{ label: 'Music', href: '/' },
				{ label: 'Shows', href: '/' },
				{ label: 'About', href: '/' },
				{ label: 'Contact', href: '/' }
			],
			ctaLabel: 'Listen',
			ctaHref: '/'
		};
	}
	if (type === 'header.logo-divider-nav') {
		return {
			logoText: brand,
			links: [
				{ label: 'Releases', href: '/' },
				{ label: 'Mixes', href: '/' },
				{ label: 'Store', href: '/' }
			],
			ctaLabel: 'Join',
			ctaHref: '/'
		};
	}
	if (type === 'header.center-logo') {
		return {
			logoText: brand,
			links: [
				{ label: 'Listen', href: '/' },
				{ label: 'Watch', href: '/' },
				{ label: 'Tour', href: '/' }
			],
			ctaLabel: 'Follow',
			ctaHref: '/'
		};
	}
	if (type === 'header.logo-center-nav') {
		return {
			logoText: brand,
			links: [
				{ label: 'Home', href: '/' },
				{ label: 'Music', href: '/' },
				{ label: 'Events', href: '/' },
				{ label: 'Press', href: '/' }
			],
			ctaLabel: 'Book',
			ctaHref: '/'
		};
	}
	if (type === 'footer.link-columns-bar') {
		return {
			logoText: brand,
			columns: [
				{ title: 'Product', links: 'Feed\nLibrary\nPlans' },
				{ title: 'Creators', links: 'Upload\nSites\nDomains' },
				{ title: 'Company', links: 'About\nPrivacy\nTerms' },
				{ title: 'Help', links: 'Support\nStatus\nContact' }
			],
			copyright: `© ${brand}`,
			meta: 'Audio multi-tool'
		};
	}
	if (type === 'footer.link-columns-mark-bar') {
		return {
			markText: brand,
			columns: [
				{ title: 'Product', links: 'Feed\nLibrary\nPlans' },
				{ title: 'Creators', links: 'Upload\nSites\nDomains' },
				{ title: 'Company', links: 'About\nPrivacy\nTerms' },
				{ title: 'Help', links: 'Support\nStatus\nContact' }
			],
			copyright: `© ${brand}`,
			meta: 'Audio multi-tool'
		};
	}
	if (type === 'footer.newsletter-bar') {
		return {
			columns: [
				{ title: 'Listen', links: 'Feed\nCharts\nNew' },
				{ title: 'Create', links: 'Upload\nPlaylists\nSites' },
				{ title: 'Account', links: 'Settings\nBilling\nStorage' },
				{ title: 'Legal', links: 'Terms\nPrivacy\nCopyright' },
				{ title: 'Social', links: 'X\nInstagram\nYouTube' }
			],
			newsletterTitle: 'Get release notes',
			emailPlaceholder: 'you@example.com',
			submitLabel: 'Join',
			copyright: `© ${brand}`,
			meta: 'Made for artists & listeners'
		};
	}
	if (type === 'footer.minimal') {
		return {
			logoText: brand,
			meta: 'Audio host for creators',
			rightMeta: 'sndbnk.com'
		};
	}
	if (type === 'footer.columns-newsletter-bar') {
		return {
			columns: [
				{ title: 'Listen', links: 'Feed\nCharts\nNew' },
				{ title: 'Create', links: 'Upload\nPlaylists\nSites' },
				{ title: 'Account', links: 'Settings\nBilling\nStorage' }
			],
			newsletterTitle: 'Stay in the loop',
			emailPlaceholder: 'you@example.com',
			submitLabel: 'Join',
			logoText: brand,
			copyright: `© ${brand}`,
			meta: 'Made for artists & listeners'
		};
	}
	return null;
}

/**
 * @param {'header' | 'footer'} kind
 * @param {string} [siteName]
 * @param {string} [type]
 * @returns {PageBlockInstance | null}
 */
export function createDefaultChromeBlock(kind, siteName = 'Site', type) {
	const resolved = type ?? (kind === 'header' ? DEFAULT_HEADER_TYPE : DEFAULT_FOOTER_TYPE);
	const allowed = kind === 'header' ? HEADER_TYPE_SET : FOOTER_TYPE_SET;
	if (!allowed.has(resolved)) return null;
	const props = defaultChromeProps(resolved, siteName);
	if (!props) return null;
	return { id: crypto.randomUUID(), type: resolved, props };
}

/**
 * @param {unknown} value
 * @param {'header' | 'footer'} kind
 * @returns {PageBlockInstance | null}
 */
export function parseChromeBlock(value, kind) {
	if (typeof value !== 'string' || !value.trim()) return null;
	try {
		const parsed = JSON.parse(value);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
		const row = /** @type {Record<string, unknown>} */ (parsed);
		if (typeof row.id !== 'string' || !row.id) return null;
		if (typeof row.type !== 'string') return null;
		const allowed = kind === 'header' ? HEADER_TYPE_SET : FOOTER_TYPE_SET;
		if (!allowed.has(row.type)) return null;
		return { id: row.id, type: row.type, props: cloneProps(row.props) };
	} catch {
		return null;
	}
}

/**
 * @param {PageBlockInstance} block
 */
export function stringifyChromeBlock(block) {
	return JSON.stringify(block);
}

/**
 * Normalize a client-submitted chrome block (required, exactly one instance).
 * @param {unknown} raw
 * @param {'header' | 'footer'} kind
 * @returns {{ ok: true, block: PageBlockInstance } | { ok: false, message: string }}
 */
export function normalizeChromeBlock(raw, kind) {
	const label = kind === 'header' ? 'Header' : 'Footer';
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return { ok: /** @type {const} */ (false), message: `${label} must be an object.` };
	}
	const row = /** @type {Record<string, unknown>} */ (raw);
	if (typeof row.id !== 'string' || !row.id) {
		return { ok: /** @type {const} */ (false), message: `${label} needs an id.` };
	}
	if (typeof row.type !== 'string') {
		return { ok: /** @type {const} */ (false), message: `${label} type is required.` };
	}
	const allowed = kind === 'header' ? HEADER_TYPE_SET : FOOTER_TYPE_SET;
	if (!allowed.has(row.type)) {
		return { ok: /** @type {const} */ (false), message: `Unknown ${kind} type.` };
	}
	return {
		ok: /** @type {const} */ (true),
		block: { id: row.id, type: row.type, props: cloneProps(row.props) }
	};
}

/**
 * @param {unknown} value
 * @returns {PageBlockInstance[]}
 */
export function parsePageBlocks(value) {
	if (typeof value !== 'string' || !value.trim()) return [];
	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		/** @type {PageBlockInstance[]} */
		const out = [];
		for (const item of parsed) {
			if (typeof item !== 'object' || item === null) continue;
			const row = /** @type {Record<string, unknown>} */ (item);
			if (typeof row.id !== 'string' || !row.id) continue;
			if (typeof row.type !== 'string' || !isPageBodyBlockType(row.type)) continue;
			const layout = parseBlockLayout(row.layout);
			out.push({
				id: row.id,
				type: row.type,
				props: cloneProps(row.props),
				...(layout ? { layout } : {})
			});
		}
		return out;
	} catch {
		return [];
	}
}

/**
 * Parse raw page blocks including legacy header/footer entries (for chrome migration).
 * @param {unknown} value
 * @returns {PageBlockInstance[]}
 */
export function parseAllPageBlocks(value) {
	if (typeof value !== 'string' || !value.trim()) return [];
	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		/** @type {PageBlockInstance[]} */
		const out = [];
		for (const item of parsed) {
			if (typeof item !== 'object' || item === null) continue;
			const row = /** @type {Record<string, unknown>} */ (item);
			if (typeof row.id !== 'string' || !row.id) continue;
			if (typeof row.type !== 'string' || !BLOCK_TYPE_SET.has(row.type)) continue;
			const layout = parseBlockLayout(row.layout);
			out.push({
				id: row.id,
				type: row.type,
				props: cloneProps(row.props),
				...(layout ? { layout } : {})
			});
		}
		return out;
	} catch {
		return [];
	}
}

/**
 * @param {PageBlockInstance[]} blocks
 */
export function stringifyPageBlocks(blocks) {
	return JSON.stringify(blocks);
}

/**
 * Drop header/footer instances from a block list (body only).
 * @param {PageBlockInstance[]} blocks
 */
export function stripChromeFromBlocks(blocks) {
	return blocks.filter((b) => isPageBodyBlockType(b.type));
}
