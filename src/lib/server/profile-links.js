import { asc, eq } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { profileLink } from '#lib/server/db/schema';
import {
	MAX_LINK_LABEL_LENGTH,
	MAX_LINK_URL_LENGTH,
	MAX_PROFILE_LINKS
} from '#lib/profile-links.js';

export const MAX_BIO_LENGTH = 500;
export const MAX_LOCATION_LENGTH = 100;

/** @typedef {{ label: string, url: string }} LinkInput */

/**
 * Accept a bare host ("example.com") but reject anything that is not http(s)
 * once normalized — `javascript:` and `data:` URLs must never reach an href.
 * @param {string} raw
 * @returns {string | null}
 */
function normalizeUrl(raw) {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

	let parsed;
	try {
		parsed = new URL(withScheme);
	} catch {
		return null;
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
	if (!parsed.hostname.includes('.')) return null;

	return parsed.toString();
}

/**
 * @param {LinkInput[]} entries
 * @returns {{ ok: true, links: Array<{ label: string, url: string, position: number }> }
 *   | { ok: false, message: string }}
 */
export function validateProfileLinks(entries) {
	/** @type {Array<{ label: string, url: string, position: number }>} */
	const links = [];

	for (const entry of entries) {
		const label = entry.label.trim();
		const rawUrl = entry.url.trim();

		// A row with neither field filled in is just an empty editor row.
		if (!label && !rawUrl) continue;

		if (!label) {
			return { ok: false, message: 'Every link needs a label.' };
		}
		if (label.length > MAX_LINK_LABEL_LENGTH) {
			return {
				ok: false,
				message: `Link labels must be ${MAX_LINK_LABEL_LENGTH} characters or fewer.`
			};
		}
		if (!rawUrl) {
			return { ok: false, message: `Add a URL for “${label}”.` };
		}
		if (rawUrl.length > MAX_LINK_URL_LENGTH) {
			return {
				ok: false,
				message: `Link URLs must be ${MAX_LINK_URL_LENGTH} characters or fewer.`
			};
		}

		const url = normalizeUrl(rawUrl);
		if (!url) {
			return { ok: false, message: `“${rawUrl}” is not a valid http or https URL.` };
		}

		links.push({ label, url, position: links.length });
	}

	if (links.length > MAX_PROFILE_LINKS) {
		return { ok: false, message: `You can add up to ${MAX_PROFILE_LINKS} links.` };
	}

	return { ok: true, links };
}

/**
 * Pull `link.{i}.label` / `link.{i}.url` pairs out of a settings form submission.
 * @param {FormData} formData
 * @returns {LinkInput[]}
 */
export function readLinkEntries(formData) {
	/** @type {Map<number, LinkInput>} */
	const rows = new Map();

	for (const [key, value] of formData.entries()) {
		const match = /^link\.(\d+)\.(label|url)$/.exec(key);
		if (!match) continue;

		const index = Number.parseInt(match[1], 10);
		const row = rows.get(index) ?? { label: '', url: '' };
		row[/** @type {'label' | 'url'} */ (match[2])] = value.toString();
		rows.set(index, row);
	}

	return [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}

/**
 * @param {string} userId
 */
export async function listLinksForUser(userId) {
	return db
		.select({
			id: profileLink.id,
			label: profileLink.label,
			url: profileLink.url,
			position: profileLink.position
		})
		.from(profileLink)
		.where(eq(profileLink.userId, userId))
		.orderBy(asc(profileLink.position));
}

/**
 * Replace the whole set. Reinserting keeps ordering trivial and links are few.
 * @param {string} userId
 * @param {Array<{ label: string, url: string, position: number }>} links
 */
export async function replaceLinksForUser(userId, links) {
	await db.delete(profileLink).where(eq(profileLink.userId, userId));

	if (links.length === 0) return;

	await db.insert(profileLink).values(
		links.map((link) => ({
			userId,
			label: link.label,
			url: link.url,
			position: link.position
		}))
	);
}
