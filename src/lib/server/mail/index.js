import { MAIL_FROM, MAIL_TRANSPORT } from '$app/env/private';

import { consoleAdapter } from './console.js';
import { smtpAdapter } from './smtp.js';

/**
 * @returns {import('./types.js').MailAdapter}
 */
function getAdapter() {
	return MAIL_TRANSPORT === 'smtp' ? smtpAdapter : consoleAdapter;
}

/**
 * Fire-and-forget by design: a bounced receipt must never fail the request that
 * triggered it, so failures are logged and swallowed.
 * @param {{ to: string, subject: string, text: string, html?: string }} message
 */
export async function sendMail(message) {
	const adapter = getAdapter();
	const result = await adapter.send({ ...message, from: MAIL_FROM });

	if (!result.ok) {
		console.error(`[mail:${adapter.id}] ${message.subject} → ${message.to}: ${result.message}`);
	}

	return result;
}
