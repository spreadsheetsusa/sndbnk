/**
 * Shared HTML chrome for every SNDBNK transactional email.
 * Table + inline styles for clients; `prefers-color-scheme` for dark mode.
 */

export const MAIL_BRAND = {
	light: {
		paper: '#f2f0e8',
		ink: '#11110f',
		muted: '#696861',
		accent: '#c8ff3d',
		onAccent: '#11110f',
		rule: 'rgba(17, 17, 15, 0.16)'
	},
	dark: {
		paper: '#141410',
		ink: '#f2f0e8',
		muted: '#a8a69c',
		accent: '#c8ff3d',
		onAccent: '#11110f',
		rule: 'rgba(242, 240, 232, 0.16)'
	}
};

export const MAIL_OPERATOR = 'The American Spreadsheet Co.';
export const MAIL_ADDRESS = '2894 Main St. Suite 0\nEast Troy, WI 53120';

/**
 * @param {unknown} value
 */
export function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/**
 * @param {{
 *   origin: string,
 *   preheader?: string,
 *   bodyHtml: string
 * }} input
 */
export function wrapMail({ origin, preheader = '', bodyHtml }) {
	const L = MAIL_BRAND.light;
	const D = MAIL_BRAND.dark;
	const base = origin.replace(/\/$/, '');
	const privacy = `${base}/privacy`;
	const terms = `${base}/terms`;
	const addressHtml = escapeHtml(MAIL_ADDRESS).replaceAll('\n', '<br />');
	const preheaderHtml = preheader
		? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
		: '';

	return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>SNDBNK</title>
<style>
  :root { color-scheme: light dark; }
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  img { border: 0; outline: none; text-decoration: none; }
  a { color: ${L.ink}; }
  .mail-bg { background-color: ${L.paper} !important; }
  .mail-card { background-color: ${L.paper} !important; }
  .mail-ink { color: ${L.ink} !important; }
  .mail-muted { color: ${L.muted} !important; }
  .mail-rule { border-color: ${L.rule} !important; }
  .mail-accent-bar { background-color: ${L.accent} !important; }
  .mail-cta { background-color: ${L.accent} !important; border-color: ${L.ink} !important; }
  .mail-cta a { color: ${L.onAccent} !important; }
  .mail-chip { background-color: ${L.accent} !important; color: ${L.onAccent} !important; }
  .mail-panel { border-color: ${L.ink} !important; background-color: ${L.paper} !important; }
  @media (prefers-color-scheme: dark) {
    a { color: ${D.ink} !important; }
    .mail-bg { background-color: ${D.paper} !important; }
    .mail-card { background-color: ${D.paper} !important; }
    .mail-ink { color: ${D.ink} !important; }
    .mail-muted { color: ${D.muted} !important; }
    .mail-rule { border-color: ${D.rule} !important; }
    .mail-accent-bar { background-color: ${D.accent} !important; }
    .mail-cta { background-color: ${D.accent} !important; border-color: ${D.ink} !important; }
    .mail-cta a { color: ${D.onAccent} !important; }
    .mail-chip { background-color: ${D.accent} !important; color: ${D.onAccent} !important; }
    .mail-panel { border-color: ${D.ink} !important; background-color: ${D.paper} !important; }
  }
</style>
<!--[if mso]>
<style type="text/css">
  body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
</style>
<![endif]-->
</head>
<body class="mail-bg" style="margin:0;padding:0;background-color:${L.paper};">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mail-bg" style="background-color:${L.paper};">
  <tr>
    <td align="center" style="padding:36px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mail-card" style="max-width:520px;background-color:${L.paper};">
        <tr>
          <td style="padding:0 0 22px;">
            <div class="mail-ink" style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.18em;color:${L.ink};">SNDBNK</div>
            <div class="mail-accent-bar" style="margin-top:10px;width:36px;height:3px;background-color:${L.accent};line-height:3px;font-size:0;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td class="mail-ink" style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${L.ink};">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding-top:36px;">
            <div class="mail-rule" style="border-top:1px solid ${L.rule};padding-top:18px;">
              <p class="mail-muted" style="margin:0 0 8px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${L.muted};">
                ${escapeHtml(MAIL_OPERATOR)}<br />
                ${addressHtml}
              </p>
              <p class="mail-muted" style="margin:0 0 8px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${L.muted};">
                <a href="${privacy}" class="mail-muted" style="color:${L.muted};text-decoration:underline;">Privacy</a>
                &nbsp;·&nbsp;
                <a href="${terms}" class="mail-muted" style="color:${L.muted};text-decoration:underline;">Terms</a>
              </p>
              <p class="mail-muted" style="margin:0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${L.muted};">
                You received this because you have a SNDBNK account.
              </p>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
