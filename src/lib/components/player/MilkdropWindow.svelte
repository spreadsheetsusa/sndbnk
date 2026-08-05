<script>
	import { onMount } from 'svelte';
	import IconArrowsMinimize from '@tabler/icons-svelte-runes/icons/arrows-minimize';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import IconPlayerTrackNext from '@tabler/icons-svelte-runes/icons/player-track-next';
	import { MILKDROP_TITLE_H, visualizer } from '#lib/player/visualizer.svelte.js';

	/** @type {HTMLCanvasElement | null} */
	let canvas = $state(null);

	/** @type {'drag' | 'resize' | null} */
	let dragMode = $state(null);
	let pointerId = $state(/** @type {number | null} */ (null));
	let originX = 0;
	let originY = 0;
	let startX = 0;
	let startY = 0;
	let startW = 0;
	let startH = 0;

	onMount(() => {
		const el = canvas;
		if (!el) return;
		void visualizer.attach(el);
		return () => visualizer.detach(el);
	});

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function startDrag(event) {
		if (event.button !== 0) return;
		dragMode = 'drag';
		pointerId = event.pointerId;
		originX = event.clientX;
		originY = event.clientY;
		startX = visualizer.x;
		startY = visualizer.y;
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function startResize(event) {
		if (event.button !== 0) return;
		dragMode = 'resize';
		pointerId = event.pointerId;
		originX = event.clientX;
		originY = event.clientY;
		startW = visualizer.w;
		startH = visualizer.h;
		event.currentTarget.setPointerCapture(event.pointerId);
		event.stopPropagation();
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onPointerMove(event) {
		if (pointerId == null || event.pointerId !== pointerId || !dragMode) return;
		const dx = event.clientX - originX;
		const dy = event.clientY - originY;
		if (dragMode === 'drag') {
			visualizer.setBounds({ x: startX + dx, y: startY + dy });
		} else {
			visualizer.setBounds({ w: startW + dx, h: startH + dy });
		}
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function endPointer(event) {
		if (pointerId == null || event.pointerId !== pointerId) return;
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// Already released.
		}
		dragMode = null;
		pointerId = null;
	}
</script>

<section
	class="milkdrop-window"
	class:dragging={dragMode === 'drag'}
	class:resizing={dragMode === 'resize'}
	style:left="{visualizer.x}px"
	style:top="{visualizer.y}px"
	style:width="{visualizer.w}px"
	style:height="{visualizer.h}px"
	style:--title-h="{MILKDROP_TITLE_H}px"
	aria-label="Milkdrop visualizer"
>
	<div
		class="titlebar"
		role="toolbar"
		tabindex="-1"
		aria-label="Visualizer window"
		onpointerdown={startDrag}
		onpointermove={onPointerMove}
		onpointerup={endPointer}
		onpointercancel={endPointer}
	>
		<span class="title">Milkdrop</span>
		<div class="title-actions">
			<button
				type="button"
				class="chrome-btn"
				aria-label="Dock visualizer"
				onclick={(e) => {
					e.stopPropagation();
					visualizer.dock();
				}}
				onpointerdown={(e) => e.stopPropagation()}
			>
				<IconArrowsMinimize size={14} stroke={1.75} aria-hidden="true" />
			</button>
			<button
				type="button"
				class="chrome-btn"
				aria-label="Next preset"
				onclick={(e) => {
					e.stopPropagation();
					visualizer.nextPreset();
				}}
				onpointerdown={(e) => e.stopPropagation()}
			>
				<IconPlayerTrackNext size={14} stroke={1.75} aria-hidden="true" />
			</button>
			<button
				type="button"
				class="chrome-btn"
				aria-label="Close visualizer"
				onclick={(e) => {
					e.stopPropagation();
					void visualizer.setEnabled(false);
				}}
				onpointerdown={(e) => e.stopPropagation()}
			>
				<IconX size={14} stroke={1.75} aria-hidden="true" />
			</button>
		</div>
	</div>

	<div class="stage">
		<canvas bind:this={canvas} class="viz-canvas" aria-hidden="true"></canvas>
		{#if !visualizer.ready}
			<p class="loading" role="status">Loading visualizer…</p>
		{/if}
	</div>

	<div
		class="resize-handle"
		aria-hidden="true"
		onpointerdown={startResize}
		onpointermove={onPointerMove}
		onpointerup={endPointer}
		onpointercancel={endPointer}
	></div>
</section>

<style>
	.milkdrop-window {
		position: fixed;
		z-index: 100;
		display: flex;
		flex-direction: column;
		min-width: 280px;
		min-height: 200px;
		overflow: hidden;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		user-select: none;
		touch-action: none;
	}

	.milkdrop-window.dragging,
	.milkdrop-window.resizing {
		cursor: grabbing;
	}

	.titlebar {
		display: flex;
		flex: 0 0 var(--title-h);
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		height: var(--title-h);
		padding: 0 0.35rem 0 0.65rem;
		border-bottom: 1px solid var(--hard-border);
		background: color-mix(in srgb, var(--ink) 6%, var(--paper));
		cursor: grab;
	}

	.milkdrop-window.dragging .titlebar {
		cursor: grabbing;
	}

	.title {
		overflow: hidden;
		color: var(--ink);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.title-actions {
		display: flex;
		flex: 0 0 auto;
		gap: 0.15rem;
		align-items: center;
	}

	.chrome-btn {
		display: grid;
		place-items: center;
		width: 1.65rem;
		height: 1.65rem;
		padding: 0;
		border: 1px solid transparent;
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}

	.chrome-btn:hover {
		border-color: var(--ink);
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}

	.chrome-btn:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.stage {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		/* Canvas stage: always black behind WebGL, independent of theme. */
		background: #000;
	}

	.viz-canvas {
		display: block;
		width: 100%;
		height: 100%;
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

	.resize-handle {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 1.1rem;
		height: 1.1rem;
		cursor: nwse-resize;
		background: linear-gradient(
			135deg,
			transparent 0 45%,
			var(--ink) 45% 52%,
			transparent 52% 68%,
			var(--ink) 68% 75%,
			transparent 75%
		);
	}
</style>
