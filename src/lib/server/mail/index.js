import { MAIL_FROM, MAIL_TRANSPORT, ORIGIN } from '$app/env/private';

import { consoleAdapter } from './console.js';
import { smtpAdapter } from './smtp.js';

let warnedConsoleMail = false;

/**
 * @returns {import('./types.js').MailAdapter}
 */
function getAdapter() {
	warnIfConsoleInProd();
	return MAIL_TRANSPORT === 'smtp' ? smtpAdapter : consoleAdapter;
}

function warnIfConsoleInProd() {
	if (warnedConsoleMail || MAIL_TRANSPORT === 'smtp') return;
	let host = '';
	try {
		host = new URL(ORIGIN).hostname;
	} catch {
		return;
	}
	if (host === 'localhost' || host === '127.0.0.1') return;
	warnedConsoleMail = true;
	console.warn(
		'[mail] MAIL_TRANSPORT=console on a non-local ORIGIN; reset/verify links will print to stdout instead of sending.'
	);
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
