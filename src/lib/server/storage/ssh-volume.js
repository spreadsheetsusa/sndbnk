const MAX_BYTES = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * @param {unknown} value
 */
function asBig(value) {
	if (typeof value === 'bigint') return value;
	if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
	if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
	return 0n;
}

/**
 * @param {bigint} value
 */
function toSafeNumber(value) {
	if (value <= 0n) return 0;
	if (value > MAX_BYTES) return Number.MAX_SAFE_INTEGER;
	return Number(value);
}

/**
 * @param {bigint} total
 * @param {bigint} free
 * @returns {{ usedBytes: number, totalBytes: number } | null}
 */
function volumeFromBytes(total, free) {
	if (total <= 0n) return null;
	const used = total > free ? total - free : 0n;
	return { usedBytes: toSafeNumber(used), totalBytes: toSafeNumber(total) };
}

/**
 * OpenSSH statvfs reply. Free space is what this account can still write
 * (`f_bavail`), so root-reserved blocks count as used.
 *
 * @param {Record<string, unknown> | null | undefined} stats
 * @returns {{ usedBytes: number, totalBytes: number } | null}
 */
export function volumeFromStatvfs(stats) {
	if (!stats) return null;
	const frsize = asBig(stats.f_frsize) || asBig(stats.f_bsize);
	if (frsize <= 0n) return null;
	const total = asBig(stats.f_blocks) * frsize;
	const free = asBig(stats.f_bavail) * frsize;
	return volumeFromBytes(total, free);
}

/**
 * Parse `df -Pk` text. Capacity sits just before the mount point, so a long
 * filesystem name that wraps onto the next line still yields the three block
 * counts (1 KiB units).
 *
 * @param {string} text
 * @returns {{ usedBytes: number, totalBytes: number } | null}
 */
export function volumeFromDf(text) {
	const body = text.split('\n').slice(1).join(' ').replace(/\s+/g, ' ').trim();
	const match = body.match(/(\d+)\s+(\d+)\s+(\d+)\s+\d+%/);
	if (!match) return null;
	const kib = 1024n;
	const total = BigInt(match[1]) * kib;
	const free = BigInt(match[3]) * kib;
	return volumeFromBytes(total, free);
}
