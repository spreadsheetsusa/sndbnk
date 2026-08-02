import { getRequestEvent } from '$app/server';
import { APIError } from 'better-auth/api';

import { auth } from '#lib/server/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Headers for a follow-up auth API call after sign-in in the same action.
 * sveltekitCookies writes the new session onto event.cookies, but the
 * original request Cookie header is still the stale one.
 * @param {Headers} headers
 */
function headersWithFreshCookies(headers) {
	const event = getRequestEvent();
	const next = new Headers(headers);
	const pairs = event.cookies.getAll();
	if (pairs.length > 0) {
		next.set('cookie', pairs.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '));
	}
	return next;
}

/**
 * Start a sign-in email change: password check, then better-auth sends a
 * verify link to the new address. The address updates only after the click.
 *
 * @param {{
 *   currentEmail: string,
 *   newEmailRaw: string,
 *   confirmEmailRaw: string,
 *   password: string,
 *   headers: Headers
 * }} input
 * @returns {Promise<{ ok: true, newEmail: string } | { ok: false, message: string, newEmail: string }>}
 */
export async function requestEmailChange({
	currentEmail,
	newEmailRaw,
	confirmEmailRaw,
	password,
	headers
}) {
	const newEmail = newEmailRaw.trim().toLowerCase();
	const confirmEmail = confirmEmailRaw.trim().toLowerCase();

	if (!newEmail || !confirmEmail || !password) {
		return {
			ok: false,
			message: 'Enter a new email, confirm it, and your current password.',
			newEmail
		};
	}

	if (!EMAIL_PATTERN.test(newEmail)) {
		return { ok: false, message: 'Enter a valid email address.', newEmail };
	}

	if (newEmail !== confirmEmail) {
		return { ok: false, message: 'New email and confirmation do not match.', newEmail };
	}

	if (newEmail === currentEmail.trim().toLowerCase()) {
		return { ok: false, message: 'That is already your sign-in email.', newEmail };
	}

	try {
		await auth.api.verifyPassword({ body: { password }, headers });
	} catch (error) {
		if (error instanceof APIError) {
			return { ok: false, message: 'Current password is incorrect.', newEmail };
		}
		return { ok: false, message: 'Something went wrong. Please try again.', newEmail };
	}

	// changeEmail requires a fresh session; re-sign-in so a day-old tab still works.
	try {
		await auth.api.signInEmail({
			body: { email: currentEmail, password },
			headers
		});
	} catch (error) {
		if (error instanceof APIError) {
			return { ok: false, message: 'Current password is incorrect.', newEmail };
		}
		return { ok: false, message: 'Something went wrong. Please try again.', newEmail };
	}

	try {
		await auth.api.changeEmail({
			body: { newEmail, callbackURL: '/settings?tab=profile&emailUpdated=1' },
			headers: headersWithFreshCookies(headers)
		});
	} catch (error) {
		if (error instanceof APIError) {
			return {
				ok: false,
				message: error.message || 'Could not start the email change.',
				newEmail
			};
		}
		return { ok: false, message: 'Something went wrong. Please try again.', newEmail };
	}

	return { ok: true, newEmail };
}
