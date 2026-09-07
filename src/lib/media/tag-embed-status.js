/**
 * @typedef {'queued' | 'writing' | 'done' | 'failed'} TagEmbedStatus
 */

/**
 * @param {unknown} value
 * @returns {TagEmbedStatus | null}
 */
export function parseTagEmbedStatus(value) {
	if (value === 'queued' || value === 'writing' || value === 'done' || value === 'failed') {
		return value;
	}
	return null;
}

/**
 * @param {unknown} value
 * @returns {value is 'queued' | 'writing'}
 */
export function isTagEmbedPending(value) {
	return value === 'queued' || value === 'writing';
}

/**
 * @param {unknown} status
 * @param {string | null | undefined} message
 * @returns {string | null}
 */
export function tagEmbedNotice(status, message) {
	if (typeof message === 'string' && message.trim() !== '') return message;
	if (status === 'queued' || status === 'writing') return 'Writing tags to the file…';
	return null;
}
