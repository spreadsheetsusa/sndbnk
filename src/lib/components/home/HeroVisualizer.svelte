<script>
	import { onMount } from 'svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { HERO_VIZ_OPACITY, HERO_VIZ_VEIL, visualizer } from '#lib/player/visualizer.svelte.js';

	/** @type {HTMLElement | null} */
	let root = $state(null);
	/** @type {HTMLCanvasElement | null} */
	let canvas = $state(null);
	let reducedMotion = $state(false);

	const wantsBackdrop = $derived(player.playing && visualizer.supported && !reducedMotion);
	const visible = $derived(wantsBackdrop && visualizer.backdropReady);

	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotion = () => {
			reducedMotion = mq.matches;
		};
		syncMotion();
		mq.addEventListener('change', syncMotion);

		const ro = new ResizeObserver(() => visualizer.resizeBackdrop());
		if (root) ro.observe(root);

		return () => {
			mq.removeEventListener('change', syncMotion);
			ro.disconnect();
			visualizer.detachBackdrop();
		};
	});

	$effect(() => {
		const should = wantsBackdrop;
		const el = canvas;
		if (!should || !el) {
			visualizer.detachBackdrop();
			return;
		}
		void visualizer.attachBackdrop(el);
		return () => visualizer.detachBackdrop();
	});
</script>

<div
	class="hero-viz"
	class:on={visible}
	bind:this={root}
	style:--hero-viz-opacity={HERO_VIZ_OPACITY}
	style:--hero-viz-veil={HERO_VIZ_VEIL}
	aria-hidden="true"
>
	<canvas bind:this={canvas} class="viz-canvas"></canvas>
	<div class="veil"></div>
</div>

<style>
	.hero-viz {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.65s ease;
	}

	.hero-viz.on {
		opacity: 1;
	}

	.viz-canvas {
		display: block;
		width: 100%;
		height: 100%;
		opacity: var(--hero-viz-opacity, 0.35);
	}

	.veil {
		position: absolute;
		inset: 0;
		background: color-mix(
			in srgb,
			var(--paper) calc(var(--hero-viz-veil, 0.55) * 100%),
			transparent
		);
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-viz {
			display: none;
		}
	}
</style>
