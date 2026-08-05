import { escapeHtml, MAIL_BRAND } from './layout.js';
import {
	mailBullets,
	mailChip,
	mailCta,
	mailEyebrow,
	mailGreeting,
	mailHtml,
	mailLink,
	mailP,
	mailPanel,
	mailRule,
	mailSignoff,
	mailTierLines
} from './parts.js';
import { welcomePlanCopy, welcomePlanText } from './welcome-copy.js';

/**
 * @typedef {{ subject: string, preheader: string, text: string, bodyHtml: string }} MailContent
 */

/**
 * @param {{ name: string, username: string, planId?: string | null, origin: string }} input
 * @returns {MailContent}
 */
export function buildWelcomeMail({ name, username, planId = 'free', origin }) {
	const base = origin.replace(/\/$/, '');
	const profileUrl = `${base}/users/${username}`;
	const libraryUrl = `${base}/library`;
	const plan = welcomePlanCopy({ planId, origin: base });
	const ink = MAIL_BRAND.light.ink;

	const panelInner = [
		`<div style="margin:0 0 10px;">${mailChip(plan.planLabel)}</div>`,
		`<p class="mail-ink" style="margin:0 0 14px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${ink};">${escapeHtml(plan.blurb)}</p>`,
		mailEyebrow('What you have', { tight: true }),
		mailBullets(plan.features)
	].join('');

	const nextBlock = plan.nextTiers.length
		? [
				mailRule(),
				mailEyebrow('When you want more signal'),
				mailTierLines(plan.nextTiers),
				mailHtml(`${mailLink(plan.plansUrl, 'Compare plans')} — no rush.`)
			].join('')
		: '';

	return {
		subject: 'Welcome to SNDBNK',
		preheader: `You're on ${plan.planLabel}. Your profile is ready.`,
		bodyHtml: [
			mailGreeting(name),
			mailP('Your account is live. Quiet on the outside. Loud when you need it.'),
			mailHtml(`Your profile is ${mailLink(profileUrl, profileUrl.replace(/^https?:\/\//, ''))}.`),
			mailCta(libraryUrl, 'Upload a track'),
			mailPanel(panelInner),
			nextBlock,
			mailSignoff()
		].join(''),
		text: `${name},

Your account is live. Quiet on the outside. Loud when you need it.

Your profile: ${profileUrl}
Upload your first track: ${libraryUrl}

${welcomePlanText(plan)}

— SNDBNK`
	};
}

/**
 * @param {{ name: string, planLabel: string, interval: string, planId?: string | null, origin: string }} input
 * @returns {MailContent}
 */
export function buildPlanChangedMail({ name, planLabel, interval, planId, origin }) {
	const base = origin.replace(/\/$/, '');
	const billingUrl = `${base}/settings?tab=billing`;
	const cadence = interval === 'year' ? 'yearly' : 'monthly';
	const plan = planId ? welcomePlanCopy({ planId, origin: base }) : null;
	const featuresBlock = plan?.features?.length
		? [mailEyebrow('Now unlocked'), mailBullets(plan.features)].join('')
		: '';
	const featureText = plan?.features?.length
		? `\nNow unlocked\n${plan.features.map((item) => `· ${item}`).join('\n')}\n`
		: '';

	return {
		subject: `You're on SNDBNK ${planLabel}`,
		preheader: `${planLabel}, billed ${cadence}.`,
		bodyHtml: [
			mailGreeting(name),
			mailP(`You're now on ${planLabel}, billed ${cadence}.`),
			featuresBlock,
			mailCta(billingUrl, 'Manage billing'),
			mailSignoff()
		].join(''),
		text: `${name},

You're now on ${planLabel}, billed ${cadence}.
${featureText}
Manage your plan and invoices any time at ${billingUrl}.

— SNDBNK`
	};
}

/**
 * @param {{ name: string, planLabel: string, origin: string }} input
 * @returns {MailContent}
 */
export function buildPaymentFailedMail({ name, planLabel, origin }) {
	const billingUrl = `${origin.replace(/\/$/, '')}/settings?tab=billing`;
	return {
		subject: 'Your SNDBNK payment did not go through',
		preheader: 'Update your payment method to keep your plan.',
		bodyHtml: [
			mailGreeting(name),
			mailP(
				`We could not charge your card for ${planLabel}. Your account keeps working for now, but we will retry over the next few days.`
			),
			mailCta(billingUrl, 'Update payment method'),
			mailSignoff()
		].join(''),
		text: `${name},

We could not charge your card for ${planLabel}. Your account keeps working for now, but we will retry over the next few days.

Update your payment method at ${billingUrl}.

— SNDBNK`
	};
}

/**
 * @param {{ name: string, origin: string }} input
 * @returns {MailContent}
 */
export function buildSubscriptionCanceledMail({ name, origin }) {
	const plansUrl = `${origin.replace(/\/$/, '')}/plans`;
	return {
		subject: 'Your SNDBNK subscription has ended',
		preheader: 'Back on Free. Your tracks are safe.',
		bodyHtml: [
			mailGreeting(name),
			mailP(
				'Your subscription has ended and your account is back on Free. Your tracks are safe — subdomain and custom domain hosting are paused.'
			),
			mailCta(plansUrl, 'View plans'),
			mailSignoff()
		].join(''),
		text: `${name},

Your subscription has ended and your account is back on Free. Your tracks are safe — subdomain and custom domain hosting are paused.

Resubscribe any time at ${plansUrl}.

— SNDBNK`
	};
}

/**
 * @param {{ name: string, url: string }} input
 * @returns {MailContent}
 */
export function buildVerifyEmailChangeMail({ name, url }) {
	return {
		subject: 'Confirm your new SNDBNK email',
		preheader: 'One tap to confirm your new sign-in email.',
		bodyHtml: [
			mailGreeting(name),
			mailP('Confirm this address to use it for SNDBNK sign-in.'),
			mailCta(url, 'Confirm email'),
			mailP(
				'If you did not request this, you can ignore this message — your sign-in email stays the same.'
			),
			mailSignoff()
		].join(''),
		text: `${name},

Confirm this address to use it for SNDBNK sign-in:

${url}

If you did not request this, you can ignore this message — your sign-in email stays the same.

— SNDBNK`
	};
}

/**
 * @param {{ name: string, url: string }} input
 * @returns {MailContent}
 */
export function buildResetPasswordMail({ name, url }) {
	return {
		subject: 'Reset your SNDBNK password',
		preheader: 'A one-time link to reset your password.',
		bodyHtml: [
			mailGreeting(name),
			mailP('Reset your SNDBNK password with this link.'),
			mailCta(url, 'Reset password'),
			mailP(
				'If you did not request this, you can ignore this message — your password stays the same.'
			),
			mailSignoff()
		].join(''),
		text: `${name},

Reset your SNDBNK password with this link:

${url}

If you did not request this, you can ignore this message — your password stays the same.

— SNDBNK`
	};
}
