import { promises as dns } from 'node:dns';

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeDomain(value) {
	return value
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/\/.*$/, '')
		.replace(/\.$/, '');
}

/**
 * @param {string} value
 * @returns {{ ok: true, domain: string } | { ok: false, message: string }}
 */
export function validateDomain(value) {
	const domain = normalizeDomain(value);

	if (!domain) {
		return { ok: false, message: 'Enter a domain.' };
	}

	if (domain.includes('/') || domain.includes(' ') || domain.includes(':')) {
		return { ok: false, message: 'Enter a bare hostname, like music.example.com.' };
	}

	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
		return { ok: false, message: 'That does not look like a valid domain.' };
	}

	if (domain.split('.').length < 2) {
		return { ok: false, message: 'Include the full domain, including the TLD.' };
	}

	return { ok: true, domain };
}

/**
 * @returns {string}
 */
export function createDomainVerifyToken() {
	return `sndbnk-verify=${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * @param {string} domain
 * @param {string} token
 */
export async function hasMatchingTxtRecord(domain, token) {
	const names = [`_sndbnk-verify.${domain}`, domain];

	for (const name of names) {
		try {
			const records = await dns.resolveTxt(name);
			const flat = records.map((chunks) => chunks.join(''));
			if (flat.some((record) => record.trim() === token)) {
				return true;
			}
		} catch (error) {
			const code = /** @type {NodeJS.ErrnoException} */ (error).code;
			if (code === 'ENODATA' || code === 'ENOTFOUND' || code === 'ENOMETHOD') {
				continue;
			}
			throw error;
		}
	}

	return false;
}

/**
 * @param {string} domain
 * @param {string} expectedTarget hostname without trailing dot, e.g. flowpoke.sndbnk.com
 */
export async function hasMatchingCname(domain, expectedTarget) {
	const expected = expectedTarget.toLowerCase().replace(/\.$/, '');

	try {
		const records = await dns.resolveCname(domain);
		return records.some((record) => record.toLowerCase().replace(/\.$/, '') === expected);
	} catch (error) {
		const code = /** @type {NodeJS.ErrnoException} */ (error).code;
		if (code === 'ENODATA' || code === 'ENOTFOUND' || code === 'ENOMETHOD') {
			return false;
		}
		throw error;
	}
}

/**
 * @param {{ domain: string, token: string, cnameTarget: string }} input
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function verifyCustomDomain({ domain, token, cnameTarget }) {
	const txtOk = await hasMatchingTxtRecord(domain, token);
	if (!txtOk) {
		return {
			ok: false,
			message: `Add a TXT record at _sndbnk-verify.${domain} (or the root) with value ${token}, then try again.`
		};
	}

	const cnameOk = await hasMatchingCname(domain, cnameTarget);
	if (!cnameOk) {
		return {
			ok: false,
			message: `Point a CNAME for ${domain} to ${cnameTarget}, then try again.`
		};
	}

	return { ok: true };
}
