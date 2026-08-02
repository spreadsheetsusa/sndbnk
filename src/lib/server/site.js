import { eq } from 'drizzle-orm';

import { canRemoveBranding, canUseCustomDomain, canUseSubdomain } from '#lib/server/billing/plans';
import { db } from '#lib/server/db';
import { site } from '#lib/server/db/schema';
import { createLocalAdapter } from '#lib/server/storage/local.js';

export const SITE_LOGO_FOLDER_KEY = 'site-logo';
export const SITE_OG_FOLDER_KEY = 'site-og';

export const MAX_SITE_NAME_LENGTH = 80;
export const MAX_SITE_DESCRIPTION_LENGTH = 300;

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
 * @param {string} filename
 */
function extFromName(filename) {
	const idx = filename.lastIndexOf('.');
	if (idx < 0) return '';
	return filename.slice(idx + 1).toLowerCase();
}

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
	if (existing) return existing;

	await db.insert(site).values({ userId });
	const created = await getSiteByUserId(userId);
	if (!created) throw new Error('Failed to create site row');
	return created;
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
function validateSiteImage(file, kind) {
	const mime = (file.type || '').toLowerCase();
	const ext = extFromName(file.name);
	const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp']);

	let resolvedExt = IMAGE_EXT_BY_MIME[mime];
	if (!resolvedExt && allowedExt.has(ext)) {
		resolvedExt = ext === 'jpeg' ? 'jpg' : ext;
	}

	const label = kind === 'logo' ? 'Logo' : 'Social image';

	if (!resolvedExt) {
		return {
			ok: /** @type {const} */ (false),
			message: `${label} must be a jpg, png, or webp image.`
		};
	}

	if (file.size > SITE_IMAGE_MAX_BYTES) {
		return { ok: /** @type {const} */ (false), message: `${label} must be 2MB or smaller.` };
	}

	return {
		ok: /** @type {const} */ (true),
		filename: `${kind}.${resolvedExt}`,
		mime: mime || `image/${resolvedExt === 'jpg' ? 'jpeg' : resolvedExt}`
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

	const validated = validateSiteImage(file, 'logo');
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

	const validated = validateSiteImage(file, 'og');
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
