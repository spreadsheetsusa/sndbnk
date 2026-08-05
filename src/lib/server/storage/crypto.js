import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { STORAGE_SECRET } from '#lib/server/app-env.js';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * @returns {Buffer}
 */
function keyFromSecret() {
	return createHash('sha256').update(STORAGE_SECRET).digest();
}

/**
 * Encrypt a UTF-8 string for at-rest storage.
 * @param {string} plaintext
 * @returns {string} base64(iv + tag + ciphertext)
 */
export function encryptSecret(plaintext) {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGO, keyFromSecret(), iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a value produced by {@link encryptSecret}.
 * @param {string} payload
 * @returns {string}
 */
export function decryptSecret(payload) {
	const buf = Buffer.from(payload, 'base64');
	if (buf.length < IV_BYTES + 16) {
		throw new Error('Invalid encrypted payload.');
	}
	const iv = buf.subarray(0, IV_BYTES);
	const tag = buf.subarray(IV_BYTES, IV_BYTES + 16);
	const ciphertext = buf.subarray(IV_BYTES + 16);
	const decipher = createDecipheriv(ALGO, keyFromSecret(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
