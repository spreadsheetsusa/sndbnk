/**
 * Development adapter: print the message instead of sending it.
 * @type {import('./types.js').MailAdapter}
 */
export const consoleAdapter = {
	id: 'console',

	async send(message) {
		const rule = '─'.repeat(72);
		const htmlNote = message.html ? `html: ${message.html.length} bytes` : 'html: (none)';
		console.log(
			[
				rule,
				`MAIL  to: ${message.to}`,
				`      from: ${message.from}`,
				`      subject: ${message.subject}`,
				`      ${htmlNote}`,
				rule,
				message.text.trim(),
				rule
			].join('\n')
		);

		return { ok: true };
	}
};
