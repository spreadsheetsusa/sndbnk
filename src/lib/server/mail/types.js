/**
 * @typedef {{
 *   to: string,
 *   from: string,
 *   subject: string,
 *   text: string,
 *   html?: string
 * }} MailMessage
 */

/**
 * Same shape as the storage adapters: one method, and a result object rather than
 * an exception, because a failed send must never take a request down.
 *
 * @typedef {{
 *   id: 'console' | 'smtp',
 *   send: (message: MailMessage) => Promise<{ ok: true } | { ok: false, message: string }>
 * }} MailAdapter
 */

export {};
