/**
 * Normalize a public media base URL: absolute http(s), no trailing slash.
 * Empty / whitespace → null (serve via app proxy).
 *
 * @param {string | null | undefined} value
 * @returns {{ ok: true, url: string | null } | { ok: false, message: string }}
 */
export function normalizePublicBaseUrl(value) {
	const raw = value?.toString().trim() ?? '';
	if (!raw) return { ok: true, url: null };

	let parsed;
	try {
		parsed = new URL(raw);
	} catch {
		return { ok: false, message: 'Public base URL must be a valid absolute URL.' };
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return { ok: false, message: 'Public base URL must start with http:// or https://.' };
	}

	const path = parsed.pathname.replace(/\/+$/, '');
	parsed.pathname = path || '';
	parsed.search = '';
	parsed.hash = '';

	const href = parsed.toString().replace(/\/+$/, '');
	return { ok: true, url: href };
}

/**
 * Build a browser-facing object URL under a public base.
 * Layout matches SFTP: `{base}/{userId}/{folderKey}/{filename}`.
 *
 * @param {string} base
 * @param {string} userId
 * @param {string} folderKey
 * @param {string} filename
 */
export function publicMediaUrl(base, userId, folderKey, filename) {
	const root = base.replace(/\/+$/, '');
	const segments = [userId, folderKey, filename].map((part) =>
		encodeURIComponent(part).replace(/%2F/gi, '/')
	);
	return `${root}/${segments.join('/')}`;
}
