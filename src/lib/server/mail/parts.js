import { escapeHtml, MAIL_BRAND } from './layout.js';

const L = MAIL_BRAND.light;
const FONT = 'Helvetica Neue,Helvetica,Arial,sans-serif';

/**
 * @param {string} name
 */
export function mailGreeting(name) {
	return `<p class="mail-ink" style="margin:0 0 18px;font-family:${FONT};font-size:16px;line-height:1.55;color:${L.ink};">${escapeHtml(name)},</p>`;
}

/**
 * @param {string} text
 */
export function mailP(text) {
	return `<p class="mail-ink" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.55;color:${L.ink};">${escapeHtml(text)}</p>`;
}

/**
 * @param {string} html  Already-escaped / trusted markup only.
 */
export function mailHtml(html) {
	return `<p class="mail-ink" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.55;color:${L.ink};">${html}</p>`;
}

/**
 * @param {string} href
 * @param {string} label
 */
export function mailLink(href, label) {
	return `<a class="mail-ink" href="${escapeHtml(href)}" style="color:${L.ink};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/**
 * Accent CTA — square, lime, ink edge. Works light and dark.
 * @param {string} href
 * @param {string} label
 */
export function mailCta(href, label) {
	return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
  <tr>
    <td class="mail-cta" style="background-color:${L.accent};border:1px solid ${L.ink};border-radius:0;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 18px;font-family:${FONT};font-size:14px;font-weight:600;line-height:1;color:${L.onAccent};text-decoration:none;border-radius:0;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

/**
 * @param {string} label
 * @param {{ tight?: boolean }} [opts]
 */
export function mailEyebrow(label, opts = {}) {
	const margin = opts.tight ? '0 0 8px' : '22px 0 8px';
	return `<p class="mail-muted" style="margin:${margin};font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${L.muted};">${escapeHtml(label)}</p>`;
}

/**
 * @param {string} label
 */
export function mailChip(label) {
	return `<span class="mail-chip" style="display:inline-block;padding:3px 8px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.04em;background-color:${L.accent};color:${L.onAccent};">${escapeHtml(label)}</span>`;
}

/**
 * @param {string[]} items  Plain strings; escaped.
 */
export function mailBullets(items) {
	const rows = items
		.map(
			(item) =>
				`<tr>
      <td class="mail-ink" valign="top" style="width:16px;padding:0 0 8px;font-family:${FONT};font-size:16px;line-height:1.45;color:${L.ink};">·</td>
      <td class="mail-ink" style="padding:0 0 8px;font-family:${FONT};font-size:15px;line-height:1.45;color:${L.ink};">${escapeHtml(item)}</td>
    </tr>`
		)
		.join('');
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${rows}</table>`;
}

/**
 * Compact “next tiers” lines — muted, not a pricing grid.
 * @param {{ label: string, detail: string }[]} rows
 */
export function mailTierLines(rows) {
	const html = rows
		.map(
			(row) =>
				`<tr>
      <td class="mail-ink" style="padding:0 0 8px;font-family:${FONT};font-size:15px;line-height:1.45;color:${L.ink};width:72px;vertical-align:top;"><strong>${escapeHtml(row.label)}</strong></td>
      <td class="mail-muted" style="padding:0 0 8px;font-family:${FONT};font-size:15px;line-height:1.45;color:${L.muted};">${escapeHtml(row.detail)}</td>
    </tr>`
		)
		.join('');
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">${html}</table>`;
}

/**
 * Thin hairline between sections.
 */
export function mailRule() {
	return `<div class="mail-rule" style="border-top:1px solid ${L.rule};margin:22px 0;"></div>`;
}

/**
 * Soft bordered panel for “you’re on Free” blocks.
 * @param {string} innerHtml
 */
export function mailPanel(innerHtml) {
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mail-panel" style="margin:4px 0 16px;border:1px solid ${L.ink};">
  <tr>
    <td style="padding:14px 16px;">${innerHtml}</td>
  </tr>
</table>`;
}

export function mailSignoff() {
	return `<p class="mail-muted" style="margin:24px 0 0;font-family:${FONT};font-size:14px;line-height:1.45;color:${L.muted};">— SNDBNK</p>`;
}
