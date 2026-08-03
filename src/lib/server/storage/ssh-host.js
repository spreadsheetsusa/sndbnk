import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
	'localhost',
	'metadata.google.internal',
	'metadata',
	'instance-data'
]);

/**
 * @param {string} ip
 */
export function isBlockedIp(ip) {
	const version = isIP(ip);
	if (version === 4) {
		const parts = ip.split('.').map((p) => Number(p));
		const [a, b] = parts;
		if (a === 0 || a === 127 || a === 10) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
		if (a >= 224) return true; // multicast / reserved
		return false;
	}
	if (version === 6) {
		const normalized = ip.toLowerCase();
		if (normalized === '::1' || normalized === '::') return true;
		if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
		if (
			normalized.startsWith('fe8') ||
			normalized.startsWith('fe9') ||
			normalized.startsWith('fea') ||
			normalized.startsWith('feb')
		) {
			return true; // link-local
		}
		// IPv4-mapped
		if (normalized.startsWith(':ffff:')) {
			const v4 = normalized.slice(7);
			if (isIP(v4) === 4) return isBlockedIp(v4);
		}
		return false;
	}
	return true;
}

/**
 * Resolve host and reject private / link-local / metadata targets.
 * @param {string} host
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function assertPublicSshHost(host) {
	const trimmed = host.trim().toLowerCase().replace(/\.$/, '');
	if (!trimmed) return { ok: false, message: 'SSH host is required.' };
	if (BLOCKED_HOSTNAMES.has(trimmed)) {
		return { ok: false, message: 'That SSH host is not allowed.' };
	}
	if (trimmed.endsWith('.local') || trimmed.endsWith('.internal')) {
		return { ok: false, message: 'That SSH host is not allowed.' };
	}

	if (isIP(trimmed)) {
		if (isBlockedIp(trimmed)) {
			return { ok: false, message: 'SSH host must be a public address.' };
		}
		return { ok: true };
	}

	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(trimmed)) {
		return { ok: false, message: 'SSH host looks invalid.' };
	}

	try {
		const results = await lookup(trimmed, { all: true, verbatim: true });
		if (results.length === 0) {
			return { ok: false, message: 'Could not resolve SSH host.' };
		}
		for (const { address } of results) {
			if (isBlockedIp(address)) {
				return { ok: false, message: 'SSH host must resolve to a public address.' };
			}
		}
		return { ok: true };
	} catch {
		return { ok: false, message: 'Could not resolve SSH host.' };
	}
}
