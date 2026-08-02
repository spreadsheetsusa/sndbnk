<script>
	/**
	 * Winamp-style overflow marquee. Scrolls only when the inner track is wider
	 * than the clip; falls back to ellipsis under prefers-reduced-motion.
	 *
	 * @type {{
	 *   resetKey?: string,
	 *   children: import('svelte').Snippet
	 * }}
	 */
	let { resetKey = '', children } = $props();

	let overflowing = $state(false);
	let reducedMotion = $state(false);
	let travel = $state(0);
	let durationSec = $state(8);

	/**
	 * @param {HTMLDivElement} node
	 */
	function marqueeClip(node) {
		const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = motionMq.matches;
		const onMotion = () => {
			reducedMotion = motionMq.matches;
		};
		motionMq.addEventListener('change', onMotion);

		const measure = () => {
			const track = /** @type {HTMLElement | null} */ (node.querySelector('.marquee-track'));
			if (!track) return;
			// Hidden (display:none) clips report 0 width — skip so we don't false-start.
			if (node.clientWidth === 0) {
				overflowing = false;
				travel = 0;
				return;
			}
			const next = Math.max(0, track.scrollWidth - node.clientWidth);
			travel = next;
			overflowing = next > 1;
			// ~28px/s with a floor so short overflows still feel leisurely.
			durationSec = Math.max(6, Math.min(28, next / 28 + 3));
		};

		const ro = new ResizeObserver(measure);
		ro.observe(node);

		/** @type {Element | null} */
		let observedTrack = null;
		const syncTrackObserver = () => {
			const track = node.querySelector('.marquee-track');
			if (track === observedTrack) {
				measure();
				return;
			}
			if (observedTrack) ro.unobserve(observedTrack);
			observedTrack = track;
			if (observedTrack) ro.observe(observedTrack);
			measure();
		};

		const mo = new MutationObserver(syncTrackObserver);
		mo.observe(node, { childList: true, subtree: true, characterData: true });
		syncTrackObserver();

		return () => {
			motionMq.removeEventListener('change', onMotion);
			ro.disconnect();
			mo.disconnect();
		};
	}
</script>

<div
	class="marquee"
	class:scrolling={overflowing && !reducedMotion}
	style:--travel="{travel}px"
	style:--marquee-duration="{durationSec}s"
	{@attach marqueeClip}
>
	{#key resetKey}
		<div class="marquee-track">
			{@render children()}
		</div>
	{/key}
</div>

<style>
	.marquee {
		min-width: 0;
		overflow: hidden;
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 0.4rem,
			#000 calc(100% - 0.4rem),
			transparent
		);
	}

	.marquee:not(.scrolling) {
		mask-image: none;
	}

	.marquee-track {
		display: inline-flex;
		align-items: baseline;
		gap: 0;
		width: max-content;
		max-width: none;
		white-space: nowrap;
	}

	.marquee:not(.scrolling) .marquee-track {
		display: block;
		width: 100%;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.marquee:not(.scrolling) .marquee-track :global(a),
	.marquee:not(.scrolling) .marquee-track :global(span) {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.marquee.scrolling .marquee-track {
		animation: marquee-scroll var(--marquee-duration) linear infinite;
	}

	.marquee.scrolling:hover .marquee-track,
	.marquee.scrolling:focus-within .marquee-track {
		animation-play-state: paused;
	}

	@keyframes marquee-scroll {
		0%,
		12% {
			transform: translateX(0);
		}
		88%,
		100% {
			transform: translateX(calc(-1 * var(--travel, 0px)));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.marquee.scrolling .marquee-track {
			animation: none;
		}
	}
</style>
