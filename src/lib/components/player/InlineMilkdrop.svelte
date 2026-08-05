<script>
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import IconArrowsMaximize from '@tabler/icons-svelte-runes/icons/arrows-maximize';
	import IconPlayerTrackNext from '@tabler/icons-svelte-runes/icons/player-track-next';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import { visualizer } from '#lib/player/visualizer.svelte.js';

	/** @type {{ variant?: 'deck' | 'panel' | 'backdrop' }} */
	let { variant = 'deck' } = $props();

	/** @type {HTMLCanvasElement | null} */
	let canvas = $state(null);
	/** @type {HTMLElement | null} */
	let root = $state(null);

	const isPanel = $derived(variant === 'panel');
	const isBackdrop = $derived(variant === 'backdrop');

	/**
	 * Deck: slide + fade from above. Panel: height collapse + fade.
	 * Backdrop: host owns height motion — no local enter/exit.
	 * @param {HTMLElement} node
	 */
	function vizMotion(node) {
		const duration = prefersReducedMotion.current || isBackdrop ? 0 : 320;

		if (isPanel) {
			const style = getComputedStyle(node);
			const opacity = +style.opacity;
			const height = parseFloat(style.height);
			const paddingTop = parseFloat(style.paddingTop);
			const paddingBottom = parseFloat(style.paddingBottom);
			const marginTop = parseFloat(style.marginTop);
			const marginBottom = parseFloat(style.marginBottom);
			const borderTopWidth = parseFloat(style.borderTopWidth);
			const borderBottomWidth = parseFloat(style.borderBottomWidth);

			return {
				duration,
				easing: cubicOut,
				css: (t) =>
					`overflow: hidden; opacity: ${t * opacity}; height: ${t * height}px;` +
					`padding-top: ${t * paddingTop}px; padding-bottom: ${t * paddingBottom}px;` +
					`margin-top: ${t * marginTop}px; margin-bottom: ${t * marginBottom}px;` +
					`border-top-width: ${t * borderTopWidth}px; border-bottom-width: ${t * borderBottomWidth}px;`
			};
		}

		if (isBackdrop) {
			return { duration: 0, css: () => '' };
		}

		const y = -10;
		return {
			duration,
			easing: cubicOut,
			css: (t) => {
				const ty = (1 - t) * y;
				return `transform: translateY(${ty}px); opacity: ${t}`;
			}
		};
	}

	onMount(() => {
		const el = canvas;
		if (!el) return;
		void visualizer.attach(el);

		const ro = new ResizeObserver(() => visualizer.resize());
		if (root) ro.observe(root);

		return () => {
			ro.disconnect();
			visualizer.detach(el);
		};
	});
</script>

<section
	bind:this={root}
	class="inline-milkdrop"
	class:deck={variant === 'deck'}
	class:panel={isPanel}
	class:backdrop={isBackdrop}
	data-panel={isPanel ? 'viz' : undefined}
	aria-label="Milkdrop visualizer"
	transition:vizMotion
>
	<div class="stage">
		<canvas bind:this={canvas} class="viz-canvas" aria-hidden="true"></canvas>
		{#if !visualizer.ready}
			<p class="loading" role="status">Loading visualizer…</p>
		{/if}

		<div class="chrome" role="toolbar" aria-label="Visualizer controls">
			<button
				type="button"
				class="chrome-btn"
				aria-label="Next preset"
				onclick={() => visualizer.nextPreset()}
			>
				<IconPlayerTrackNext size={14} stroke={1.75} aria-hidden="true" />
			</button>
			<button
				type="button"
				class="chrome-btn"
				aria-label="Pop out visualizer"
				onclick={() => visualizer.popOut()}
			>
				<IconArrowsMaximize size={14} stroke={1.75} aria-hidden="true" />
			</button>
			<button
				type="button"
				class="chrome-btn"
				aria-label="Close visualizer"
				onclick={() => void visualizer.setEnabled(false)}
			>
				<IconX size={14} stroke={1.75} aria-hidden="true" />
			</button>
		</div>
	</div>

	<p class="collapsed-label" aria-hidden="true">Milkdrop</p>
</section>

<style>
	.inline-milkdrop {
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.inline-milkdrop.panel {
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.inline-milkdrop.deck,
	.inline-milkdrop.backdrop {
		border: 0;
		background: transparent;
		box-shadow: none;
	}

	.inline-milkdrop.backdrop {
		height: 100%;
	}

	.stage {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		/* Canvas stage: always black behind WebGL, independent of theme. */
		background: #000;
	}

	.inline-milkdrop.deck .stage {
		height: 11.5rem;
	}

	.inline-milkdrop.panel .stage {
		height: 11rem;
	}

	.inline-milkdrop.backdrop .stage {
		height: 100%;
	}

	.viz-canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.chrome {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		z-index: 2;
		display: flex;
		gap: 0.2rem;
		align-items: center;
		opacity: 0;
		transition: opacity 180ms ease;
		pointer-events: none;
	}

	.inline-milkdrop:hover .chrome,
	.inline-milkdrop:focus-within .chrome {
		opacity: 1;
		pointer-events: auto;
	}

	.chrome-btn {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, #fff 28%, transparent);
		border-radius: 0.125rem;
		background: color-mix(in srgb, #000 55%, transparent);
		color: #fff;
		cursor: pointer;
		pointer-events: auto;
		backdrop-filter: blur(4px);
	}

	.chrome-btn:hover {
		border-color: color-mix(in srgb, #fff 55%, transparent);
		background: color-mix(in srgb, #000 72%, transparent);
	}

	.chrome-btn:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}

	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		color: color-mix(in srgb, #fff 70%, transparent);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		pointer-events: none;
	}

	.collapsed-label {
		display: none;
		margin: 0;
		padding: 0.15rem 0.25rem;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	/* Touch / coarse pointers: keep controls faintly visible. */
	@media (hover: none), (pointer: coarse) {
		.chrome {
			opacity: 0.45;
			pointer-events: auto;
		}

		.inline-milkdrop:hover .chrome,
		.inline-milkdrop:focus-within .chrome {
			opacity: 0.85;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chrome {
			transition: none;
		}
	}
</style>
