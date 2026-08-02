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
 * True when the hostname is a naked registrable-looking name (no subdomain label).
 * Used for UI copy and www↔apex aliasing — multi-part TLDs like example.co.uk still need
 * A/ALIAS at the apex and do not get automatic www pairing.
 * @param {string} domain
 */
export function isLikelyApexDomain(domain) {
	const host = normalizeDomain(domain);
	if (!host || host.startsWith('www.')) return false;
	return host.split('.').length === 2;
}

/**
 * Hostnames that should resolve to the same profile for a saved custom domain.
 * Pairs example.com ↔ www.example.com only (not music.example.com).
 * @param {string} hostname
 * @returns {string[]}
 */
export function customDomainCandidates(hostname) {
	const host = normalizeDomain(hostname);
	if (!host) return [];

	const keys = [host];
	if (host.startsWith('www.') && isLikelyApexDomain(host.slice(4))) {
		keys.push(host.slice(4));
	} else if (isLikelyApexDomain(host)) {
		keys.push(`www.${host}`);
	}
	return keys;
}

/**
 * @param {string | null | undefined} stored
 * @param {string} hostname
 */
export function customDomainMatches(stored, hostname) {
	if (!stored) return false;
	return customDomainCandidates(stored).includes(normalizeDomain(hostname));
}

/**
 * @returns {string}
 */
export function createDomainVerifyToken() {
	return `sndbnk-verify=${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * @param {unknown} error
 */
function isDnsMiss(error) {
	const code = /** @type {NodeJS.ErrnoException} */ (error).code;
	return code === 'ENODATA' || code === 'ENOTFOUND' || code === 'ENOMETHOD';
}

/**
 * Resolve A + AAAA for a hostname (follows CNAMEs the resolver already flattens).
 * @param {string} hostname
 * @returns {Promise<string[]>}
 */
export async function resolveHostAddresses(hostname) {
	const host = normalizeDomain(hostname);
	if (!host) return [];

	/** @type {Set<string>} */
	const addresses = new Set();

	for (const lookup of [dns.resolve4, dns.resolve6]) {
		try {
			for (const address of await lookup(host)) {
				addresses.add(address);
			}
		} catch (error) {
			if (!isDnsMiss(error)) throw error;
		}
	}

	return [...addresses].sort();
}

/**
 * Walk a CNAME chain (direct records only; does not require address resolution).
 * @param {string} domain
 * @param {number} [maxHops]
 * @returns {Promise<string[]>}
 */
export async function resolveCnameChain(domain, maxHops = 8) {
	const chain = [];
	const seen = new Set();
	let current = normalizeDomain(domain);

	for (let hop = 0; hop < maxHops; hop++) {
		if (!current || seen.has(current)) break;
		seen.add(current);

		try {
			const records = await dns.resolveCname(current);
			const next = records[0] ? normalizeDomain(records[0]) : '';
			if (!next) break;
			chain.push(next);
			current = next;
		} catch (error) {
			if (isDnsMiss(error)) break;
			throw error;
		}
	}

	return chain;
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
			if (isDnsMiss(error)) continue;
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
	const expected = normalizeDomain(expectedTarget);
	const chain = await resolveCnameChain(domain);
	return chain.includes(expected);
}

/**
 * Platform edge addresses creators should aim A/AAAA (or ALIAS) records at.
 * Prefers the per-user subdomain; falls back to the apex when wildcard DNS is missing.
 * @param {string} cnameTarget
 * @param {string} [baseDomain]
 * @returns {Promise<string[]>}
 */
export async function resolvePlatformAddresses(cnameTarget, baseDomain) {
	const fromTarget = await resolveHostAddresses(cnameTarget);
	if (fromTarget.length > 0) return fromTarget;
	if (!baseDomain) return [];
	return resolveHostAddresses(baseDomain);
}

/**
 * Hostname points at the platform via CNAME chain and/or matching A/AAAA.
 * @param {string} domain
 * @param {string} cnameTarget
 * @param {string[]} platformAddresses
 */
export async function hostPointsToPlatform(domain, cnameTarget, platformAddresses) {
	if (await hasMatchingCname(domain, cnameTarget)) return true;

	if (platformAddresses.length === 0) return false;

	const actual = await resolveHostAddresses(domain);
	const expected = new Set(platformAddresses);
	return actual.some((address) => expected.has(address));
}

/**
 * @param {{
 *   domain: string,
 *   token: string,
 *   cnameTarget: string,
 *   baseDomain?: string
 * }} input
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function verifyCustomDomain({ domain, token, cnameTarget, baseDomain }) {
	const txtOk = await hasMatchingTxtRecord(domain, token);
	if (!txtOk) {
		return {
			ok: false,
			message: `Add a TXT record at _sndbnk-verify.${domain} (or the root) with value ${token}, then try again.`
		};
	}

	const platformAddresses = await resolvePlatformAddresses(cnameTarget, baseDomain);
	if (platformAddresses.length === 0) {
		return {
			ok: false,
			message: `Could not resolve ${cnameTarget} (or ${baseDomain ?? 'the site apex'}). Platform DNS may be misconfigured — try again shortly.`
		};
	}

	const pointingOk = await hostPointsToPlatform(domain, cnameTarget, platformAddresses);
	if (!pointingOk) {
		const addressList = platformAddresses.join(', ');
		return {
			ok: false,
			message: `Point ${domain} at SNDBNK: CNAME to ${cnameTarget}, or A/AAAA (or ALIAS/ANAME) to ${addressList}, then try again.`
		};
	}

	return { ok: true };
}
