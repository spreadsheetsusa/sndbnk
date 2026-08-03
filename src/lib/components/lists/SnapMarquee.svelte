<script>
	/**
	 * Winamp-style horizontal marquee for collapsed sidebar item tracks.
	 * When `enabled` and the track overflows, scrolls end-to-end then restarts.
	 *
	 * @type {{
	 *   enabled?: boolean,
	 *   resetKey?: string,
	 *   children: import('svelte').Snippet
	 * }}
	 */
	let { enabled = false, resetKey = '', children } = $props();

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
			const track = /** @type {HTMLElement | null} */ (node.querySelector('.snap-marquee-track'));
			if (!track) return;
			const isEnabled = node.dataset.enabled === 'true';
			if (!isEnabled || node.clientWidth === 0) {
				overflowing = false;
				travel = 0;
				return;
			}
			const next = Math.max(0, track.scrollWidth - node.clientWidth);
			travel = next;
			overflowing = next > 1;
			durationSec = Math.max(6, Math.min(28, next / 28 + 3));
		};

		const ro = new ResizeObserver(measure);
		ro.observe(node);

		/** @type {Element | null} */
		let observedTrack = null;
		const syncTrackObserver = () => {
			const track = node.querySelector('.snap-marquee-track');
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
		mo.observe(node, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ['data-enabled']
		});
		syncTrackObserver();

		return () => {
			motionMq.removeEventListener('change', onMotion);
			ro.disconnect();
			mo.disconnect();
		};
	}

	const scrolling = $derived(enabled && overflowing && !reducedMotion);
</script>

<div
	class="snap-marquee"
	class:enabled
	class:scrolling
	data-enabled={enabled ? 'true' : 'false'}
	style:--travel="{travel}px"
	style:--marquee-duration="{durationSec}s"
	{@attach marqueeClip}
>
	{#key resetKey}
		<div class="snap-marquee-track">
			{@render children()}
		</div>
	{/key}
</div>

<style>
	.snap-marquee {
		min-width: 0;
		width: 100%;
	}

	.snap-marquee.enabled {
		overflow: hidden;
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 0.35rem,
			#000 calc(100% - 0.35rem),
			transparent
		);
	}

	.snap-marquee.enabled:not(.scrolling) {
		mask-image: none;
	}

	.snap-marquee-track {
		min-width: 0;
		width: 100%;
	}

	.snap-marquee.enabled .snap-marquee-track {
		display: block;
		width: max-content;
		max-width: none;
	}

	.snap-marquee.scrolling .snap-marquee-track {
		animation: snap-marquee-scroll var(--marquee-duration) linear infinite;
	}

	.snap-marquee.scrolling:hover .snap-marquee-track,
	.snap-marquee.scrolling:focus-within .snap-marquee-track {
		animation-play-state: paused;
	}

	@keyframes snap-marquee-scroll {
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
		.snap-marquee.scrolling .snap-marquee-track {
			animation: none;
		}
	}
</style>
