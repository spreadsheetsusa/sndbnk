<script>
	import { onMount, untrack } from 'svelte';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { accentColor } from '#lib/stores/brand.js';
	import { resolvedTheme } from '#lib/stores/theme.js';

	/**
	 * SoundCloud-style waveform rendered from pre-computed peaks.
	 * Default `bars` variant matches the feed/player scrubbers. Library edit
	 * passes `wave` for a continuous path plus optional `minPxPerSec` zoom.
	 * Never fetches or decodes audio: progress is driven externally via
	 * `currentTime`, and seeks are reported through `onseek`. A press-drag
	 * gesture previews its position through `onscrub` and only commits on
	 * release. Hover shows a lighter fill to the cursor without moving the
	 * playhead. When zoomed, pass `playing` so the scroll host can auto-center
	 * — Wavesurfer's own autoCenter only runs while it is playing media.
	 *
	 * @type {{
	 *   peaks: number[] | null,
	 *   durationMs: number | null,
	 *   currentTime?: number,
	 *   playing?: boolean,
	 *   height?: number,
	 *   label?: string,
	 *   variant?: 'bars' | 'wave',
	 *   minPxPerSec?: number | null,
	 *   onseek?: (seconds: number) => void,
	 *   onscrub?: (seconds: number | null) => void,
	 *   onhover?: (hovering: boolean) => void
	 * }}
	 */
	let {
		peaks,
		durationMs,
		currentTime = 0,
		playing = false,
		height,
		label = 'Seek',
		variant = 'bars',
		minPxPerSec = null,
		onseek,
		onscrub,
		onhover
	} = $props();

	const KEYBOARD_STEP_SECONDS = 5;

	/** @type {HTMLDivElement} */
	let container;
	/** @type {import('wavesurfer.js').default | null} */
	let wavesurfer = $state.raw(null);
	/** Pointer position as 0..1 while a scrub is in flight. @type {number | null} */
	let scrubRatio = $state(null);
	/** Pointer position as 0..1 while hovering (not used for playhead). @type {number | null} */
	let hoverRatio = $state(null);
	/** Imperative handle into Wavesurfer's shadow DOM; not read from the template. */
	/** @type {HTMLDivElement | null} */
	let hoverLayer = null;
	/** True after Wavesurfer finishes load/decode so zoom() is safe. */
	let audioReady = $state(false);

	const durationSec = $derived(Math.max((durationMs ?? 0) / 1000, 0.001));
	const displayTime = $derived(scrubRatio == null ? currentTime : scrubRatio * durationSec);
	const zoomed = $derived(minPxPerSec != null && minPxPerSec > 0);

	function normalizedPeaks() {
		if (peaks && peaks.length > 0) {
			return peaks.map((v) => v / 100);
		}
		// Placeholder bars for tracks without generated waveforms yet.
		return Array.from({ length: 200 }, (_, i) => 0.12 + 0.06 * Math.abs(Math.sin(i / 3)));
	}

	/**
	 * Explicit prop wins; otherwise read the laid-out CSS height so TrackCard can
	 * omit `height` and pick up `--waveform-height` (taller under pointer: coarse).
	 */
	function resolveHeight() {
		if (height != null) return height;
		if (!container) return 66;
		return Math.round(parseFloat(getComputedStyle(container).height)) || 66;
	}

	/** @param {string} accent */
	function resolveColors(accent) {
		const cssHeight = resolveHeight();
		const styles = getComputedStyle(container);
		const ink = styles.getPropertyValue('--ink').trim() || '#11110f';
		const paper = styles.getPropertyValue('--paper').trim() || '#f2f0e8';
		const progressTop = accent;
		const progressBottom = mixHex(accent, ink, 0.3);
		return {
			waveColor: verticalSplit(hexWithAlpha(ink, 0.28), hexWithAlpha(ink, 0.55), paper, cssHeight),
			progressColor: verticalSplit(progressTop, progressBottom, paper, cssHeight),
			// 40% lighter than the progress fill — mixes each stop toward white.
			hoverColor: verticalSplit(
				mixHex(progressTop, '#ffffff', 0.4),
				mixHex(progressBottom, '#ffffff', 0.4),
				paper,
				cssHeight
			)
		};
	}

	/**
	 * Two-tone bars: the mirrored lower half is drawn stronger than the upper
	 * half, parted by a hairline of the page background. Wavesurfer centres bars
	 * in a canvas of `height * devicePixelRatio` device pixels and applies no
	 * transform, so the gradient has to be built in those same units to land on
	 * the middle of the bars.
	 *
	 * @param {string} top
	 * @param {string} bottom
	 * @param {string} split
	 * @param {number} cssHeight resolved CSS-pixel height (prop or --waveform-height)
	 */
	function verticalSplit(top, bottom, split, cssHeight) {
		const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
		const canvasHeight = cssHeight * pixelRatio;
		const ctx = document.createElement('canvas').getContext('2d');
		if (!ctx) return top;

		const line = pixelRatio / canvasHeight;
		const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
		gradient.addColorStop(0, top);
		gradient.addColorStop(0.5 - line, top);
		gradient.addColorStop(0.5 - line, split);
		gradient.addColorStop(0.5 + line, split);
		gradient.addColorStop(0.5 + line, bottom);
		gradient.addColorStop(1, bottom);
		return gradient;
	}

	/**
	 * Canvas colors cannot use CSS vars or color-mix, so unpack the resolved hex.
	 * @param {string} hex
	 * @returns {[number, number, number] | null}
	 */
	function parseHex(hex) {
		const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
		if (!match) return null;
		const n = Number.parseInt(match[1], 16);
		return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
	}

	/**
	 * @param {string} hex
	 * @param {number} alpha
	 */
	function hexWithAlpha(hex, alpha) {
		const rgb = parseHex(hex);
		if (!rgb) return hex;
		return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
	}

	/**
	 * @param {string} hex
	 * @param {string} toward
	 * @param {number} amount
	 */
	function mixHex(hex, toward, amount) {
		const from = parseHex(hex);
		const to = parseHex(toward);
		if (!from || !to) return hex;
		const channel = (/** @type {number} */ i) => Math.round(from[i] + (to[i] - from[i]) * amount);
		return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
	}

	/** Ensure the hover clip layer exists under the real progress wrapper. */
	function ensureHoverLayer() {
		if (!wavesurfer) return null;
		const wrapper = wavesurfer.getWrapper();
		const progress = wrapper.querySelector('.progress');
		if (!progress) return null;

		let layer = wrapper.querySelector('.hover-progress');
		if (!(layer instanceof HTMLDivElement)) {
			layer = document.createElement('div');
			layer.className = 'hover-progress';
			layer.setAttribute('part', 'hover-progress');
			Object.assign(layer.style, {
				pointerEvents: 'none',
				position: 'absolute',
				zIndex: '1',
				top: '0',
				left: '0',
				width: '0',
				height: '100%',
				overflow: 'hidden',
				opacity: '0'
			});
			progress.before(layer);
		}
		hoverLayer = layer;
		return layer;
	}

	/**
	 * Clone the progress canvases and recolor them to the lighter hover fill.
	 * Progress canvases are full-width; the layer clips them by width like Wavesurfer.
	 */
	function rebuildHoverCanvases() {
		const layer = ensureHoverLayer();
		if (!layer || !wavesurfer) return;

		const progress = wavesurfer.getWrapper().querySelector('.progress');
		if (!progress) return;

		const { hoverColor } = resolveColors($accentColor);
		layer.replaceChildren();

		for (const containerEl of progress.children) {
			if (!(containerEl instanceof HTMLElement)) continue;
			const hoverContainer = document.createElement('div');
			hoverContainer.style.position = 'relative';
			hoverContainer.style.height = containerEl.style.height;

			for (const canvas of containerEl.querySelectorAll('canvas')) {
				const clone = /** @type {HTMLCanvasElement} */ (canvas.cloneNode());
				clone.width = canvas.width;
				clone.height = canvas.height;
				clone.style.width = canvas.style.width;
				clone.style.height = canvas.style.height;
				clone.style.left = canvas.style.left;
				clone.style.display = 'block';
				clone.style.position = 'absolute';
				clone.style.top = '0';

				const ctx = clone.getContext('2d');
				if (ctx) {
					ctx.drawImage(canvas, 0, 0);
					ctx.globalCompositeOperation = 'source-in';
					ctx.fillStyle = hoverColor;
					ctx.fillRect(0, 0, clone.width, clone.height);
				}
				hoverContainer.appendChild(clone);
			}
			layer.appendChild(hoverContainer);
		}

		syncHoverLayer(hoverRatio);
	}

	/** @param {number | null} ratio */
	function syncHoverLayer(ratio) {
		const layer = hoverLayer ?? ensureHoverLayer();
		if (!layer) return;
		if (ratio == null) {
			layer.style.width = '0';
			layer.style.opacity = '0';
			return;
		}
		layer.style.width = `${ratio * 100}%`;
		layer.style.opacity = '1';
	}

	/** Scroll host Wavesurfer uses when the canvas is wider than the container. */
	function scrollHost() {
		if (!wavesurfer) return container;
		const wrapper = wavesurfer.getWrapper();
		return /** @type {HTMLElement} */ (wrapper.parentElement ?? container);
	}

	/**
	 * Mirror Wavesurfer's scrollIntoView (zoom example autoCenter): snap when
	 * the playhead leaves the viewport, and while playing keep it centered
	 * once it reaches mid-view. We own scroll because setTime() always calls
	 * renderProgress with isPlaying=false (media lives on the global player).
	 * @param {number} time
	 * @param {boolean} follow
	 */
	function syncScroll(time, follow) {
		if (!zoomed || !wavesurfer || scrubRatio != null) return;
		const host = scrollHost();
		const { scrollWidth, clientWidth } = host;
		if (scrollWidth <= clientWidth || durationSec <= 0) return;

		const progressWidth = (time / durationSec) * scrollWidth;
		const middle = clientWidth / 2;
		const startEdge = host.scrollLeft;
		const endEdge = startEdge + clientWidth;

		if (progressWidth < startEdge || progressWidth > endEdge) {
			host.scrollLeft = Math.max(0, progressWidth - middle);
			return;
		}
		if (!follow) return;

		// Same lock as Wavesurfer: only scroll forward once past mid-view.
		const center = progressWidth - host.scrollLeft - middle;
		if (center <= 0) return;
		const pxPerSec = scrollWidth / durationSec;
		host.scrollLeft += pxPerSec <= 600 ? Math.min(center, 10) : center;
	}

	/** @param {PointerEvent} event */
	function ratioFromPointer(event) {
		const host = scrollHost();
		const rect = host.getBoundingClientRect();
		if (rect.width === 0) return 0;
		const scrollWidth = Math.max(host.scrollWidth, rect.width);
		const x = host.scrollLeft + (event.clientX - rect.left);
		return Math.min(Math.max(x / scrollWidth, 0), 1);
	}

	/** @param {number | null} next */
	function setHoverRatio(next) {
		const wasHovering = hoverRatio != null;
		const nowHovering = next != null;
		hoverRatio = next;
		if (wasHovering !== nowHovering) onhover?.(nowHovering);
	}

	/** @param {PointerEvent} event */
	function handlePointerEnter(event) {
		setHoverRatio(ratioFromPointer(event));
	}

	/** @param {PointerEvent} event */
	function handlePointerMove(event) {
		if (scrubRatio != null) return;
		setHoverRatio(ratioFromPointer(event));
	}

	function handlePointerLeave() {
		if (scrubRatio != null) return;
		setHoverRatio(null);
	}

	/** @param {PointerEvent} event */
	function startScrub(event) {
		if (event.button !== 0) return;
		event.preventDefault();
		try {
			// Keeps the gesture alive when the pointer is released off-window.
			container.setPointerCapture(event.pointerId);
		} catch {
			// Pointer already gone; the window listeners still finish the scrub.
		}
		scrubRatio = ratioFromPointer(event);
		setHoverRatio(scrubRatio);
		onscrub?.(scrubRatio * durationSec);
	}

	/** @param {PointerEvent} event */
	function moveScrub(event) {
		if (scrubRatio == null) return;
		scrubRatio = ratioFromPointer(event);
		setHoverRatio(scrubRatio);
		onscrub?.(scrubRatio * durationSec);
	}

	/** @param {PointerEvent} event */
	function endScrub(event) {
		if (scrubRatio == null) return;
		const seconds = ratioFromPointer(event) * durationSec;
		scrubRatio = null;
		onscrub?.(null);
		onseek?.(seconds);
		// Pointer may already be off the waveform when the capture ends.
		if (!container.matches(':hover')) setHoverRatio(null);
	}

	function cancelScrub() {
		if (scrubRatio == null) return;
		scrubRatio = null;
		onscrub?.(null);
		if (!container.matches(':hover')) setHoverRatio(null);
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		/** @type {Record<string, number>} */
		const targets = {
			ArrowLeft: currentTime - KEYBOARD_STEP_SECONDS,
			ArrowRight: currentTime + KEYBOARD_STEP_SECONDS,
			Home: 0,
			End: durationSec
		};
		const seconds = targets[event.key];
		if (seconds == null) return;
		event.preventDefault();
		onseek?.(Math.min(Math.max(seconds, 0), durationSec));
	}

	onMount(() => {
		let destroyed = false;
		/** @type {(() => void) | undefined} */
		let unsubRendered;
		/** @type {(() => void) | undefined} */
		let unsubReady;
		/** Last container width we forced a redraw for. */
		let lastDrawnWidth = 0;

		/**
		 * Wavesurfer observes its internal scroll host, which can keep a stale
		 * intrinsic width in flex/grid layouts so window shrinks clip the canvas
		 * instead of reflowing. Watch our outer container (min-width: 0) and
		 * force a full redraw when the available width changes.
		 */
		const resizeObserver = new ResizeObserver(() => {
			const ws = wavesurfer;
			if (!ws || destroyed) return;
			const width = Math.round(container.clientWidth);
			if (width <= 0 || width === lastDrawnWidth) return;
			lastDrawnWidth = width;
			ws.setOptions({});
		});
		resizeObserver.observe(container);

		(async () => {
			const { default: WaveSurfer } = await import('wavesurfer.js');
			if (destroyed) return;

			const resolvedHeight = resolveHeight();
			const colors = resolveColors($accentColor);
			const useBars = variant === 'bars';
			audioReady = false;
			wavesurfer = WaveSurfer.create({
				container,
				height: resolvedHeight,
				waveColor: colors.waveColor,
				progressColor: colors.progressColor,
				...(useBars ? { barWidth: 2, barGap: 1, barRadius: 0 } : {}),
				cursorWidth: 0,
				// Seeking is owned by this component so a drag can preview
				// without committing until the pointer is released.
				interact: false,
				fillParent: !zoomed,
				// External setTime() never reports isPlaying; we scroll in syncScroll.
				autoScroll: false,
				autoCenter: zoomed,
				...(zoomed && minPxPerSec != null ? { minPxPerSec } : {}),
				peaks: [normalizedPeaks()],
				duration: durationSec
			});
			lastDrawnWidth = Math.round(container.clientWidth);

			// zoom() throws until decode finishes; create's load is async.
			unsubReady = wavesurfer.on('ready', () => {
				if (!destroyed) audioReady = true;
			});
			// Wavesurfer re-emits the renderer's `rendered` as `redrawcomplete`.
			unsubRendered = wavesurfer.on('redrawcomplete', () => {
				if (!destroyed) rebuildHoverCanvases();
			});
		})();

		return () => {
			destroyed = true;
			resizeObserver.disconnect();
			unsubReady?.();
			unsubRendered?.();
			hoverLayer = null;
			wavesurfer?.destroy();
			wavesurfer = null;
			audioReady = false;
			if (hoverRatio != null) onhover?.(false);
		};
	});

	// Drive the rendered progress: an in-flight scrub wins over the player clock.
	$effect(() => {
		const time = displayTime;
		const follow = playing;
		if (wavesurfer) {
			wavesurfer.setTime(time);
			syncScroll(time, follow);
		}
	});

	// Reload peaks if the track data changes under us. setOptions({ peaks })
	// updates decodedData but leaves the renderer's audioData stale, so the
	// canvas keeps drawing the first track — load() is the path that re-renders.
	$effect(() => {
		const nextPeaks = peaks;
		const nextDuration = durationSec;
		const ws = wavesurfer;
		if (!ws) return;
		scrubRatio = null;
		hoverRatio = null;
		audioReady = false;
		void ws.load(
			'',
			[nextPeaks && nextPeaks.length > 0 ? nextPeaks.map((v) => v / 100) : normalizedPeaks()],
			nextDuration
		);
	});

	// Re-resolve canvas colors when the theme or accent changes.
	$effect(() => {
		const theme = $resolvedTheme;
		const accent = $accentColor;
		if (wavesurfer && theme) {
			const colors = resolveColors(accent);
			wavesurfer.setOptions({
				waveColor: colors.waveColor,
				progressColor: colors.progressColor
			});
			rebuildHoverCanvases();
		}
	});

	// Clip the hover layer to the pointer without touching the playhead.
	$effect(() => {
		const ratio = hoverRatio;
		syncHoverLayer(ratio);
	});

	// Zoom after decode; parent remounts bars↔wave so fit reset is a new instance.
	$effect(() => {
		const ws = wavesurfer;
		const px = minPxPerSec;
		const ready = audioReady;
		if (!ws || !ready || px == null || px <= 0) return;
		if (!ws.getDecodedData()) return;
		ws.setOptions({ fillParent: false, autoScroll: false, autoCenter: true });
		ws.zoom(px);
		// Re-center on the current playhead without re-running this on every tick.
		untrack(() => syncScroll(displayTime, playing));
	});
</script>

<svelte:window onpointermove={moveScrub} onpointerup={endScrub} onpointercancel={cancelScrub} />

<div
	class="waveform"
	class:scrubbing={scrubRatio != null}
	class:zoomed
	bind:this={container}
	style:height={height != null ? `${height}px` : 'var(--waveform-height)'}
	role="slider"
	tabindex="0"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={durationSec}
	aria-valuenow={displayTime}
	aria-valuetext={formatDuration(displayTime * 1000)}
	onpointerdown={startScrub}
	onpointerenter={handlePointerEnter}
	onpointermove={handlePointerMove}
	onpointerleave={handlePointerLeave}
	onkeydown={handleKeydown}
></div>

<style>
	.waveform {
		display: block;
		width: 100%;
		/* Flex/grid default min-width:auto uses canvas min-content and blocks shrink. */
		min-width: 0;
		max-width: 100%;
		/* Clip stale canvases until ResizeObserver redraws to the new width. */
		overflow: hidden;
		cursor: pointer;
		/* Horizontal drags scrub; vertical ones still scroll the page. */
		touch-action: pan-y;
		user-select: none;
	}

	/* Wavesurfer's host node must shrink with us, not prop open the flex item. */
	.waveform > :global(div) {
		display: block;
		width: 100%;
		max-width: 100%;
		overflow: hidden;
	}

	/* Zoomed canvas is wider than the container; Wavesurfer scrolls this host. */
	.waveform.zoomed,
	.waveform.zoomed > :global(div) {
		overflow-x: auto;
		overflow-y: hidden;
	}

	.waveform.scrubbing {
		cursor: ew-resize;
	}
</style>
