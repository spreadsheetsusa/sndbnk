import { Client } from 'ssh2';
import path from 'node:path';

import { assertSafeStorageSegment } from './path-safety.js';
import { assertPublicSshHost } from './ssh-host.js';

/**
 * @typedef {Object} SshConfig
 * @property {string} host
 * @property {number} port
 * @property {string} username
 * @property {string} remotePath
 * @property {string} privateKey
 * @property {string | null} [passphrase]
 */

/**
 * @param {import('ssh2').SFTPWrapper} sftp
 * @param {string} dir
 */
function mkdirp(sftp, dir) {
	const normalized = dir.replace(/\\/g, '/').replace(/\/+$/, '');
	if (!normalized || normalized === '/') {
		return Promise.resolve();
	}

	const parts = normalized.split('/').filter(Boolean);
	let current = normalized.startsWith('/') ? '/' : '';

	return parts.reduce(async (prev, part) => {
		await prev;
		current = current === '/' ? `/${part}` : current ? `${current}/${part}` : part;
		await new Promise((resolve, reject) => {
			sftp.mkdir(current, (err) => {
				if (!err || /** @type {{ code?: number }} */ (err).code === 4) {
					// 4 = failure / already exists on many servers
					resolve(undefined);
					return;
				}
				// Ignore "already exists" style errors from OpenSSH (EEXIST)
				if (err.message?.includes('Failure') || err.message?.toLowerCase().includes('exist')) {
					resolve(undefined);
					return;
				}
				sftp.stat(current, (statErr) => {
					if (!statErr) resolve(undefined);
					else reject(err);
				});
			});
		});
	}, Promise.resolve());
}

/**
 * @param {SshConfig} config
 * @returns {Promise<{ client: import('ssh2').Client, sftp: import('ssh2').SFTPWrapper }>}
 */
async function connect(config) {
	const hostCheck = await assertPublicSshHost(config.host);
	if (!hostCheck.ok) {
		throw new Error(hostCheck.message);
	}

	return new Promise((resolve, reject) => {
		const client = new Client();
		client
			.on('ready', () => {
				client.sftp((err, sftp) => {
					if (err) {
						client.end();
						reject(err);
						return;
					}
					resolve({ client, sftp });
				});
			})
			.on('error', reject)
			.connect({
				host: config.host,
				port: config.port,
				username: config.username,
				privateKey: config.privateKey,
				passphrase: config.passphrase || undefined,
				readyTimeout: 15000
			});
	});
}

/**
 * @param {import('ssh2').Client} client
 */
function close(client) {
	try {
		client.end();
	} catch {
		// ignore
	}
}

/**
 * @param {string} userId
 * @param {SshConfig} config
 * @param {string} folderKey
 */
function remoteFolder(userId, config, folderKey) {
	assertSafeStorageSegment(userId, 'user id');
	assertSafeStorageSegment(folderKey, 'folder key');
	return path.posix.join(config.remotePath.replace(/\\/g, '/'), userId, folderKey);
}

/**
 * @param {string} userId
 * @param {SshConfig} config
 * @returns {import('./types.js').StorageAdapter}
 */
export function createSshAdapter(userId, config) {
	assertSafeStorageSegment(userId, 'user id');

	return {
		id: 'ssh',

		async put(folderKey, filename, data, _contentType) {
			assertSafeStorageSegment(filename, 'filename');
			const { client, sftp } = await connect(config);
			try {
				const dir = remoteFolder(userId, config, folderKey);
				await mkdirp(sftp, dir);
				const bytes =
					data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : Buffer.from(data);
				const remotePath = path.posix.join(dir, filename);
				await new Promise((resolve, reject) => {
					sftp.writeFile(remotePath, bytes, (err) => (err ? reject(err) : resolve(undefined)));
				});
			} finally {
				close(client);
			}
		},

		async get(folderKey, filename, range) {
			assertSafeStorageSegment(filename, 'filename');
			const { client, sftp } = await connect(config);
			try {
				const remotePath = path.posix.join(remoteFolder(userId, config, folderKey), filename);
				const contentType = 'application/octet-stream';

				if (!range) {
					const body = await new Promise((resolve, reject) => {
						sftp.readFile(remotePath, (err, data) => (err ? reject(err) : resolve(data)));
					});
					return {
						body: new Uint8Array(body),
						contentType,
						size: body.length
					};
				}

				/** @type {import('ssh2').Stats} */
				const stat = await new Promise((resolve, reject) => {
					sftp.stat(remotePath, (err, data) => (err ? reject(err) : resolve(data)));
				});
				const size = stat.size;
				const start = Math.max(0, range.start);
				const end = Math.min(range.end ?? size - 1, size - 1);
				if (size <= 0 || start > end) {
					return { body: new Uint8Array(0), contentType, size };
				}

				const body = await new Promise((resolve, reject) => {
					/** @type {Buffer[]} */
					const chunks = [];
					const stream = sftp.createReadStream(remotePath, { start, end });
					stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
					stream.on('error', reject);
					stream.on('end', () => resolve(Buffer.concat(chunks)));
				});
				return {
					body: new Uint8Array(body),
					contentType,
					size
				};
			} finally {
				close(client);
			}
		},

		async delete(folderKey) {
			const { client, sftp } = await connect(config);
			try {
				const dir = remoteFolder(userId, config, folderKey);
				const entries = await new Promise((resolve, reject) => {
					sftp.readdir(dir, (err, list) => {
						if (err) {
							if (/** @type {{ code?: number }} */ (err).code === 2) {
								resolve([]);
								return;
							}
							reject(err);
							return;
						}
						resolve(list ?? []);
					});
				});

				for (const entry of entries) {
					const filePath = path.posix.join(dir, entry.filename);
					await new Promise((resolve, reject) => {
						sftp.unlink(filePath, (err) => (err ? reject(err) : resolve(undefined)));
					});
				}

				await new Promise((resolve, reject) => {
					sftp.rmdir(dir, (err) => {
						if (!err || /** @type {{ code?: number }} */ (err).code === 2) resolve(undefined);
						else reject(err);
					});
				});
			} finally {
				close(client);
			}
		},

		async deleteObject(folderKey, filename) {
			assertSafeStorageSegment(filename, 'filename');
			const { client, sftp } = await connect(config);
			try {
				const remotePath = path.posix.join(remoteFolder(userId, config, folderKey), filename);
				await new Promise((resolve, reject) => {
					sftp.unlink(remotePath, (err) => {
						if (!err || /** @type {{ code?: number }} */ (err).code === 2) resolve(undefined);
						else reject(err);
					});
				});
			} finally {
				close(client);
			}
		},

		async testConnection() {
			try {
				const { client, sftp } = await connect(config);
				try {
					await mkdirp(sftp, config.remotePath.replace(/\\/g, '/'));
					await new Promise((resolve, reject) => {
						sftp.readdir(config.remotePath.replace(/\\/g, '/'), (err) =>
							err ? reject(err) : resolve(undefined)
						);
					});
					return { ok: true };
				} finally {
					close(client);
				}
			} catch (err) {
				return {
					ok: false,
					message: err instanceof Error ? err.message : 'Could not connect over SSH/SFTP.'
				};
			}
		}
	};
}
