import { and, asc, eq } from 'drizzle-orm';

import {
	isPageBodyBlockType,
	parseAllPageBlocks,
	parseBlockLayout,
	parsePageBlocks,
	stringifyPageBlocks,
	stripChromeFromBlocks
} from '#lib/components/blocks/types.js';
import { db } from '#lib/server/db';
import { site, sitePage } from '#lib/server/db/schema';

export const MAX_PAGE_TITLE_LENGTH = 120;
export const MAX_PAGE_SLUG_LENGTH = 80;
export const MAX_SEO_TITLE_LENGTH = 70;
export const MAX_SEO_DESCRIPTION_LENGTH = 160;
export const MAX_PAGE_BLOCKS = 80;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @typedef {import('#lib/components/blocks/types.js').PageBlockInstance} PageBlockInstance
 */

/**
 * @param {typeof sitePage.$inferSelect} row
 */
export function serializeSitePage(row) {
	return {
		id: row.id,
		siteId: row.siteId,
		parentId: row.parentId ?? null,
		slug: row.slug,
		path: row.path,
		title: row.title,
		seoTitle: row.seoTitle ?? '',
		seoDescription: row.seoDescription ?? '',
		blocks: parsePageBlocks(row.blocks),
		sortOrder: row.sortOrder,
		updatedAt: row.updatedAt.getTime()
	};
}

/**
 * @param {string} siteId
 */
export async function listSitePages(siteId) {
	const rows = await db
		.select()
		.from(sitePage)
		.where(eq(sitePage.siteId, siteId))
		.orderBy(asc(sitePage.sortOrder), asc(sitePage.path));
	return rows.map(serializeSitePage);
}

/**
 * Idempotent: every site gets a root page at `/`.
 * @param {string} siteId
 */
export async function ensureRootPage(siteId) {
	const existing = await db
		.select()
		.from(sitePage)
		.where(and(eq(sitePage.siteId, siteId), eq(sitePage.path, '/')))
		.limit(1);
	if (existing[0]) return serializeSitePage(existing[0]);

	const id = crypto.randomUUID();
	await db.insert(sitePage).values({
		id,
		siteId,
		parentId: null,
		slug: '',
		path: '/',
		title: 'Home',
		blocks: '[]',
		sortOrder: 0
	});

	const rows = await db.select().from(sitePage).where(eq(sitePage.id, id)).limit(1);
	return serializeSitePage(rows[0]);
}

/**
 * @param {string} userId
 * @param {string} siteId
 * @param {string} pageId
 */
export async function getOwnedPage(userId, siteId, pageId) {
	const rows = await db
		.select({ page: sitePage })
		.from(sitePage)
		.innerJoin(site, eq(sitePage.siteId, site.id))
		.where(and(eq(sitePage.id, pageId), eq(sitePage.siteId, siteId), eq(site.userId, userId)))
		.limit(1);
	return rows[0]?.page ?? null;
}

/**
 * @param {string | null | undefined} raw
 */
function normalizeOptionalText(raw) {
	const value = raw?.toString().trim() ?? '';
	return value || null;
}

/**
 * Normalize a client-submitted blocks array; drop invalid entries.
 * @param {unknown} raw
 * @returns {{ ok: true, blocks: PageBlockInstance[] } | { ok: false, message: string }}
 */
export function normalizePageBlocks(raw) {
	if (!Array.isArray(raw)) {
		return { ok: /** @type {const} */ (false), message: 'Blocks must be an array.' };
	}
	if (raw.length > MAX_PAGE_BLOCKS) {
		return {
			ok: /** @type {const} */ (false),
			message: `A page can have at most ${MAX_PAGE_BLOCKS} blocks.`
		};
	}

	/** @type {PageBlockInstance[]} */
	const blocks = [];
	const seen = new Set();
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) {
			return { ok: /** @type {const} */ (false), message: 'Each block must be an object.' };
		}
		const row = /** @type {Record<string, unknown>} */ (item);
		if (typeof row.id !== 'string' || !row.id) {
			return { ok: /** @type {const} */ (false), message: 'Each block needs an id.' };
		}
		if (seen.has(row.id)) {
			return { ok: /** @type {const} */ (false), message: 'Duplicate block id.' };
		}
		seen.add(row.id);
		if (typeof row.type !== 'string' || !isPageBodyBlockType(row.type)) {
			return {
				ok: /** @type {const} */ (false),
				message: 'Headers and footers are site chrome — use the Site tab.'
			};
		}
		const props =
			typeof row.props === 'object' && row.props !== null && !Array.isArray(row.props)
				? /** @type {Record<string, unknown>} */ (structuredClone(row.props))
				: {};
		const layout = parseBlockLayout(row.layout);
		blocks.push({
			id: row.id,
			type: row.type,
			props,
			...(layout ? { layout } : {})
		});
	}
	return { ok: /** @type {const} */ (true), blocks };
}

/**
 * Replace the ordered block list for an owned page.
 * @param {{
 *   userId: string,
 *   siteId: string,
 *   pageId: string,
 *   blocks: unknown
 * }} input
 */
export async function replacePageBlocks(input) {
	const row = await getOwnedPage(input.userId, input.siteId, input.pageId);
	if (!row) {
		return { ok: /** @type {const} */ (false), message: 'Page not found.' };
	}

	const normalized = normalizePageBlocks(input.blocks);
	if (!normalized.ok) return normalized;

	await db
		.update(sitePage)
		.set({
			blocks: stringifyPageBlocks(normalized.blocks),
			updatedAt: new Date()
		})
		.where(eq(sitePage.id, row.id));

	const updated = await db.select().from(sitePage).where(eq(sitePage.id, row.id)).limit(1);
	return {
		ok: /** @type {const} */ (true),
		page: serializeSitePage(updated[0]),
		blocks: parsePageBlocks(updated[0].blocks)
	};
}

/**
 * @param {{
 *   userId: string,
 *   siteId: string,
 *   pageId: string,
 *   title: string,
 *   slug: string,
 *   seoTitle: string,
 *   seoDescription: string
 * }} input
 */
export async function updatePageProps(input) {
	const row = await getOwnedPage(input.userId, input.siteId, input.pageId);
	if (!row) {
		return { ok: /** @type {const} */ (false), message: 'Page not found.' };
	}

	const title = input.title?.toString().trim() ?? '';
	if (!title) {
		return { ok: /** @type {const} */ (false), message: 'Page title is required.' };
	}
	if (title.length > MAX_PAGE_TITLE_LENGTH) {
		return {
			ok: /** @type {const} */ (false),
			message: `Title must be ${MAX_PAGE_TITLE_LENGTH} characters or fewer.`
		};
	}

	const seoTitle = normalizeOptionalText(input.seoTitle);
	if (seoTitle && seoTitle.length > MAX_SEO_TITLE_LENGTH) {
		return {
			ok: /** @type {const} */ (false),
			message: `SEO title must be ${MAX_SEO_TITLE_LENGTH} characters or fewer.`
		};
	}

	const seoDescription = normalizeOptionalText(input.seoDescription);
	if (seoDescription && seoDescription.length > MAX_SEO_DESCRIPTION_LENGTH) {
		return {
			ok: /** @type {const} */ (false),
			message: `SEO description must be ${MAX_SEO_DESCRIPTION_LENGTH} characters or fewer.`
		};
	}

	const isRoot = row.path === '/';
	/** @type {{ title: string, seoTitle: string | null, seoDescription: string | null, slug?: string, path?: string, updatedAt: Date }} */
	const patch = {
		title,
		seoTitle,
		seoDescription,
		updatedAt: new Date()
	};

	if (!isRoot) {
		const slug = input.slug?.toString().trim().toLowerCase() ?? '';
		if (!slug || !SLUG_PATTERN.test(slug) || slug.length > MAX_PAGE_SLUG_LENGTH) {
			return {
				ok: /** @type {const} */ (false),
				message: 'Slug must be lowercase letters, numbers, and hyphens.'
			};
		}
		const path = `/${slug}`;
		const clash = await db
			.select({ id: sitePage.id })
			.from(sitePage)
			.where(and(eq(sitePage.siteId, input.siteId), eq(sitePage.path, path)))
			.limit(1);
		if (clash[0] && clash[0].id !== row.id) {
			return { ok: /** @type {const} */ (false), message: 'Another page already uses that path.' };
		}
		patch.slug = slug;
		patch.path = path;
	}

	await db.update(sitePage).set(patch).where(eq(sitePage.id, row.id));

	const updated = await db.select().from(sitePage).where(eq(sitePage.id, row.id)).limit(1);
	return { ok: /** @type {const} */ (true), page: serializeSitePage(updated[0]) };
}

/**
 * Read root page blocks including legacy header/footer (for chrome lift).
 * @param {string} siteId
 */
export async function getRootPageRawBlocks(siteId) {
	const rows = await db
		.select()
		.from(sitePage)
		.where(and(eq(sitePage.siteId, siteId), eq(sitePage.path, '/')))
		.limit(1);
	if (!rows[0]) return [];
	return parseAllPageBlocks(rows[0].blocks);
}

/**
 * Strip header/footer instances from every page on the site.
 * @param {string} siteId
 */
export async function stripChromeFromAllPages(siteId) {
	const rows = await db.select().from(sitePage).where(eq(sitePage.siteId, siteId));
	for (const row of rows) {
		const all = parseAllPageBlocks(row.blocks);
		const body = stripChromeFromBlocks(all);
		if (body.length === all.length) continue;
		await db
			.update(sitePage)
			.set({
				blocks: stringifyPageBlocks(body),
				updatedAt: new Date()
			})
			.where(eq(sitePage.id, row.id));
	}
}
