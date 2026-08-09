<script module>
	/** Session-persisted bounds across open/close. */
	/** @type {{ x: number, y: number, w: number, h: number } | null} */
	let savedBounds = null;
</script>

<script>
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import { EQ_Q_DEFAULT, EQ_Q_MAX, EQ_Q_MIN } from '#lib/player/eq-bands.js';
	import { audioGraph } from '#lib/player/audio-graph.svelte.js';
	import { eq } from '#lib/player/eq.svelte.js';
	import { floatStack } from '#lib/player/float-stack.svelte.js';
	import { SNAP_PX, snapEqToStripDock, stackDock, stripDock } from '#lib/player/window-snap.js';
	import EqSpectrum from '#lib/components/player/EqSpectrum.svelte';

	/**
	 * @type {{ active?: boolean }}
	 */
	let { active = true } = $props();

	const MIN_W = 320;
	const MIN_H = 140;
	/** Fallback when the header strip isn't in the DOM yet. */
	const DEFAULT_W = 612;
	/** Shorter than the old 280px spawn — still resizable. */
	const DEFAULT_H = 205;
	const VIEW_PAD = 8;

	let x = $state(VIEW_PAD);
	let y = $state(72);
	let w = $state(DEFAULT_W);
	let h = $state(DEFAULT_H);

	/** @type {'drag' | 'resize-se' | 'resize-sw' | null} */
	let winMode = $state(null);
	let pointerId = $state(/** @type {number | null} */ (null));
	let originX = 0;
	let originY = 0;
	let startX = 0;
	let startY = 0;
	let startW = 0;
	let startH = 0;

	/** @type {SVGSVGElement | null} */
	let sparkEl = $state.raw(null);
	/** @type {import('svelte/attachments').Attachment} */
	function sparkAttach(node) {
		sparkEl = /** @type {SVGSVGElement} */ (node);
		return () => {
			sparkEl = null;
		};
	}
	let sparkDragging = $state(false);
	/** @type {number} */
	let dragStartY = 0;
	/** @type {number} */
	let dragStartQ = EQ_Q_DEFAULT;

	/** Pixels of vertical drag spanning the full Q range. */
	const DRAG_SPAN_PX = 72;

	const selected = $derived(eq.selectedIndex != null ? (eq.nodes[eq.selectedIndex] ?? null) : null);
	const curveQ = $derived(selected?.q ?? EQ_Q_DEFAULT);
	const themeLabel = $derived(eq.theme === 'winamp' ? 'WA' : eq.theme === 'lcd' ? 'LCD' : 'DEF');
	const volumePct = $derived(Math.round(audioGraph.volume * 100));

	/** @type {HTMLDivElement | null} */
	let volWell = $state.raw(null);
	let volDragging = $state(false);
	/** Cached well geometry for the active drag (avoids layout reads every move). */
	let volDragTop = 0;
	let volDragHeight = 1;

	// Keep grabber CSS in sync when volume is committed (not during live drag).
	$effect(() => {
		const well = volWell;
		const v = audioGraph.volume;
		if (!well || volDragging) return;
		well.style.setProperty('--vol', String(v));
	});

	$effect(() => {
		const running = active && browser;
		const well = volWell;
		void audioGraph.ready;
		if (!running || !well) {
			well?.style.setProperty('--meter', '0');
			return;
		}

		const bins = new Uint8Array(2048);
		/** @type {number} */
		let raf = 0;
		let smooth = 0;

		const tick = () => {
			const analyser = audioGraph.analyser;
			let level = 0;
			if (analyser) {
				const data = bins.length === analyser.fftSize ? bins : new Uint8Array(analyser.fftSize);
				analyser.getByteTimeDomainData(data);
				let sum = 0;
				for (let i = 0; i < data.length; i++) {
					const v = (data[i] - 128) / 128;
					sum += v * v;
				}
				// Pre-fader RMS → post-fader feel via non-reactive getVolume().
				level = Math.min(1, Math.sqrt(sum / data.length) * 2.4 * audioGraph.getVolume());
			}
			smooth = smooth * 0.72 + level * 0.28;
			well.style.setProperty('--meter', String(smooth));
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
		};
	});

	/**
	 * Live drag path: GainNode + grabber CSS only — no $state / localStorage.
	 * @param {number} next
	 */
	function applyVolumeLive(next) {
		audioGraph.setVolumeLive(next);
		const well = volWell;
		if (!well) return;
		const v = audioGraph.getVolume();
		well.style.setProperty('--vol', String(v));
		well.setAttribute('aria-valuenow', String(Math.round(v * 100)));
		well.setAttribute('aria-valuetext', `${Math.round(v * 100)}%`);
	}

	/**
	 * @param {number} clientY
	 */
	function volumeFromClientY(clientY) {
		return Math.min(1, Math.max(0, 1 - (clientY - volDragTop) / volDragHeight));
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function onVolPointerDown(event) {
		if (event.button !== 0) return;
		const rect = event.currentTarget.getBoundingClientRect();
		volDragTop = rect.top;
		volDragHeight = Math.max(1, rect.height);
		volDragging = true;
		applyVolumeLive(volumeFromClientY(event.clientY));
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
		event.stopPropagation();
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onVolPointerMove(event) {
		if (!volDragging) return;
		applyVolumeLive(volumeFromClientY(event.clientY));
		event.preventDefault();
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function onVolPointerUp(event) {
		if (!volDragging) return;
		volDragging = false;
		audioGraph.commitVolume();
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// Already released.
		}
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	function onVolKeydown(event) {
		const step = event.shiftKey ? 0.1 : 0.02;
		const cur = audioGraph.getVolume();
		if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
			audioGraph.setVolume(cur + step);
			event.preventDefault();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
			audioGraph.setVolume(cur - step);
			event.preventDefault();
		} else if (event.key === 'Home') {
			audioGraph.setVolume(1);
			event.preventDefault();
		} else if (event.key === 'End') {
			audioGraph.setVolume(0);
			event.preventDefault();
		}
	}

	/** Accent sparkline of the peaking bell implied by current Q. */
	const sparkPath = $derived.by(() => {
		const q = curveQ;
		const sw = 36;
		const sh = 16;
		const n = 28;
		const base = sh - 1.5;
		const peak = 1.5;
		// Higher Q → narrower bell; lower Q → wider.
		const tQ = (q - EQ_Q_MIN) / (EQ_Q_MAX - EQ_Q_MIN);
		const halfWidth = 0.12 + (1 - tQ) * 0.55;
		let d = '';
		for (let i = 0; i < n; i++) {
			const u = i / (n - 1);
			const px = u * sw;
			const v = (u - 0.5) / halfWidth;
			const bell = Math.exp(-v * v);
			const py = base - bell * (base - peak);
			d += `${i === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`;
		}
		return d;
	});

	/**
	 * @param {{ x: number, y: number, w: number, h: number }} bounds
	 */
	function clampBounds(bounds) {
		if (!browser) return bounds;
		const maxW = Math.max(MIN_W, window.innerWidth - VIEW_PAD * 2);
		const maxH = Math.max(MIN_H, window.innerHeight - VIEW_PAD * 2);
		const nextW = Math.min(Math.max(bounds.w, MIN_W), maxW);
		const nextH = Math.min(Math.max(bounds.h, MIN_H), maxH);
		const nextX = Math.min(
			Math.max(bounds.x, VIEW_PAD),
			Math.max(VIEW_PAD, window.innerWidth - nextW - VIEW_PAD)
		);
		const nextY = Math.min(
			Math.max(bounds.y, VIEW_PAD),
			Math.max(VIEW_PAD, window.innerHeight - nextH - VIEW_PAD)
		);
		return { x: nextX, y: nextY, w: nextW, h: nextH };
	}

	function applyBounds(bounds) {
		const next = clampBounds(bounds);
		x = next.x;
		y = next.y;
		w = next.w;
		h = next.h;
		savedBounds = next;
	}

	/** Strip dock, or under a strip-snapped Milkdrop window (DOM-detected). */
	function eqDock() {
		return stackDock({ milkdropOpen: true });
	}

	function defaultBounds() {
		if (!browser) return { x: VIEW_PAD, y: 72, w: DEFAULT_W, h: DEFAULT_H };
		const dock = eqDock();
		if (dock) {
			return clampBounds({ ...dock, h: DEFAULT_H });
		}
		const width = Math.min(DEFAULT_W, window.innerWidth - VIEW_PAD * 2);
		const height = Math.min(DEFAULT_H, window.innerHeight - VIEW_PAD * 2);
		return clampBounds({
			x: Math.max(VIEW_PAD, (window.innerWidth - width) / 2),
			y: Math.min(Math.max(VIEW_PAD, 72), window.innerHeight - height - VIEW_PAD),
			w: width,
			h: height
		});
	}

	/**
	 * Open under a strip-snapped viz when present; otherwise restore session bounds
	 * or fall back to the default strip dock.
	 */
	function spawnBounds() {
		const dock = eqDock();
		const strip = stripDock();
		if (dock && strip && Math.abs(dock.y - strip.y) > SNAP_PX) {
			return clampBounds({ ...dock, h: savedBounds?.h ?? DEFAULT_H });
		}
		return savedBounds ?? defaultBounds();
	}

	onMount(() => {
		floatStack.raise('eq');
		applyBounds(spawnBounds());
		const onResize = () => applyBounds({ x, y, w, h });
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	/**
	 * @param {number} q
	 */
	function clampQ(q) {
		if (!Number.isFinite(q)) return EQ_Q_MIN;
		return Math.min(EQ_Q_MAX, Math.max(EQ_Q_MIN, q));
	}

	/**
	 * @param {number} q
	 */
	function applyQ(q) {
		if (eq.selectedIndex == null) return;
		eq.setNode(eq.selectedIndex, { q: clampQ(q) });
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onSparkPointerDown(event) {
		if (!selected || !sparkEl) return;
		sparkDragging = true;
		dragStartY = event.clientY;
		dragStartQ = clampQ(curveQ);
		sparkEl.setPointerCapture(event.pointerId);
		event.preventDefault();
		event.stopPropagation();
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onSparkPointerMove(event) {
		if (!sparkDragging || !selected) return;
		// Up increases Q (narrower), down widens.
		const dy = dragStartY - event.clientY;
		applyQ(dragStartQ + (dy / DRAG_SPAN_PX) * (EQ_Q_MAX - EQ_Q_MIN));
		event.preventDefault();
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onSparkPointerUp(event) {
		if (!sparkDragging) return;
		sparkDragging = false;
		try {
			sparkEl?.releasePointerCapture(event.pointerId);
		} catch {
			// Capture already released.
		}
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	function onSparkKeydown(event) {
		if (!selected) return;
		const step = event.shiftKey ? 0.5 : 0.15;
		if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
			applyQ(curveQ + step);
			event.preventDefault();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
			applyQ(curveQ - step);
			event.preventDefault();
		} else if (event.key === 'Home') {
			applyQ(EQ_Q_MIN);
			event.preventDefault();
		} else if (event.key === 'End') {
			applyQ(EQ_Q_MAX);
			event.preventDefault();
		}
	}

	/**
	 * Drag the floating panel from rail / padding / empty spectrum.
	 * Interactive controls use `data-eq-no-drag`; node drags stop propagation.
	 *
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function startWindowDrag(event) {
		if (event.button !== 0) return;
		const target = event.target;
		if (!(target instanceof Element) || target.closest('[data-eq-no-drag]')) return;
		winMode = 'drag';
		pointerId = event.pointerId;
		originX = event.clientX;
		originY = event.clientY;
		startX = x;
		startY = y;
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	/**
	 * @param {'resize-se' | 'resize-sw'} mode
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function startWindowResize(mode, event) {
		if (event.button !== 0) return;
		winMode = mode;
		pointerId = event.pointerId;
		originX = event.clientX;
		originY = event.clientY;
		startX = x;
		startY = y;
		startW = w;
		startH = h;
		event.currentTarget.setPointerCapture(event.pointerId);
		event.stopPropagation();
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onWindowPointerMove(event) {
		if (pointerId == null || event.pointerId !== pointerId || !winMode) return;
		const dx = event.clientX - originX;
		const dy = event.clientY - originY;
		if (winMode === 'drag') {
			// Raw coords (from drag origin) keep snap from trapping once docked.
			applyBounds(snapEqToStripDock({ x: startX + dx, y: startY + dy }, { w, h }, eqDock()));
			return;
		}
		if (winMode === 'resize-se') {
			applyBounds({ x: startX, y: startY, w: startW + dx, h: startH + dy });
			return;
		}
		// resize-sw: grow/shrink from the left edge; keep the right edge fixed.
		const nextW = Math.max(MIN_W, startW - dx);
		applyBounds({
			x: startX + (startW - nextW),
			y: startY,
			w: nextW,
			h: startH + dy
		});
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function endWindowPointer(event) {
		if (pointerId == null || event.pointerId !== pointerId) return;
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// Already released.
		}
		winMode = null;
		pointerId = null;
	}
</script>

<aside
	class="eq-panel"
	class:dragging={winMode === 'drag'}
	class:resizing={winMode === 'resize-se' || winMode === 'resize-sw'}
	id="header-eq-panel"
	aria-label="Equalizer"
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height="{h}px"
	style:z-index={floatStack.eq}
	onpointerdowncapture={() => floatStack.raise('eq')}
	onpointerdown={startWindowDrag}
	onpointermove={onWindowPointerMove}
	onpointerup={endWindowPointer}
	onpointercancel={endWindowPointer}
>
	<button
		type="button"
		class="eq-close"
		aria-label="Close equalizer"
		data-eq-no-drag
		onclick={() => eq.setOpen(false)}
		onpointerdown={(e) => e.stopPropagation()}
	>
		<IconX size={11} stroke={1.75} aria-hidden="true" />
	</button>

	<header class="eq-rail" role="toolbar" tabindex="-1" aria-label="Equalizer controls">
		<div class="eq-rail-top" data-eq-no-drag>
			<button
				type="button"
				class="eq-switch"
				role="switch"
				aria-checked={eq.enabled}
				aria-label={eq.enabled ? 'Disable equalizer' : 'Enable equalizer'}
				onclick={() => eq.toggleEnabled()}
				onpointerdown={(e) => e.stopPropagation()}
			>
				<span class="knob"></span>
			</button>
			<button
				type="button"
				class="eq-theme"
				class:on={eq.theme !== 'default'}
				aria-label={`EQ theme: ${eq.theme}`}
				onclick={() => eq.cycleTheme()}
				onpointerdown={(e) => e.stopPropagation()}
			>
				{themeLabel}
			</button>
		</div>

		<div class="eq-vol" data-eq-no-drag>
			<div
				bind:this={volWell}
				class="eq-vol-well"
				class:dragging={volDragging}
				role="slider"
				tabindex="0"
				aria-orientation="vertical"
				aria-label="Master volume"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={volumePct}
				aria-valuetext={`${volumePct}%`}
				onpointerdown={onVolPointerDown}
				onpointermove={onVolPointerMove}
				onpointerup={onVolPointerUp}
				onpointercancel={onVolPointerUp}
				onkeydown={onVolKeydown}
			>
				<span class="eq-vol-trough" aria-hidden="true"></span>
				<span class="eq-vol-meter" aria-hidden="true"></span>
				<span class="eq-vol-grab" aria-hidden="true"></span>
			</div>
		</div>

		<div class="eq-rail-actions" data-eq-no-drag>
			<div class="res-toggle" role="group" aria-label="EQ resolution">
				<button
					type="button"
					class="res-btn"
					class:on={eq.resolution === 4}
					aria-pressed={eq.resolution === 4}
					onclick={() => eq.setResolution(4)}
				>
					4
				</button>
				<button
					type="button"
					class="res-btn"
					class:on={eq.resolution === 8}
					aria-pressed={eq.resolution === 8}
					onclick={() => eq.setResolution(8)}
				>
					8
				</button>
			</div>

			<div class="curve-wrap" class:idle={!selected} class:dragging={sparkDragging}>
				<svg
					{@attach sparkAttach}
					class="curve-spark"
					viewBox="0 0 36 16"
					role="slider"
					tabindex={selected ? 0 : -1}
					aria-disabled={!selected}
					aria-orientation="vertical"
					aria-label="Curve bandwidth"
					aria-valuemin={EQ_Q_MIN}
					aria-valuemax={EQ_Q_MAX}
					aria-valuenow={Number(clampQ(curveQ).toFixed(2))}
					aria-valuetext={`Q ${clampQ(curveQ).toFixed(1)}`}
					onpointerdown={onSparkPointerDown}
					onpointermove={onSparkPointerMove}
					onpointerup={onSparkPointerUp}
					onpointercancel={onSparkPointerUp}
					onkeydown={onSparkKeydown}
				>
					<path class="spark-line" d={sparkPath} />
				</svg>
			</div>

			<button type="button" class="eq-reset" onclick={() => eq.reset()}>Reset</button>
		</div>
	</header>

	<div class="eq-body">
		<div class="spectrum-wrap">
			<EqSpectrum {active} />
		</div>
	</div>

	<div
		class="resize-handle se"
		aria-hidden="true"
		onpointerdown={(e) => startWindowResize('resize-se', e)}
		onpointermove={onWindowPointerMove}
		onpointerup={endWindowPointer}
		onpointercancel={endWindowPointer}
	></div>
	<div
		class="resize-handle sw"
		aria-hidden="true"
		onpointerdown={(e) => startWindowResize('resize-sw', e)}
		onpointermove={onWindowPointerMove}
		onpointerup={endWindowPointer}
		onpointercancel={endWindowPointer}
	></div>
</aside>

<style>
	.eq-panel {
		position: fixed;
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: 0;
		min-width: 320px;
		min-height: 140px;
		overflow: hidden;
		padding: 0.4rem;
		border: 1px solid var(--hard-border);
		border-radius: 0.125rem;
		background: linear-gradient(
			145deg,
			color-mix(in srgb, var(--accent) 7%, var(--paper)) 0%,
			var(--paper) 42%,
			color-mix(in srgb, var(--ink) 5%, var(--paper)) 100%
		);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		touch-action: none;
		cursor: grab;
	}

	.eq-close {
		position: absolute;
		top: 0.15rem;
		right: 0.15rem;
		z-index: 50;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		border-radius: 0;
		color: var(--muted);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		cursor: pointer;
		pointer-events: auto;
	}

	.eq-close :global(svg) {
		display: block;
	}

	.eq-close:hover {
		border-color: var(--ink);
		color: var(--ink);
		background: var(--paper);
	}

	.eq-panel.dragging {
		cursor: grabbing;
	}

	.eq-panel.dragging,
	.eq-panel.resizing {
		user-select: none;
	}

	:global(html.dark) .eq-panel {
		background: linear-gradient(
			145deg,
			color-mix(in srgb, var(--accent) 12%, var(--paper)) 0%,
			var(--paper) 48%,
			color-mix(in srgb, var(--ink) 18%, var(--paper)) 100%
		);
	}

	.eq-rail {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 2.6rem;
		min-height: 0;
		cursor: grab;
	}

	.eq-panel.dragging .eq-rail {
		cursor: grabbing;
	}

	.eq-rail-top {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		cursor: default;
	}

	.eq-rail-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		cursor: default;
	}

	.eq-switch {
		position: relative;
		flex: 0 0 auto;
		width: 2.2rem;
		height: 1.15rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--field-border));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 10%, var(--field-surface));
		box-shadow: inset 0 1px 2px color-mix(in srgb, var(--ink) 12%, transparent);
		cursor: pointer;
	}

	.eq-switch[aria-checked='true'] {
		background: color-mix(in srgb, var(--accent) 55%, var(--field-surface));
		border-color: color-mix(in srgb, var(--accent) 55%, var(--ink));
	}

	.eq-switch .knob {
		position: absolute;
		top: 50%;
		left: 0.15rem;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--ink) 42%, var(--paper));
		box-shadow: 0 1px 1px color-mix(in srgb, var(--ink) 28%, transparent);
		transform: translateY(-50%);
		transition: transform 120ms ease;
	}

	.eq-switch[aria-checked='true'] .knob {
		background: var(--on-accent);
		transform: translate(1.05rem, -50%);
	}

	.eq-theme {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-family: var(--font-lcd);
		font-size: 0.68rem;
		font-weight: 400;
		letter-spacing: 0.04em;
		line-height: 1.15;
		text-align: center;
		text-transform: uppercase;
		cursor: pointer;
	}

	.eq-theme.on {
		color: var(--accent);
		text-shadow: 0 0 8px color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.eq-theme:hover {
		color: var(--ink);
	}

	.eq-theme.on:hover {
		color: var(--accent);
	}

	.eq-theme:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.eq-vol {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 2.2rem;
		min-height: 3.5rem;
		margin: 0;
		cursor: default;
	}

	.eq-vol-well {
		--vol: 1;
		--meter: 0;
		--trough-w: 0.32rem;
		/* Center the trough in the rail; triangle stays to its right. */
		--trough-x: calc(50% - var(--trough-w) / 2);
		position: relative;
		flex: 1 1 auto;
		width: 1.35rem;
		min-height: 2.75rem;
		outline: none;
		cursor: ns-resize;
		touch-action: none;
	}

	.eq-vol-well.dragging {
		cursor: grabbing;
	}

	.eq-vol-well:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	/* Narrow trough — light gray to match field chrome. */
	.eq-vol-trough {
		position: absolute;
		top: 0;
		bottom: 0;
		left: var(--trough-x);
		width: var(--trough-w);
		border: 1px solid color-mix(in srgb, var(--ink) 18%, var(--field-border));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--ink) 7%, var(--field-surface));
		box-shadow: inset 0 1px 2px color-mix(in srgb, var(--ink) 10%, transparent);
		pointer-events: none;
	}

	/* Live UV fill inside the trough (post-fader). */
	.eq-vol-meter {
		position: absolute;
		bottom: 1px;
		left: calc(var(--trough-x) + 1px);
		width: calc(var(--trough-w) - 2px);
		height: calc((100% - 2px) * var(--meter));
		border-radius: 0 0 0.0625rem 0.0625rem;
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--accent) 70%, #1f8f2e) 0%,
			var(--accent) 55%,
			#e8d020 82%,
			#e02418 100%
		);
		transform-origin: bottom center;
		pointer-events: none;
	}

	/* Ableton-style triangle — tip on the meter, body offset to the right. */
	.eq-vol-grab {
		position: absolute;
		left: calc(var(--trough-x) + var(--trough-w) - 0.1rem);
		bottom: calc(var(--vol) * 100%);
		width: 0.42rem;
		height: 0.55rem;
		background: var(--accent);
		clip-path: polygon(0 50%, 100% 8%, 100% 92%);
		transform: translateY(50%);
		filter: drop-shadow(0.5px 0 0 var(--ink))
			drop-shadow(0 1px 1px color-mix(in srgb, var(--ink) 40%, transparent));
		pointer-events: none;
	}

	.res-toggle {
		display: flex;
		flex-direction: row;
		box-sizing: border-box;
		width: 2.2rem;
		height: 1.2rem;
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--field-border));
		border-radius: 0.125rem;
		overflow: hidden;
		background: color-mix(in srgb, var(--accent) 6%, var(--field-surface));
	}

	.res-btn {
		display: flex;
		flex: 1 1 0;
		align-items: center;
		justify-content: center;
		min-width: 0;
		padding: 0;
		border: 0;
		border-right: 1px solid color-mix(in srgb, var(--accent) 22%, var(--field-border));
		background: transparent;
		color: var(--muted);
		font-family: var(--font-lcd);
		font-size: 0.72rem;
		font-weight: 400;
		letter-spacing: 0.02em;
		line-height: 1;
		cursor: pointer;
	}

	.res-btn:last-child {
		border-right: 0;
	}

	.res-btn.on {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		text-shadow: 0 0 8px color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.res-btn:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}

	.curve-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 2.2rem;
		height: 1.75rem;
		margin: 0;
		padding: 0.2rem 0.15rem;
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--field-border));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 6%, var(--field-surface));
		box-shadow: inset 0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent);
		cursor: default;
	}

	.curve-wrap.idle {
		opacity: 0.55;
	}

	.curve-wrap.dragging {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--field-border));
	}

	.curve-spark {
		display: block;
		width: 1.9rem;
		height: 0.95rem;
		flex-shrink: 0;
		overflow: visible;
		cursor: ns-resize;
		touch-action: none;
		outline: none;
	}

	.curve-wrap.idle .curve-spark {
		cursor: default;
	}

	.curve-spark:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.spark-line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.35;
		stroke-linecap: round;
		stroke-linejoin: round;
		pointer-events: none;
	}

	.curve-wrap.idle .spark-line {
		stroke: color-mix(in srgb, var(--muted) 70%, var(--accent));
	}

	.eq-reset {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		line-height: 1.15;
		text-align: center;
		text-decoration: underline;
		text-transform: uppercase;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}

	.eq-reset:hover {
		color: var(--ink);
	}

	.eq-body {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}

	.spectrum-wrap {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
	}

	.spectrum-wrap :global(.spectrum-host),
	.spectrum-wrap :global(.spectrum) {
		min-height: 0;
	}

	.resize-handle {
		--eq-grip: color-mix(in srgb, var(--ink) 28%, transparent);
		position: absolute;
		width: 0.65rem;
		height: 0.65rem;
	}

	:global(html.dark) .resize-handle {
		--eq-grip: color-mix(in srgb, var(--accent) 22%, black);
	}

	.resize-handle.se {
		right: 0;
		bottom: 0;
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

	.resize-handle.sw {
		left: 0;
		bottom: 0;
		cursor: nesw-resize;
		background: linear-gradient(
			225deg,
			transparent 0 45%,
			var(--eq-grip) 45% 52%,
			transparent 52% 68%,
			var(--eq-grip) 68% 75%,
			transparent 75%
		);
	}
</style>
