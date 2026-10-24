/**
 * Where a signed-out like (or comment) should send the visitor so they land
 * back on this page. Apex and custom domains with visitor accounts use this
 * host's `/signin`. Other tenant hosts have no sign-in page; the apex signs
 * them in and returns them here.
 *
 * @param {{
 *   signedIn?: boolean,
 *   pathname: string,
 *   search?: string,
 *   hash?: string,
 *   origin: string,
 *   tenantHostKind?: string | null,
 *   domainAuth?: boolean,
 *   apexOrigin?: string | null
 * }} input
 * @returns {string | null}
 */
export function likeSignInHref(input) {
	if (input.signedIn) return null;
	const next = `${input.pathname}${input.search ?? ''}${input.hash ?? ''}` || '/';
	if (!input.tenantHostKind || input.domainAuth) {
		return `/signin?next=${encodeURIComponent(next)}`;
	}
	const apex = (input.apexOrigin ?? '').replace(/\/$/, '');
	if (!apex) return `/signin?next=${encodeURIComponent(next)}`;
	let back = next;
	try {
		back = new URL(next, input.origin).toString();
	} catch {
		// Keep the relative path; the apex form ignores a broken return.
	}
	return `${apex}/signin?return=${encodeURIComponent(back)}`;
}
