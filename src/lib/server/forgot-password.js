import { APIError } from 'better-auth/api';

import { auth } from '#lib/server/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Start a password reset: better-auth emails a one-time link when the address
 * exists. Always returns a generic success so the response does not enumerate.
 *
 * @param {{ emailRaw: string, headers: Headers }} input
 * @returns {Promise<{ ok: true, message: string, email: string } | { ok: false, message: string, email: string }>}
 */
export async function requestPasswordResetEmail({ emailRaw, headers }) {
	const email = emailRaw.trim().toLowerCase();

	if (!email) {
		return { ok: false, message: 'Enter your email address.', email };
	}

	if (!EMAIL_PATTERN.test(email)) {
		return { ok: false, message: 'Enter a valid email address.', email };
	}

	try {
		await auth.api.requestPasswordReset({
			body: { email, redirectTo: '/reset-password' },
			headers
		});
	} catch (error) {
		if (error instanceof APIError) {
			return {
				ok: false,
				message: error.message || 'Could not start the password reset.',
				email
			};
		}
		return { ok: false, message: 'Something went wrong. Please try again.', email };
	}

	return {
		ok: true,
		message: 'If that email is on file, we sent a reset link.',
		email
	};
}

/**
 * Set a new password from a reset token emailed by better-auth.
 *
 * @param {{
 *   token: string,
 *   password: string,
 *   confirmPassword: string,
 *   headers: Headers
 * }} input
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function resetPasswordWithToken({ token, password, confirmPassword, headers }) {
	if (!token) {
		return { ok: false, message: 'This reset link is invalid or has expired.' };
	}

	if (!password || !confirmPassword) {
		return { ok: false, message: 'Enter a new password and confirm it.' };
	}

	if (password.length < MIN_PASSWORD_LENGTH) {
		return { ok: false, message: 'Use at least 8 characters.' };
	}

	if (password !== confirmPassword) {
		return { ok: false, message: 'Password and confirmation do not match.' };
	}

	try {
		await auth.api.resetPassword({
			body: { newPassword: password, token },
			headers
		});
	} catch (error) {
		if (error instanceof APIError) {
			return {
				ok: false,
				message: error.message || 'This reset link is invalid or has expired.'
			};
		}
		return { ok: false, message: 'Something went wrong. Please try again.' };
	}

	return { ok: true };
}
