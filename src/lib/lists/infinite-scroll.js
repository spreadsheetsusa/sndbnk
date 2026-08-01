/**
 * Fire `onVisible` when the element comes within `rootMargin` of the viewport,
 * and keep firing while it stays there and the callback reports progress.
 *
 * Used on zero-height sentinels at each end of a paged list, so the next page is
 * already in flight by the time the reader reaches the boundary. Pass a stable
 * callback: the attachment re-runs whenever the expression it is given changes,
 * and rebuilding the observer mid-scroll would drop the intersection.
 *
 * @param {() => Promise<boolean> | boolean} onVisible resolves to whether it did any work
 * @param {{ rootMargin?: string }} [options]
 * @returns {import('svelte/attachments').Attachment}
 */
export function whenVisible(onVisible, { rootMargin = '800px' } = {}) {
	return (node) => {
		let busy = false;
		const observer = new IntersectionObserver(
			async (entries) => {
				if (busy || !entries.some((entry) => entry.isIntersecting)) return;
				busy = true;

				try {
					// An observer only reports crossings. A page of short rows can leave
					// the sentinel still inside the margin, where it would never cross
					// again and paging would stall; re-observing asks the question again
					// against the new layout. Gating that on the callback having done
					// something is what stops it at the end of the list.
					if (await onVisible()) {
						observer.unobserve(node);
						observer.observe(node);
					}
				} finally {
					busy = false;
				}
			},
			{ rootMargin }
		);

		observer.observe(node);
		return () => observer.disconnect();
	};
}

/**
 * Report whether an element is within `rootMargin` of the viewport, both ways.
 *
 * Lets a long list mount expensive per-row machinery only for the rows in reach,
 * and tear it down again once they are well past.
 *
 * @param {(visible: boolean) => void} onChange
 * @param {{ rootMargin?: string }} [options]
 * @returns {import('svelte/attachments').Attachment}
 */
export function whileNearViewport(onChange, { rootMargin = '400px' } = {}) {
	return (node) => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) onChange(entry.isIntersecting);
			},
			{ rootMargin }
		);

		observer.observe(node);
		return () => observer.disconnect();
	};
}
