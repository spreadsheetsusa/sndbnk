import { ORIGIN } from '$app/env/private';

import { sendMail } from './index.js';

const origin = ORIGIN.replace(/\/$/, '');

/**
 * @param {{ to: string, name: string, username: string }} input
 */
export function sendWelcomeMail({ to, name, username }) {
	return sendMail({
		to,
		subject: 'Welcome to SNDBNK',
		text: `${name},

Your account is live. Your profile is at ${origin}/users/${username}.

Upload your first track: ${origin}/library/new

— SNDBNK`
	});
}

/**
 * @param {{ to: string, name: string, planLabel: string, interval: string }} input
 */
export function sendPlanChangedMail({ to, name, planLabel, interval }) {
	return sendMail({
		to,
		subject: `You're on SNDBNK ${planLabel}`,
		text: `${name},

You're now on ${planLabel}, billed ${interval === 'year' ? 'yearly' : 'monthly'}.

Manage your plan and invoices any time at ${origin}/settings?tab=billing.

— SNDBNK`
	});
}

/**
 * @param {{ to: string, name: string, planLabel: string }} input
 */
export function sendPaymentFailedMail({ to, name, planLabel }) {
	return sendMail({
		to,
		subject: 'Your SNDBNK payment did not go through',
		text: `${name},

We could not charge your card for ${planLabel}. Your account keeps working for now, but we will retry over the next few days.

Update your payment method at ${origin}/settings?tab=billing.

— SNDBNK`
	});
}

/**
 * @param {{ to: string, name: string }} input
 */
export function sendSubscriptionCanceledMail({ to, name }) {
	return sendMail({
		to,
		subject: 'Your SNDBNK subscription has ended',
		text: `${name},

Your subscription has ended and your account is back on Basic. Your tracks are safe — subdomain and custom domain hosting are paused.

Resubscribe any time at ${origin}/plans.

— SNDBNK`
	});
}
