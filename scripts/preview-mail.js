/**
 * Render branded mail HTML for visual review.
 * Usage: bun ./scripts/preview-mail.js
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	buildPaymentFailedMail,
	buildPlanChangedMail,
	buildResetPasswordMail,
	buildSubscriptionCanceledMail,
	buildVerifyEmailChangeMail,
	buildWelcomeMail
} from '../src/lib/server/mail/compose.js';
import { wrapMail } from '../src/lib/server/mail/layout.js';

const origin = (process.env.ORIGIN || 'http://localhost:5174').replace(/\/$/, '');
const outDir = process.env.MAIL_PREVIEW_DIR || '/opt/cursor/artifacts/mail-previews';
mkdirSync(outDir, { recursive: true });

/**
 * @param {string} slug
 * @param {{ preheader: string, bodyHtml: string }} content
 */
function write(slug, content) {
	const html = wrapMail({
		origin,
		preheader: content.preheader,
		bodyHtml: content.bodyHtml
	});
	const path = join(outDir, `${slug}.html`);
	writeFileSync(path, html);
	console.log(`wrote ${path} (${html.length} bytes)`);
}

write('welcome', buildWelcomeMail({ name: 'Ben', username: 'ben', planId: 'free', origin }));
write(
	'plan-changed',
	buildPlanChangedMail({
		name: 'Ben',
		planLabel: 'Vault',
		interval: 'month',
		planId: 'vault',
		origin
	})
);
write('payment-failed', buildPaymentFailedMail({ name: 'Ben', planLabel: 'Vault', origin }));
write('subscription-canceled', buildSubscriptionCanceledMail({ name: 'Ben', origin }));
write(
	'verify-email',
	buildVerifyEmailChangeMail({
		name: 'Ben',
		url: `${origin}/api/auth/verify-email?token=preview`
	})
);
write(
	'reset-password',
	buildResetPasswordMail({
		name: 'Ben',
		url: `${origin}/reset-password?token=preview`
	})
);

console.log(`\nPreviews in ${outDir}`);
