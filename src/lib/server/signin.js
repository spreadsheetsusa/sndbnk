import { getProfileByUsername } from '#lib/server/tenant';
import { normalizeUsername } from '#lib/server/username';

/**
 * Syntactically valid address that cannot belong to a real account. Used when
 * the identifier is an unknown username so `signInEmail` still hashes the
 * password and returns the same "Invalid email or password" as a bad email.
 */
const UNKNOWN_USERNAME_EMAIL = 'nobody@invalid.example';

/**
 * Map a sign-in identifier (email or profile username) to the credential email
 * better-auth already authenticates. Usernames live on `profile`, not on the
 * auth user row, so the official username plugin is not wired in.
 *
 * @param {string} identifier
 * @returns {Promise<string>}
 */
export async function resolveSignInEmail(identifier) {
	const raw = identifier.trim();
	if (!raw) return UNKNOWN_USERNAME_EMAIL;

	// A leading @ is a handle (`@ben`), not an email. Anything else with @
	// goes through the existing email path unchanged.
	if (raw.includes('@') && !raw.startsWith('@')) {
		return raw;
	}

	const username = normalizeUsername(raw.replace(/^@/, ''));
	if (!username) return UNKNOWN_USERNAME_EMAIL;

	const row = await getProfileByUsername(username);
	return row?.email ?? UNKNOWN_USERNAME_EMAIL;
}
