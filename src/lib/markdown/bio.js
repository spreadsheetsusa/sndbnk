import DOMPurify from 'isomorphic-dompurify';
import { micromark } from 'micromark';

/** Constructs we do not want in a short profile bio. */
const BIO_EXTENSION = {
	disable: {
		null: [
			'headingAtx',
			'headingSetext',
			'codeIndented',
			'codeFenced',
			'codeText',
			'htmlFlow',
			'htmlText',
			'definition',
			'thematicBreak'
		]
	}
};

const PURIFY_OPTIONS = {
	ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
	ALLOWED_ATTR: ['href', 'rel', 'target']
};

let hooksInstalled = false;

function ensurePurifyHooks() {
	if (hooksInstalled) return;
	hooksInstalled = true;
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.nodeName !== 'A') return;
		const href = node.getAttribute?.('href') ?? '';
		if (!/^https?:\/\//i.test(href)) {
			node.removeAttribute?.('href');
			return;
		}
		node.setAttribute?.('rel', 'noopener nofollow');
		node.setAttribute?.('target', '_blank');
	});
}

/**
 * Treat a single Enter as a hard break so bios keep line-break feel; blank lines stay paragraphs.
 * @param {string} source
 */
export function softBreaksToHard(source) {
	return source.replace(/([^\n])\n(?!\n)/g, '$1  \n');
}

/**
 * Render bio markdown to sanitized HTML (server-side).
 * @param {string | null | undefined} source
 * @returns {string}
 */
export function renderBioHtml(source) {
	const text = source?.trim();
	if (!text) return '';

	ensurePurifyHooks();
	const raw = micromark(softBreaksToHard(text), { extensions: [BIO_EXTENSION] });
	// Drop anchors that lost their href (e.g. javascript: URLs).
	return DOMPurify.sanitize(raw, PURIFY_OPTIONS).replace(/<a>(.*?)<\/a>/gi, '$1');
}

/**
 * Plain-text strip of bio markdown for SEO / JSON-LD.
 * @param {string | null | undefined} source
 * @returns {string}
 */
export function bioPlainText(source) {
	const text = source?.trim();
	if (!text) return '';

	return text
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/(\*\*|__)(.*?)\1/g, '$2')
		.replace(/(\*|_)(.*?)\1/g, '$2')
		.replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}
