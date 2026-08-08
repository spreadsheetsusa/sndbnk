import { ORIGIN } from '$app/env/private';

import {
	buildAccountLinkRequestMail,
	buildPaymentFailedMail,
	buildPlanChangedMail,
	buildResetPasswordMail,
	buildSubscriptionCanceledMail,
	buildVerifyEmailChangeMail,
	buildWelcomeMail
} from './compose.js';
import { wrapMail } from './layout.js';
import { sendMail } from './index.js';

const origin = ORIGIN.replace(/\/$/, '');

/**
 * @param {{ to: string, subject: string, preheader: string, text: string, bodyHtml: string }} input
 */
function sendBrandedMail({ to, subject, preheader, text, bodyHtml }) {
	return sendMail({
		to,
		subject,
		text,
		html: wrapMail({ origin, preheader, bodyHtml })
	});
}

/**
 * @param {{ to: string, name: string, username: string, planId?: string | null }} input
 */
export function sendWelcomeMail({ to, name, username, planId = 'free' }) {
	return sendBrandedMail({
		to,
		...buildWelcomeMail({ name, username, planId, origin })
	});
}

/**
 * @param {{ to: string, name: string, planLabel: string, interval: string, planId?: string | null }} input
 */
export function sendPlanChangedMail({ to, name, planLabel, interval, planId }) {
	return sendBrandedMail({
		to,
		...buildPlanChangedMail({ name, planLabel, interval, planId, origin })
	});
}

/**
 * @param {{ to: string, name: string, planLabel: string }} input
 */
export function sendPaymentFailedMail({ to, name, planLabel }) {
	return sendBrandedMail({
		to,
		...buildPaymentFailedMail({ name, planLabel, origin })
	});
}

/**
 * @param {{ to: string, name: string }} input
 */
export function sendSubscriptionCanceledMail({ to, name }) {
	return sendBrandedMail({
		to,
		...buildSubscriptionCanceledMail({ name, origin })
	});
}

/**
 * @param {{ to: string, name: string, url: string }} input
 */
export function sendVerifyEmailChangeMail({ to, name, url }) {
	return sendBrandedMail({
		to,
		...buildVerifyEmailChangeMail({ name, url })
	});
}

/**
 * @param {{ to: string, name: string, url: string }} input
 */
export function sendResetPasswordMail({ to, name, url }) {
	return sendBrandedMail({
		to,
		...buildResetPasswordMail({ name, url })
	});
}

/**
 * @param {{ to: string, name: string, fromName: string, fromUsername: string, url: string }} input
 */
export function sendAccountLinkRequestMail({ to, name, fromName, fromUsername, url }) {
	return sendBrandedMail({
		to,
		...buildAccountLinkRequestMail({ name, fromName, fromUsername, url })
	});
}

export {
	buildAccountLinkRequestMail,
	buildPaymentFailedMail,
	buildPlanChangedMail,
	buildResetPasswordMail,
	buildSubscriptionCanceledMail,
	buildVerifyEmailChangeMail,
	buildWelcomeMail
} from './compose.js';
