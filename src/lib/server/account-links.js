import { and, count, eq, inArray, or } from 'drizzle-orm';

import { db } from '#lib/server/db';
import { accountLink, profile, user } from '#lib/server/db/schema';
import { getProfileByUsername } from '#lib/server/tenant';
import { normalizeUsername } from '#lib/server/username';

export const MAX_ACCEPTED_LINKS = 4;

/**
 * @typedef {Object} LinkPeer
 * @property {string} linkId
 * @property {string} userId
 * @property {string} username
 * @property {string} name
 * @property {string | null} image
 * @property {'pending' | 'accepted'} status
 * @property {'inbound' | 'outbound' | 'peer'} direction
 * @property {number} createdAt
 * @property {number | null} acceptedAt
 */

const PEER_COLUMNS = {
	linkId: accountLink.id,
	status: accountLink.status,
	requesterId: accountLink.requesterId,
	recipientId: accountLink.recipientId,
	createdAt: accountLink.createdAt,
	acceptedAt: accountLink.acceptedAt
};

/**
 * @param {string} userId
 * @param {'pending' | 'accepted' | null} [status]
 */
async function findLinksInvolving(userId, status = null) {
	const involvement = or(eq(accountLink.requesterId, userId), eq(accountLink.recipientId, userId));
	const where = status ? and(involvement, eq(accountLink.status, status)) : involvement;

	return db.select(PEER_COLUMNS).from(accountLink).where(where);
}

/**
 * @param {string} userId
 */
async function countAcceptedLinks(userId) {
	const [{ n }] = await db
		.select({ n: count() })
		.from(accountLink)
		.where(
			and(
				eq(accountLink.status, 'accepted'),
				or(eq(accountLink.requesterId, userId), eq(accountLink.recipientId, userId))
			)
		);
	return n;
}

/**
 * @param {string} a
 * @param {string} b
 */
async function findLinkBetween(a, b) {
	const rows = await db
		.select(PEER_COLUMNS)
		.from(accountLink)
		.where(
			or(
				and(eq(accountLink.requesterId, a), eq(accountLink.recipientId, b)),
				and(eq(accountLink.requesterId, b), eq(accountLink.recipientId, a))
			)
		)
		.limit(1);
	return rows[0] ?? null;
}

/**
 * @param {string[]} userIds
 * @returns {Promise<Map<string, { username: string, name: string, image: string | null }>>}
 */
async function loadPeerProfiles(userIds) {
	if (userIds.length === 0) return new Map();

	const rows = await db
		.select({
			userId: profile.userId,
			username: profile.username,
			name: user.name,
			image: user.image
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(inArray(profile.userId, userIds));

	return new Map(
		rows.map((row) => [
			row.userId,
			{ username: row.username, name: row.name, image: row.image ?? null }
		])
	);
}

/**
 * @param {string} viewerId
 * @param {Awaited<ReturnType<typeof findLinksInvolving>>[number]} row
 * @param {Map<string, { username: string, name: string, image: string | null }>} profiles
 * @returns {LinkPeer | null}
 */
function toPeer(viewerId, row, profiles) {
	const otherId = row.requesterId === viewerId ? row.recipientId : row.requesterId;
	const profileRow = profiles.get(otherId);
	if (!profileRow) return null;

	const direction =
		row.status === 'accepted'
			? /** @type {const} */ ('peer')
			: row.requesterId === viewerId
				? /** @type {const} */ ('outbound')
				: /** @type {const} */ ('inbound');

	return {
		linkId: row.linkId,
		userId: otherId,
		username: profileRow.username,
		name: profileRow.name,
		image: profileRow.image,
		status: /** @type {'pending' | 'accepted'} */ (row.status),
		direction,
		createdAt: row.createdAt.getTime(),
		acceptedAt: row.acceptedAt?.getTime() ?? null
	};
}

/**
 * @param {string} userId
 */
export async function listLinksForUser(userId) {
	const rows = await findLinksInvolving(userId);
	const otherIds = [
		...new Set(rows.map((row) => (row.requesterId === userId ? row.recipientId : row.requesterId)))
	];
	const profiles = await loadPeerProfiles(otherIds);
	const peers = rows
		.map((row) => toPeer(userId, row, profiles))
		.filter(/** @returns {peer is LinkPeer} */ (peer) => peer != null);

	return {
		inbound: peers.filter((p) => p.direction === 'inbound'),
		outbound: peers.filter((p) => p.direction === 'outbound'),
		accepted: peers.filter((p) => p.direction === 'peer')
	};
}

/**
 * Accepted peers for the avatar switcher.
 * @param {string} userId
 * @returns {Promise<Array<{ userId: string, username: string, name: string, image: string | null }>>}
 */
export async function listAcceptedPeers(userId) {
	const { accepted } = await listLinksForUser(userId);
	return accepted.map(({ userId: id, username, name, image }) => ({
		userId: id,
		username,
		name,
		image
	}));
}

/**
 * @param {string} userId
 * @param {string} otherUserId
 */
export async function assertAcceptedLink(userId, otherUserId) {
	if (!userId || !otherUserId || userId === otherUserId) {
		return { ok: /** @type {const} */ (false), message: 'Invalid account switch.' };
	}

	const link = await findLinkBetween(userId, otherUserId);
	if (!link || link.status !== 'accepted') {
		return { ok: /** @type {const} */ (false), message: 'Those accounts are not linked.' };
	}

	return { ok: /** @type {const} */ (true), linkId: link.linkId };
}

/**
 * @param {string} requesterId
 * @param {string} usernameRaw
 */
export async function requestLink(requesterId, usernameRaw) {
	const username = normalizeUsername(usernameRaw ?? '');
	if (!username) {
		return { ok: /** @type {const} */ (false), message: 'Enter a username to link.' };
	}

	const target = await getProfileByUsername(username);
	if (!target) {
		return { ok: /** @type {const} */ (false), message: 'No account with that username.' };
	}

	if (target.userId === requesterId) {
		return { ok: /** @type {const} */ (false), message: 'You cannot link an account to itself.' };
	}

	const banRows = await db
		.select({ banned: user.banned })
		.from(user)
		.where(eq(user.id, target.userId))
		.limit(1);
	if (banRows[0]?.banned) {
		return { ok: /** @type {const} */ (false), message: 'That account cannot be linked.' };
	}

	const existing = await findLinkBetween(requesterId, target.userId);
	if (existing) {
		if (existing.status === 'accepted') {
			return { ok: /** @type {const} */ (false), message: 'Those accounts are already linked.' };
		}
		if (existing.requesterId === requesterId) {
			return { ok: /** @type {const} */ (false), message: 'Link request already pending.' };
		}
		return {
			ok: /** @type {const} */ (false),
			message: 'They already sent you a link request — approve it below.'
		};
	}

	const mine = await countAcceptedLinks(requesterId);
	if (mine >= MAX_ACCEPTED_LINKS) {
		return {
			ok: /** @type {const} */ (false),
			message: `You can link at most ${MAX_ACCEPTED_LINKS} accounts.`
		};
	}

	const theirs = await countAcceptedLinks(target.userId);
	if (theirs >= MAX_ACCEPTED_LINKS) {
		return {
			ok: /** @type {const} */ (false),
			message: 'That account has reached its link limit.'
		};
	}

	const [row] = await db
		.insert(accountLink)
		.values({
			requesterId,
			recipientId: target.userId,
			status: 'pending'
		})
		.returning({ id: accountLink.id });

	return {
		ok: /** @type {const} */ (true),
		linkId: row.id,
		recipient: {
			userId: target.userId,
			username: target.username,
			name: target.name,
			email: target.email
		}
	};
}

/**
 * @param {string} userId
 * @param {string} linkId
 */
export async function cancelLink(userId, linkId) {
	const rows = await db
		.select(PEER_COLUMNS)
		.from(accountLink)
		.where(and(eq(accountLink.id, linkId), eq(accountLink.requesterId, userId)))
		.limit(1);
	const row = rows[0];
	if (!row || row.status !== 'pending') {
		return { ok: /** @type {const} */ (false), message: 'Pending request not found.' };
	}

	await db.delete(accountLink).where(eq(accountLink.id, linkId));
	return { ok: /** @type {const} */ (true) };
}

/**
 * @param {string} userId
 * @param {string} linkId
 */
export async function acceptLink(userId, linkId) {
	const rows = await db
		.select(PEER_COLUMNS)
		.from(accountLink)
		.where(and(eq(accountLink.id, linkId), eq(accountLink.recipientId, userId)))
		.limit(1);
	const row = rows[0];
	if (!row || row.status !== 'pending') {
		return { ok: /** @type {const} */ (false), message: 'Pending request not found.' };
	}

	const mine = await countAcceptedLinks(userId);
	if (mine >= MAX_ACCEPTED_LINKS) {
		return {
			ok: /** @type {const} */ (false),
			message: `You can link at most ${MAX_ACCEPTED_LINKS} accounts.`
		};
	}

	const theirs = await countAcceptedLinks(row.requesterId);
	if (theirs >= MAX_ACCEPTED_LINKS) {
		return {
			ok: /** @type {const} */ (false),
			message: 'The other account has reached its link limit.'
		};
	}

	const now = new Date();
	await db
		.update(accountLink)
		.set({ status: 'accepted', acceptedAt: now, updatedAt: now })
		.where(eq(accountLink.id, linkId));

	return { ok: /** @type {const} */ (true) };
}

/**
 * @param {string} userId
 * @param {string} linkId
 */
export async function declineLink(userId, linkId) {
	const rows = await db
		.select(PEER_COLUMNS)
		.from(accountLink)
		.where(and(eq(accountLink.id, linkId), eq(accountLink.recipientId, userId)))
		.limit(1);
	const row = rows[0];
	if (!row || row.status !== 'pending') {
		return { ok: /** @type {const} */ (false), message: 'Pending request not found.' };
	}

	await db.delete(accountLink).where(eq(accountLink.id, linkId));
	return { ok: /** @type {const} */ (true) };
}

/**
 * @param {string} userId
 * @param {string} linkId
 */
export async function unlink(userId, linkId) {
	const rows = await db
		.select(PEER_COLUMNS)
		.from(accountLink)
		.where(eq(accountLink.id, linkId))
		.limit(1);
	const row = rows[0];
	if (
		!row ||
		row.status !== 'accepted' ||
		(row.requesterId !== userId && row.recipientId !== userId)
	) {
		return { ok: /** @type {const} */ (false), message: 'Linked account not found.' };
	}

	await db.delete(accountLink).where(eq(accountLink.id, linkId));
	return { ok: /** @type {const} */ (true) };
}
