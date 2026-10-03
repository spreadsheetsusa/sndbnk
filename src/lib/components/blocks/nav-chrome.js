/**
 * Header button shows when the toggle is on and the label is not empty.
 * A missing toggle stays on so existing navbars keep their button.
 * @param {unknown} enabled
 * @param {unknown} label
 */
export function showNavCta(enabled, label) {
	return enabled !== false && String(label ?? '').trim().length > 0;
}

/**
 * Drop scroll-behavior keys before spreading props onto a header block.
 * NavScroll owns that behavior.
 * @param {Record<string, unknown>} props
 * @returns {Record<string, unknown>}
 */
export function headerBlockProps(props) {
	const next = { ...props };
	delete next.hideOnScroll;
	return next;
}
