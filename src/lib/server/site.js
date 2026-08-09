import { and, eq } from 'drizzle-orm';

import {
	createDefaultChromeBlock,
	isFooterBlockType,
	isHeaderBlockType,
	normalizeChromeBlock,
	parseChromeBlock,
	stringifyChromeBlock
} from '#lib/components/blocks/types.js';
import { canRemoveBranding, canUseCustomDomain, canUseSubdomain } from '#lib/server/billing/plans';
import { db } from '#lib/server/db';
import { site } from '#lib/server/db/schema';
import { readFileHead, sniffImage } from '#lib/server/media/sniff';
import {
	ensureRootPage,
	getRootPageRawBlocks,
	stripChromeFromAllPages
} from '#lib/server/site-pages';
import { createLocalAdapter } from '#lib/server/storage/local.js';
import { buildPublicUrls } from '#lib/server/tenant';

export const SITE_LOGO_FOLDER_KEY = 'site-logo';
export const SITE_OG_FOLDER_KEY = 'site-og';

export const MAX_SITE_NAME_LENGTH = 80;
export const MAX_SITE_DESCRIPTION_LENGTH = 300;

export const SITE_INTENTS = /** @type {const} */ (['tracks', 'mixes', 'podcast', 'label', 'other']);

const SITE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** @type {Record<string, string>} */
const IMAGE_EXT_BY_MIME = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Vault+ subdomain or Studio+ custom domain.
 * @param {string | null | undefined} planId
 */
export function canEditSite(planId) {
	return canUseSubdomain(planId) || canUseCustomDomain(planId);
}

/**
 * @param {string} userId
 * @param {Date} updatedAt
 */
export function siteLogoUrl(userId, updatedAt) {
	return `/api/site-logo/${userId}?v=${updatedAt.getTime()}`;
}

/**
 * @param {string} userId
 * @param {Date} updatedAt
 */
export function siteOgImageUrl(userId, updatedAt) {
	return `/api/site-og/${userId}?v=${updatedAt.getTime()}`;
}

/**
 * @param {string} userId
 */
export async function getSiteByUserId(userId) {
	const rows = await db.select().from(site).where(eq(site.userId, userId)).limit(1);
	return rows[0] ?? null;
}

/**
 * @param {string} siteId
 */
export async function getSiteById(siteId) {
	const rows = await db.select().from(site).where(eq(site.id, siteId)).limit(1);
	return rows[0] ?? null;
}

/**
 * Owner-scoped lookup by public site id.
 * @param {string} userId
 * @param {string} siteId
 */
export async function getOwnedSite(userId, siteId) {
	const rows = await db
		.select()
		.from(site)
		.where(and(eq(site.id, siteId), eq(site.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Serializable site shape for settings / public pages. Null when no row yet.
 * @param {string} userId
 */
export async function getSitePublic(userId) {
	const row = await getSiteByUserId(userId);
	if (!row) return null;

	return {
		name: row.name ?? null,
		description: row.description ?? null,
		logoUrl: row.logoFilename ? siteLogoUrl(userId, row.updatedAt) : null,
		ogImageUrl: row.ogImageFilename ? siteOgImageUrl(userId, row.updatedAt) : null,
		accentColor: row.accentColor ?? null,
		hideBranding: row.hideBranding,
		sidebarEnabled: row.sidebarEnabled,
		sidebarStats: row.sidebarStats,
		sidebarFansAlsoLike: row.sidebarFansAlsoLike,
		sidebarFollowers: row.sidebarFollowers,
		sidebarActivity: row.sidebarActivity,
		updatedAt: row.updatedAt.getTime()
	};
}

/**
 * Owner-facing shape for the setup wizard / builder gates.
 * @param {typeof site.$inferSelect} row
 */
export function serializeSiteOwner(row) {
	return {
		id: row.id,
		name: row.name ?? '',
		description: row.description ?? '',
		logoUrl: row.logoFilename ? siteLogoUrl(row.userId, row.updatedAt) : null,
		accentColor: row.accentColor ?? '',
		siteIntent: row.siteIntent ?? '',
		wantBlog: row.wantBlog,
		wantEvents: row.wantEvents,
		wantEcommerce: row.wantEcommerce,
		setupCompletedAt: row.setupCompletedAt ? row.setupCompletedAt.getTime() : null,
		header: parseChromeBlock(row.headerBlock, 'header'),
		footer: parseChromeBlock(row.footerBlock, 'footer')
	};
}

/**
 * @param {string | null | undefined} raw
 */
export function normalizeSiteIntent(raw) {
	const value = raw?.toString().trim() ?? '';
	if (!SITE_INTENTS.includes(/** @type {(typeof SITE_INTENTS)[number]} */ (value))) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Pick what kind of site this is.'
		};
	}
	return {
		ok: /** @type {const} */ (true),
		siteIntent: /** @type {(typeof SITE_INTENTS)[number]} */ (value)
	};
}

/**
 * Custom-domain sidebar flags. Null means “show everything” (apex / subdomain).
 * @param {'subdomain' | 'custom' | null | undefined} hostKind
 * @param {{
 *   sidebarEnabled: boolean,
 *   sidebarStats: boolean,
 *   sidebarFansAlsoLike: boolean,
 *   sidebarFollowers: boolean,
 *   sidebarActivity: boolean
 * } | null} site
 */
export function resolveSidebarVisibility(hostKind, site) {
	if (hostKind !== 'custom') return null;

	return {
		enabled: site?.sidebarEnabled ?? false,
		stats: site?.sidebarStats ?? true,
		fansAlsoLike: site?.sidebarFansAlsoLike ?? true,
		followers: site?.sidebarFollowers ?? true,
		activity: site?.sidebarActivity ?? true
	};
}

/**
 * Ensure a site row exists so subsequent updates/uploads can write columns.
 * @param {string} userId
 */
async function ensureSiteRow(userId) {
	const existing = await getSiteByUserId(userId);
	if (existing) {
		if (existing.id) return existing;
		const id = crypto.randomUUID();
		await db.update(site).set({ id, updatedAt: new Date() }).where(eq(site.userId, userId));
		return { ...existing, id };
	}

	const id = crypto.randomUUID();
	await db.insert(site).values({ userId, id });
	const created = await getSiteByUserId(userId);
	if (!created) throw new Error('Failed to create site row');
	return created;
}

/**
 * Hosts shown in the account menu for Vault+ / Studio+ creators.
 * @param {{
 *   userId: string,
 *   username: string,
 *   plan?: string | null,
 *   customDomain?: string | null,
 *   customDomainStatus?: string | null
 * } | null | undefined} profile
 */
export async function listNavSites(profile) {
	if (!profile?.username || !canEditSite(profile.plan)) {
		return { siteId: null, hosts: /** @type {Array<{ label: string, href: string }>} */ ([]) };
	}

	const urls = buildPublicUrls(profile);
	/** @type {string[]} */
	const labels = [];
	if (urls.subdomainUrl) {
		try {
			labels.push(new URL(urls.subdomainUrl).host);
		} catch {
			labels.push(`${profile.username}`);
		}
	}
	if (urls.customDomainUrl && profile.customDomain) {
		labels.push(profile.customDomain);
	}

	if (labels.length === 0) {
		return { siteId: null, hosts: [] };
	}

	const row = await ensureSiteRow(profile.userId);
	const href = `/sites/${row.id}`;
	return {
		siteId: row.id,
		hosts: labels.map((label) => ({ label, href }))
	};
}

/**
 * First-run wizard: branding goes live on tenant hosts; prefs stored for later.
 * @param {{
 *   userId: string,
 *   plan: string | null | undefined,
 *   name: string,
 *   description: string,
 *   accentColor: string,
 *   siteIntent: string,
 *   wantBlog: boolean,
 *   wantEvents: boolean,
 *   wantEcommerce: boolean,
 *   logo?: File | null
 * }} input
 */
export async function completeSiteSetup(input) {
	if (!canEditSite(input.plan)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Site setup needs Vault or higher. Upgrade from Settings → Billing.'
		};
	}

	const name = input.name.trim();
	if (!name) {
		return { ok: /** @type {const} */ (false), message: 'Site name is required.' };
	}
	if (name.length > MAX_SITE_NAME_LENGTH) {
		return {
			ok: /** @type {const} */ (false),
			message: `Site name must be ${MAX_SITE_NAME_LENGTH} characters or fewer.`
		};
	}

	const description = input.description.trim();
	if (description.length > MAX_SITE_DESCRIPTION_LENGTH) {
		return {
			ok: /** @type {const} */ (false),
			message: `Site description must be ${MAX_SITE_DESCRIPTION_LENGTH} characters or fewer.`
		};
	}

	const accentResult = normalizeAccentColor(input.accentColor);
	if (!accentResult.ok) return accentResult;

	const intentResult = normalizeSiteIntent(input.siteIntent);
	if (!intentResult.ok) return intentResult;

	const logo = input.logo;
	if (logo && typeof logo === 'object' && 'size' in logo && logo.size > 0) {
		const logoResult = await saveSiteLogo(input.userId, input.plan, logo);
		if (!logoResult.ok) return logoResult;
	} else {
		await ensureSiteRow(input.userId);
	}

	await db
		.update(site)
		.set({
			name,
			description: description || null,
			accentColor: accentResult.accentColor,
			siteIntent: intentResult.siteIntent,
			wantBlog: Boolean(input.wantBlog),
			wantEvents: Boolean(input.wantEvents),
			wantEcommerce: Boolean(input.wantEcommerce),
			setupCompletedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(site.userId, input.userId));

	const row = await getSiteByUserId(input.userId);
	if (row) {
		await ensureRootPage(row.id);
		await ensureSiteChrome(row.id);
	}

	return { ok: /** @type {const} */ (true) };
}

/**
 * Ensure site has header + footer chrome. Lifts legacy page chrome once, else seeds defaults.
 * @param {string} siteId
 */
export async function ensureSiteChrome(siteId) {
	const rows = await db.select().from(site).where(eq(site.id, siteId)).limit(1);
	const row = rows[0];
	if (!row) return null;

	const brand = row.name?.trim() || 'Site';
	let header = parseChromeBlock(row.headerBlock, 'header');
	let footer = parseChromeBlock(row.footerBlock, 'footer');

	if (!header || !footer) {
		const rawBlocks = await getRootPageRawBlocks(siteId);
		if (!header) {
			const liftedHeader = rawBlocks.find((b) => isHeaderBlockType(b.type));
			header = liftedHeader
				? { id: liftedHeader.id, type: liftedHeader.type, props: liftedHeader.props }
				: createDefaultChromeBlock('header', brand);
		}
		if (!footer) {
			const liftedFooter = [...rawBlocks].reverse().find((b) => isFooterBlockType(b.type));
			footer = liftedFooter
				? { id: liftedFooter.id, type: liftedFooter.type, props: liftedFooter.props }
				: createDefaultChromeBlock('footer', brand);
		}
	}

	if (!header) header = createDefaultChromeBlock('header', brand);
	if (!footer) footer = createDefaultChromeBlock('footer', brand);
	if (!header || !footer) return null;

	const headerJson = stringifyChromeBlock(header);
	const footerJson = stringifyChromeBlock(footer);
	const needsWrite = row.headerBlock !== headerJson || row.footerBlock !== footerJson;

	if (needsWrite) {
		await db
			.update(site)
			.set({
				headerBlock: headerJson,
				footerBlock: footerJson,
				updatedAt: new Date()
			})
			.where(eq(site.id, siteId));
	}

	// Idempotent: drop legacy header/footer instances from page body lists.
	await stripChromeFromAllPages(siteId);

	const updated = await db.select().from(site).where(eq(site.id, siteId)).limit(1);
	return updated[0] ? serializeSiteOwner(updated[0]) : null;
}

/**
 * Replace site header + footer chrome for an owned site.
 * @param {{
 *   userId: string,
 *   siteId: string,
 *   header: unknown,
 *   footer: unknown
 * }} input
 */
export async function replaceSiteChrome(input) {
	const row = await getOwnedSite(input.userId, input.siteId);
	if (!row) {
		return { ok: /** @type {const} */ (false), message: 'Site not found.' };
	}

	const headerResult = normalizeChromeBlock(input.header, 'header');
	if (!headerResult.ok) return headerResult;
	const footerResult = normalizeChromeBlock(input.footer, 'footer');
	if (!footerResult.ok) return footerResult;

	await db
		.update(site)
		.set({
			headerBlock: stringifyChromeBlock(headerResult.block),
			footerBlock: stringifyChromeBlock(footerResult.block),
			updatedAt: new Date()
		})
		.where(eq(site.id, row.id));

	const updated = await db.select().from(site).where(eq(site.id, row.id)).limit(1);
	const owner = serializeSiteOwner(updated[0]);
	return {
		ok: /** @type {const} */ (true),
		header: owner.header,
		footer: owner.footer,
		updatedAt: updated[0].updatedAt.getTime()
	};
}

/**
 * @param {string | null | undefined} raw
 */
export function normalizeAccentColor(raw) {
	const value = raw?.toString().trim() ?? '';
	if (!value) return { ok: /** @type {const} */ (true), accentColor: null };
	if (!ACCENT_PATTERN.test(value)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Accent must be a hex color like #C8FF00.'
		};
	}
	return { ok: /** @type {const} */ (true), accentColor: value.toUpperCase() };
}

/**
 * @param {{
 *   userId: string,
 *   plan: string | null | undefined,
 *   name: string,
 *   description: string,
 *   accentColor: string,
 *   hideBranding: boolean,
 *   sidebarEnabled?: boolean,
 *   sidebarStats?: boolean,
 *   sidebarFansAlsoLike?: boolean,
 *   sidebarFollowers?: boolean,
 *   sidebarActivity?: boolean
 * }} input
 */
export async function updateSiteSettings(input) {
	if (!canEditSite(input.plan)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Site settings need Vault or higher. Upgrade from the Billing tab.'
		};
	}

	const name = input.name.trim();
	const description = input.description.trim();

	if (name.length > MAX_SITE_NAME_LENGTH) {
		return {
			ok: /** @type {const} */ (false),
			message: `Site name must be ${MAX_SITE_NAME_LENGTH} characters or fewer.`
		};
	}

	if (description.length > MAX_SITE_DESCRIPTION_LENGTH) {
		return {
			ok: /** @type {const} */ (false),
			message: `Site description must be ${MAX_SITE_DESCRIPTION_LENGTH} characters or fewer.`
		};
	}

	const accentResult = normalizeAccentColor(input.accentColor);
	if (!accentResult.ok) return accentResult;

	const wantHide = Boolean(input.hideBranding);
	if (wantHide && !canRemoveBranding(input.plan)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Hiding SNDBNK branding needs Studio or Label.'
		};
	}

	await ensureSiteRow(input.userId);

	const existing = await getSiteByUserId(input.userId);
	const hideBranding = canRemoveBranding(input.plan) ? wantHide : (existing?.hideBranding ?? false);

	/** @type {Record<string, unknown>} */
	const patch = {
		name: name || null,
		description: description || null,
		accentColor: accentResult.accentColor,
		hideBranding,
		updatedAt: new Date()
	};

	// Sidebar flags only apply on custom domains (Studio+); ignore for lower tiers.
	if (canUseCustomDomain(input.plan)) {
		patch.sidebarEnabled = Boolean(input.sidebarEnabled);
		patch.sidebarStats = Boolean(input.sidebarStats);
		patch.sidebarFansAlsoLike = Boolean(input.sidebarFansAlsoLike);
		patch.sidebarFollowers = Boolean(input.sidebarFollowers);
		patch.sidebarActivity = Boolean(input.sidebarActivity);
	}

	await db.update(site).set(patch).where(eq(site.userId, input.userId));

	return { ok: /** @type {const} */ (true) };
}

/**
 * @param {File} file
 * @param {'logo' | 'og'} kind
 */
async function validateSiteImage(file, kind) {
	const label = kind === 'logo' ? 'Logo' : 'Social image';

	if (file.size > SITE_IMAGE_MAX_BYTES) {
		return { ok: /** @type {const} */ (false), message: `${label} must be 2MB or smaller.` };
	}

	const head = await readFileHead(file);
	const sniffed = sniffImage(head);
	if (!sniffed || !IMAGE_EXT_BY_MIME[sniffed.mime]) {
		return {
			ok: /** @type {const} */ (false),
			message: `${label} must be a jpg, png, or webp image.`
		};
	}

	return {
		ok: /** @type {const} */ (true),
		filename: `${kind}.${sniffed.ext}`,
		mime: sniffed.mime
	};
}

/**
 * @param {string} userId
 * @param {string | null | undefined} plan
 * @param {File} file
 */
export async function saveSiteLogo(userId, plan, file) {
	if (!canEditSite(plan)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Site settings need Vault or higher. Upgrade from the Billing tab.'
		};
	}

	const validated = await validateSiteImage(file, 'logo');
	if (!validated.ok) return validated;

	const storage = createLocalAdapter(userId);

	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		await storage.delete(SITE_LOGO_FOLDER_KEY);
		await storage.put(SITE_LOGO_FOLDER_KEY, validated.filename, bytes, validated.mime);
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Could not save your logo.'
		};
	}

	await ensureSiteRow(userId);
	await db
		.update(site)
		.set({
			logoFilename: validated.filename,
			logoMime: validated.mime,
			updatedAt: new Date()
		})
		.where(eq(site.userId, userId));

	return { ok: /** @type {const} */ (true) };
}

/**
 * @param {string} userId
 * @param {string | null | undefined} plan
 */
export async function removeSiteLogo(userId, plan) {
	if (!canEditSite(plan)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Site settings need Vault or higher. Upgrade from the Billing tab.'
		};
	}

	try {
		await createLocalAdapter(userId).delete(SITE_LOGO_FOLDER_KEY);
	} catch {
		// Nothing on disk is fine — clearing the record is what matters.
	}

	const existing = await getSiteByUserId(userId);
	if (existing) {
		await db
			.update(site)
			.set({ logoFilename: null, logoMime: null, updatedAt: new Date() })
			.where(eq(site.userId, userId));
	}

	return { ok: /** @type {const} */ (true) };
}

/**
 * @param {string} userId
 * @param {string | null | undefined} plan
 * @param {File} file
 */
export async function saveSiteOgImage(userId, plan, file) {
	if (!canEditSite(plan)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Site settings need Vault or higher. Upgrade from the Billing tab.'
		};
	}

	const validated = await validateSiteImage(file, 'og');
	if (!validated.ok) return validated;

	const storage = createLocalAdapter(userId);

	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		await storage.delete(SITE_OG_FOLDER_KEY);
		await storage.put(SITE_OG_FOLDER_KEY, validated.filename, bytes, validated.mime);
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Could not save your social image.'
		};
	}

	await ensureSiteRow(userId);
	await db
		.update(site)
		.set({
			ogImageFilename: validated.filename,
			ogImageMime: validated.mime,
			updatedAt: new Date()
		})
		.where(eq(site.userId, userId));

	return { ok: /** @type {const} */ (true) };
}

/**
 * @param {string} userId
 * @param {string | null | undefined} plan
 */
export async function removeSiteOgImage(userId, plan) {
	if (!canEditSite(plan)) {
		return {
			ok: /** @type {const} */ (false),
			message: 'Site settings need Vault or higher. Upgrade from the Billing tab.'
		};
	}

	try {
		await createLocalAdapter(userId).delete(SITE_OG_FOLDER_KEY);
	} catch {
		// Nothing on disk is fine — clearing the record is what matters.
	}

	const existing = await getSiteByUserId(userId);
	if (existing) {
		await db
			.update(site)
			.set({ ogImageFilename: null, ogImageMime: null, updatedAt: new Date() })
			.where(eq(site.userId, userId));
	}

	return { ok: /** @type {const} */ (true) };
}

/**
 * @param {string} userId
 */
export async function getSiteLogoRecord(userId) {
	const rows = await db
		.select({
			logoFilename: site.logoFilename,
			logoMime: site.logoMime
		})
		.from(site)
		.where(eq(site.userId, userId))
		.limit(1);

	return rows[0] ?? null;
}

/**
 * @param {string} userId
 */
export async function getSiteOgRecord(userId) {
	const rows = await db
		.select({
			ogImageFilename: site.ogImageFilename,
			ogImageMime: site.ogImageMime
		})
		.from(site)
		.where(eq(site.userId, userId))
		.limit(1);

	return rows[0] ?? null;
}
