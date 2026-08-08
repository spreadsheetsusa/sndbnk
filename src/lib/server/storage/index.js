import { eq, inArray } from 'drizzle-orm';

import { canUseStorageAdapters } from '#lib/server/billing/plans.js';
import { db } from '#lib/server/db/index.js';
import { profile, storageSetting } from '#lib/server/db/schema.js';
import { decryptSecret, encryptSecret } from './crypto.js';
import { createLocalAdapter } from './local.js';
import { normalizePublicBaseUrl, publicMediaUrl } from './public-url.js';
import { assertPublicSshHost } from './ssh-host.js';
import { createSshAdapter } from './ssh.js';

export { publicMediaUrl } from './public-url.js';

/** @type {import('./types.js').StorageAdapterMeta[]} */
export const STORAGE_ADAPTERS = [
	{
		id: 'local',
		label: 'Local (SNDBNK)',
		description: 'Store uploads on SNDBNK’s server. Default and simplest.',
		enabled: true
	},
	{
		id: 'ssh',
		label: 'SSH / own server',
		description: 'Upload over SFTP to a server you control via SSH key auth.',
		enabled: true
	},
	{
		id: 's3',
		label: 'Amazon S3',
		description: 'Bring your own S3 bucket.',
		enabled: false
	},
	{
		id: 'r2',
		label: 'Cloudflare R2',
		description: 'Bring your own R2 bucket.',
		enabled: false
	}
];

/**
 * @param {string} value
 * @returns {value is 'local' | 'ssh'}
 */
export function isEnabledAdapter(value) {
	return value === 'local' || value === 'ssh';
}

/**
 * @param {string} userId
 */
export async function getOrCreateStorageSetting(userId) {
	const rows = await db
		.select()
		.from(storageSetting)
		.where(eq(storageSetting.userId, userId))
		.limit(1);

	if (rows[0]) return rows[0];

	const now = new Date();
	await db.insert(storageSetting).values({
		userId,
		adapter: 'local',
		sshPort: 22,
		updatedAt: now
	});

	const created = await db
		.select()
		.from(storageSetting)
		.where(eq(storageSetting.userId, userId))
		.limit(1);

	return created[0];
}

/**
 * Public-safe view of storage settings (no decrypted secrets).
 * @param {string} userId
 */
export async function getStorageSettingPublic(userId) {
	const row = await getOrCreateStorageSetting(userId);
	return {
		adapter: row.adapter,
		sshHost: row.sshHost ?? '',
		sshPort: row.sshPort ?? 22,
		sshUsername: row.sshUsername ?? '',
		sshRemotePath: row.sshRemotePath ?? '',
		sshPublicBaseUrl: row.sshPublicBaseUrl ?? '',
		hasPrivateKey: Boolean(row.sshPrivateKeyEnc),
		hasPassphrase: Boolean(row.sshPassphraseEnc)
	};
}

/**
 * Batch-load optional public base URLs for SSH owners.
 * @param {string[]} userIds
 * @returns {Promise<Map<string, string>>}
 */
export async function getSshPublicBaseUrls(userIds) {
	const unique = [...new Set(userIds.filter(Boolean))];
	/** @type {Map<string, string>} */
	const map = new Map();
	if (unique.length === 0) return map;

	const rows = await db
		.select({
			userId: storageSetting.userId,
			sshPublicBaseUrl: storageSetting.sshPublicBaseUrl
		})
		.from(storageSetting)
		.where(inArray(storageSetting.userId, unique));

	for (const row of rows) {
		const normalized = normalizePublicBaseUrl(row.sshPublicBaseUrl);
		if (normalized.ok && normalized.url) map.set(row.userId, normalized.url);
	}
	return map;
}

/**
 * Direct public audio/cover URLs when SSH + public base + published; else nulls.
 *
 * @param {{
 *   storageAdapter?: string | null,
 *   published?: boolean | null,
 *   userId?: string | null,
 *   folderKey?: string | null,
 *   audioFilename?: string | null,
 *   coverFilename?: string | null
 * }} row
 * @param {string | null | undefined} publicBaseUrl
 * @returns {{ audioUrl: string | null, coverUrl: string | null }}
 */
export function resolvePublicTrackMediaUrls(row, publicBaseUrl) {
	if (
		row.storageAdapter !== 'ssh' ||
		!row.published ||
		!publicBaseUrl ||
		!row.userId ||
		!row.folderKey
	) {
		return { audioUrl: null, coverUrl: null };
	}

	const audioUrl = row.audioFilename
		? publicMediaUrl(publicBaseUrl, row.userId, row.folderKey, row.audioFilename)
		: null;
	const coverUrl = row.coverFilename
		? publicMediaUrl(publicBaseUrl, row.userId, row.folderKey, row.coverFilename)
		: null;
	return { audioUrl, coverUrl };
}

/**
 * @param {string} userId
 * @param {{
 *   adapter: string,
 *   sshHost?: string,
 *   sshPort?: string | number,
 *   sshUsername?: string,
 *   sshRemotePath?: string,
 *   sshPublicBaseUrl?: string,
 *   sshPrivateKey?: string,
 *   sshPassphrase?: string,
 *   clearPassphrase?: boolean
 * }} input
 */
export async function saveStorageSetting(userId, input) {
	if (!isEnabledAdapter(input.adapter)) {
		return { ok: false, message: 'Choose Local or SSH / own server.' };
	}

	if (input.adapter !== 'local') {
		const rows = await db
			.select({ plan: profile.plan })
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);

		if (!canUseStorageAdapters(rows[0]?.plan)) {
			return {
				ok: false,
				message:
					'Bringing your own storage is not available on your current plan. See Settings → Billing.'
			};
		}
	}

	const existing = await getOrCreateStorageSetting(userId);

	/** @type {Record<string, unknown>} */
	const patch = {
		adapter: input.adapter,
		updatedAt: new Date()
	};

	if (input.adapter === 'ssh') {
		const host = input.sshHost?.toString().trim() ?? '';
		const username = input.sshUsername?.toString().trim() ?? '';
		const remotePath = input.sshRemotePath?.toString().trim() ?? '';
		const portRaw = input.sshPort?.toString().trim() ?? String(existing.sshPort ?? 22);
		const port = Number.parseInt(portRaw, 10);
		const privateKey = input.sshPrivateKey?.toString() ?? '';
		const passphrase = input.sshPassphrase?.toString() ?? '';
		const publicBase = normalizePublicBaseUrl(input.sshPublicBaseUrl);

		if (!host) return { ok: false, message: 'SSH host is required.' };
		if (!username) return { ok: false, message: 'SSH username is required.' };
		if (!remotePath) return { ok: false, message: 'Remote base path is required.' };
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			return { ok: false, message: 'SSH port must be between 1 and 65535.' };
		}
		if (!privateKey.trim() && !existing.sshPrivateKeyEnc) {
			return { ok: false, message: 'Paste an SSH private key.' };
		}
		if (!publicBase.ok) return publicBase;

		const hostCheck = await assertPublicSshHost(host);
		if (!hostCheck.ok) return hostCheck;

		patch.sshHost = host;
		patch.sshPort = port;
		patch.sshUsername = username;
		patch.sshRemotePath = remotePath;
		patch.sshPublicBaseUrl = publicBase.url;

		if (privateKey.trim()) {
			patch.sshPrivateKeyEnc = encryptSecret(privateKey.trim());
		}

		if (input.clearPassphrase) {
			patch.sshPassphraseEnc = null;
		} else if (passphrase) {
			patch.sshPassphraseEnc = encryptSecret(passphrase);
		}
	}

	await db.update(storageSetting).set(patch).where(eq(storageSetting.userId, userId));

	return { ok: true };
}

/**
 * @param {typeof storageSetting.$inferSelect} row
 */
function sshConfigFromRow(row) {
	if (!row.sshHost || !row.sshUsername || !row.sshRemotePath || !row.sshPrivateKeyEnc) {
		throw new Error('SSH storage is not fully configured.');
	}

	return {
		host: row.sshHost,
		port: row.sshPort ?? 22,
		username: row.sshUsername,
		remotePath: row.sshRemotePath,
		privateKey: decryptSecret(row.sshPrivateKeyEnc),
		passphrase: row.sshPassphraseEnc ? decryptSecret(row.sshPassphraseEnc) : null
	};
}

/**
 * Resolve the storage adapter for a user based on their preference.
 * @param {string} userId
 * @param {'local' | 'ssh'} [forceAdapter]
 * @returns {Promise<import('./types.js').StorageAdapter>}
 */
export async function getStorageAdapter(userId, forceAdapter) {
	const row = await getOrCreateStorageSetting(userId);
	const adapterId = forceAdapter ?? row.adapter;

	if (adapterId === 'ssh') {
		return createSshAdapter(userId, sshConfigFromRow(row));
	}

	return createLocalAdapter(userId);
}

/**
 * Test the user's currently configured SSH connection (or local root).
 * @param {string} userId
 * @param {'local' | 'ssh'} [adapter]
 */
export async function testStorageConnection(userId, adapter) {
	try {
		const resolved = await getStorageAdapter(userId, adapter);
		return await resolved.testConnection();
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error ? err.message : 'Storage connection failed.'
		};
	}
}
