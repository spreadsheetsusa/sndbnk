<script>
	import { onMount } from 'svelte';
	import IconArrowsMinimize from '@tabler/icons-svelte-runes/icons/arrows-minimize';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import IconPlayerTrackNext from '@tabler/icons-svelte-runes/icons/player-track-next';
	import { floatStack } from '#lib/player/float-stack.svelte.js';
	import { rectOf, snapPositionToEdges } from '#lib/player/window-snap.js';
	import { visualizer } from '#lib/player/visualizer.svelte.js';

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
		floatStack.raise('milkdrop');
		// First paint stacks under the player / EQ even if stored bounds are stale.
		visualizer.spawnDocked();
		const el = canvas;
		if (!el) return;
		void visualizer.attach(el);
		return () => {
			visualizer.setWindowDragging(false);
			visualizer.detach(el);
		};
	});

	/** Snap targets: player strip + open EQ panel. */
	function snapTargets() {
		return [rectOf('.header-player .strip'), rectOf('#header-eq-panel')];
	}

	/**
	 * Full-window drag surface (under chrome / resize handle).
	 *
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
		visualizer.beginWindowDrag(event.clientX, event.clientY);
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
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
			visualizer.updateWindowDrag(event.clientX, event.clientY);
			if (visualizer.dockHover) return;
			const raw = { x: startX + dx, y: startY + dy };
			const snapped = snapPositionToEdges(raw, { w: visualizer.w, h: visualizer.h }, snapTargets());
			visualizer.setBounds({ x: snapped.x, y: snapped.y });
			return;
		}
		visualizer.setBounds({ w: startW + dx, h: startH + dy });
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
		const wasDrag = dragMode === 'drag';
		dragMode = null;
		pointerId = null;
		if (wasDrag) {
			visualizer.endWindowDrag(event.clientX, event.clientY);
			return;
		}
		visualizer.setWindowDragging(false);
	}
</script>

<section
	class="milkdrop-window"
	class:dragging={dragMode === 'drag'}
	class:resizing={dragMode === 'resize'}
	class:dock-preview={visualizer.dockHover}
	style:left="{visualizer.x}px"
	style:top="{visualizer.y}px"
	style:width="{visualizer.w}px"
	style:height="{visualizer.h}px"
	style:z-index={floatStack.milkdrop}
	onpointerdowncapture={() => floatStack.raise('milkdrop')}
	aria-label="Milkdrop visualizer"
>
	<div class="chrome" role="toolbar" aria-label="Visualizer controls">
		<button
			type="button"
			class="chrome-btn"
			aria-label="Dock visualizer"
			onclick={() => visualizer.dock()}
			onpointerdown={(e) => e.stopPropagation()}
		>
			<IconArrowsMinimize size={13} stroke={1.75} aria-hidden="true" />
		</button>
		<button
			type="button"
			class="chrome-btn"
			aria-label="Next preset"
			onclick={() => visualizer.nextPreset()}
			onpointerdown={(e) => e.stopPropagation()}
		>
			<IconPlayerTrackNext size={13} stroke={1.75} aria-hidden="true" />
		</button>
		<button
			type="button"
			class="chrome-btn"
			aria-label="Close visualizer"
			onclick={() => void visualizer.setEnabled(false)}
			onpointerdown={(e) => e.stopPropagation()}
		>
			<IconX size={13} stroke={1.75} aria-hidden="true" />
		</button>
	</div>

	<div class="stage">
		<canvas bind:this={canvas} class="viz-canvas" aria-hidden="true"></canvas>
		{#if visualizer.error}
			<p class="loading error" role="alert">{visualizer.error}</p>
		{:else if !visualizer.ready}
			<p class="loading" role="status">Loading visualizer…</p>
		{/if}
	</div>

	<!-- Captures pointer over the whole stage so WebGL canvas can't eat the drag. -->
	<div
		class="drag-surface"
		aria-hidden="true"
		onpointerdown={startDrag}
		onpointermove={onPointerMove}
		onpointerup={endPointer}
		onpointercancel={endPointer}
	></div>

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
		display: flex;
		flex-direction: column;
		min-width: 280px;
		min-height: 200px;
		overflow: hidden;
		border: 1px solid var(--hard-border);
		border-radius: 0.125rem;
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		user-select: none;
		touch-action: none;
		cursor: grab;
	}

	.milkdrop-window.dock-preview {
		min-width: 0;
		min-height: 0;
		transition:
			left 180ms ease,
			top 180ms ease,
			width 180ms ease,
			height 180ms ease;
	}

	.milkdrop-window.dragging,
	.milkdrop-window.resizing {
		cursor: grabbing;
	}

	.chrome {
		position: absolute;
		top: 0.2rem;
		right: 0.2rem;
		z-index: 50;
		display: flex;
		gap: 0.2rem;
		align-items: center;
		pointer-events: none;
	}

	.chrome-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		border-radius: 0;
		color: var(--muted);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		cursor: pointer;
		pointer-events: auto;
	}

	.chrome-btn :global(svg) {
		display: block;
	}

	.chrome-btn:hover {
		border-color: var(--ink);
		color: var(--ink);
		background: var(--paper);
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
		pointer-events: none;
	}

	.drag-surface {
		position: absolute;
		inset: 0;
		z-index: 1;
		cursor: grab;
		touch-action: none;
	}

	.milkdrop-window.dragging .drag-surface {
		cursor: grabbing;
	}

	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		padding: 0.75rem;
		color: color-mix(in srgb, #fff 70%, transparent);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-align: center;
		text-transform: uppercase;
		pointer-events: none;
	}

	.loading.error {
		color: color-mix(in srgb, #fff 88%, transparent);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: none;
		line-height: 1.35;
	}

	.resize-handle {
		--eq-grip: color-mix(in srgb, var(--ink) 28%, transparent);
		position: absolute;
		right: 0;
		bottom: 0;
		z-index: 40;
		width: 0.65rem;
		height: 0.65rem;
		cursor: nwse-resize;
		background: linear-gradient(
			135deg,
			transparent 0 45%,
			var(--eq-grip) 45% 52%,
			transparent 52% 68%,
			var(--eq-grip) 68% 75%,
			transparent 75%
		);
	}

	:global(html.dark) .resize-handle {
		--eq-grip: color-mix(in srgb, var(--accent) 22%, black);
	}

	@media (prefers-reduced-motion: reduce) {
		.milkdrop-window.dock-preview {
			transition: none;
		}
	}
</style>
