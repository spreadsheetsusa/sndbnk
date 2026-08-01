import nodemailer from 'nodemailer';

import { SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_SECURE, SMTP_USER } from '$app/env/private';

/** @type {import('nodemailer').Transporter | null} */
let transport = null;

function getTransport() {
	if (!SMTP_HOST) {
		throw new Error('SMTP_HOST is not set, but MAIL_TRANSPORT is `smtp`.');
	}

	transport ??= nodemailer.createTransport({
		host: SMTP_HOST,
		port: SMTP_PORT,
		secure: SMTP_SECURE,
		auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD ?? '' } : undefined
	});

	return transport;
}

/** @type {import('./types.js').MailAdapter} */
export const smtpAdapter = {
	id: 'smtp',

	async send(message) {
		try {
			await getTransport().sendMail({
				to: message.to,
				from: message.from,
				subject: message.subject,
				text: message.text,
				html: message.html
			});
			return { ok: true };
		} catch (error) {
			return {
				ok: false,
				message: error instanceof Error ? error.message : 'SMTP send failed.'
			};
		}
	}
};
