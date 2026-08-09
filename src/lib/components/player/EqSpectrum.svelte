<script>
	import { accentColor } from '#lib/stores/brand.js';
	import { resolvedTheme } from '#lib/stores/theme.js';
	import { audioGraph } from '#lib/player/audio-graph.svelte.js';
	import { EQ_FREQ_MAX, EQ_FREQ_MIN, EQ_GAIN_MAX, EQ_GAIN_MIN } from '#lib/player/eq-bands.js';
	import { eq } from '#lib/player/eq.svelte.js';

	/**
	 * Live analyser spectrum with EQ curve + draggable parametric nodes.
	 *
	 * @type {{ active?: boolean }}
	 */
	let { active = true } = $props();

	/** @type {HTMLCanvasElement | null} */
	let canvas = $state.raw(null);
	/** @type {HTMLDivElement | null} */
	let host = $state.raw(null);
	/** @type {number} */
	let raf = 0;
	/** @type {number | null} */
	let dragIndex = $state(null);

	const NODE_HIT_R = 14;
	const NODE_DRAW_R = 5.5;

	/** Margins outside the bars/curve plot for axis labels. */
	const PAD_L = 28;
	const PAD_R = 6;
	const PAD_T = 4;
	const PAD_B = 16;

	/** Major log-frequency ticks (Hz) — same domain as `freqToX`. */
	const FREQ_MAJOR = Object.freeze([20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]);
	/** Compact set when the plot is narrow. */
	const FREQ_MAJOR_NARROW = Object.freeze([20, 100, 1000, 10000, 20000]);
	/** Unlabeled decade subdivisions. */
	const FREQ_MINOR = Object.freeze([
		30, 40, 60, 70, 80, 90, 150, 300, 400, 600, 700, 800, 900, 1500, 3000, 4000, 6000, 7000, 8000,
		9000, 15000
	]);
	/** Gain ticks in dB — same domain as `gainToY` (±12). */
	const GAIN_MAJOR = Object.freeze([12, 6, 0, -6, -12]);
	const GAIN_MINOR = Object.freeze([9, 3, -3, -9]);

	/** @typedef {{ x: number, y: number, w: number, h: number }} PlotRect */

	/** Precomputed log-spaced frequencies for the EQ response curve. */
	const curveFreqs = (() => {
		const n = 128;
		const freqs = new Float32Array(n);
		const logMin = Math.log10(EQ_FREQ_MIN);
		const logMax = Math.log10(EQ_FREQ_MAX);
		for (let i = 0; i < n; i++) {
			freqs[i] = 10 ** (logMin + (i / (n - 1)) * (logMax - logMin));
		}
		return freqs;
	})();

	$effect(() => {
		// Theme / accent / nodes / enabled — redraw deps for the paint loop.
		void $accentColor;
		void $resolvedTheme;
		void eq.theme;
		void eq.nodes;
		void eq.resolution;
		void eq.selectedIndex;
		void eq.enabled;
		void audioGraph.ready;
		const el = canvas;
		const running = active && el;

		if (!running) {
			if (raf) {
				cancelAnimationFrame(raf);
				raf = 0;
			}
			return;
		}

		const ctx2d = el.getContext('2d');
		if (!ctx2d) return;

		const bins = new Uint8Array(1024);

		const tick = () => {
			paint(el, ctx2d, bins);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(raf);
			raf = 0;
		};
	});

	/**
	 * @param {HTMLCanvasElement} el
	 * @param {CanvasRenderingContext2D} ctx2d
	 * @param {Uint8Array} bins
	 */
	function paint(el, ctx2d, bins) {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const cssW = Math.max(1, el.clientWidth);
		const cssH = Math.max(1, el.clientHeight);
		const w = Math.round(cssW * dpr);
		const h = Math.round(cssH * dpr);
		if (el.width !== w) el.width = w;
		if (el.height !== h) el.height = h;

		const styles = getComputedStyle(el);
		const ink = styles.getPropertyValue('--ink').trim() || '#11110f';
		const muted = styles.getPropertyValue('--muted').trim() || ink;
		const accent = $accentColor || styles.getPropertyValue('--accent').trim() || '#c8ff00';
		const palette = spectrumPalette(eq.theme, { ink, muted, accent });
		const plot = plotRect(cssW, cssH);

		ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
		// Leave the canvas clear so the panel paper shows through (no black wash).
		ctx2d.clearRect(0, 0, cssW, cssH);

		paintAxes(ctx2d, plot, palette);
		paintAxisLabels(ctx2d, plot, palette, styles);

		ctx2d.save();
		ctx2d.beginPath();
		ctx2d.rect(plot.x, plot.y, plot.w, plot.h);
		ctx2d.clip();

		const analyser = audioGraph.analyser;
		if (analyser) {
			const freqBins = analyser.frequencyBinCount;
			const data = bins.length === freqBins ? bins : new Uint8Array(freqBins);
			analyser.getByteFrequencyData(data);

			const sampleRate = audioGraph.ctx?.sampleRate ?? 44100;
			const barCount = Math.min(96, data.length);
			const barGap = 1;
			const barW = Math.max(1, (plot.w - barGap * (barCount - 1)) / barCount);

			for (let i = 0; i < barCount; i++) {
				const t = i / (barCount - 1);
				const hz = EQ_FREQ_MIN * 10 ** (t * Math.log10(EQ_FREQ_MAX / EQ_FREQ_MIN));
				const bin = Math.min(
					data.length - 1,
					Math.max(0, Math.round((hz / (sampleRate / 2)) * data.length))
				);
				const v = data[bin] / 255;
				const barH = Math.max(1, v * (plot.h - 2));
				const x = plot.x + i * (barW + barGap);
				ctx2d.fillStyle = palette.bar(v);
				ctx2d.fillRect(x, plot.y + plot.h - barH, barW, barH);
			}
		}

		// EQ magnitude curve (applied response)
		const mag = eq.getFrequencyResponse(curveFreqs);
		ctx2d.beginPath();
		for (let i = 0; i < curveFreqs.length; i++) {
			const x = freqToX(curveFreqs[i], plot);
			const db = 20 * Math.log10(Math.max(mag[i], 1e-6));
			const clamped = Math.min(EQ_GAIN_MAX, Math.max(EQ_GAIN_MIN, db));
			const y = gainToY(clamped, plot);
			if (i === 0) ctx2d.moveTo(x, y);
			else ctx2d.lineTo(x, y);
		}
		ctx2d.strokeStyle = palette.curve;
		ctx2d.lineWidth = 1.5;
		ctx2d.stroke();

		// Parametric nodes
		for (let i = 0; i < eq.nodes.length; i++) {
			const node = eq.nodes[i];
			const x = freqToX(node.hz, plot);
			const y = gainToY(node.gain, plot);
			const selected = eq.selectedIndex === i;
			const activeGain = node.gain !== 0;

			if (selected) {
				ctx2d.beginPath();
				ctx2d.arc(x, y, NODE_DRAW_R + 4, 0, Math.PI * 2);
				ctx2d.fillStyle = palette.nodeHalo;
				ctx2d.fill();
				ctx2d.strokeStyle = palette.nodeHaloStroke;
				ctx2d.lineWidth = 1.5;
				ctx2d.stroke();
			}

			ctx2d.beginPath();
			ctx2d.arc(x, y, NODE_DRAW_R, 0, Math.PI * 2);
			ctx2d.fillStyle = activeGain ? palette.nodeActive : palette.nodeIdle;
			ctx2d.fill();
			ctx2d.strokeStyle = selected ? palette.nodeStrokeSelected : palette.nodeStroke;
			ctx2d.lineWidth = 1;
			ctx2d.stroke();
		}

		ctx2d.restore();
	}

	/**
	 * @param {number} cssW
	 * @param {number} cssH
	 * @returns {PlotRect}
	 */
	function plotRect(cssW, cssH) {
		return {
			x: PAD_L,
			y: PAD_T,
			w: Math.max(1, cssW - PAD_L - PAD_R),
			h: Math.max(1, cssH - PAD_T - PAD_B)
		};
	}

	/**
	 * Grid lines inside the plot; tick stubs poke into the label gutters.
	 *
	 * @param {CanvasRenderingContext2D} ctx2d
	 * @param {PlotRect} plot
	 * @param {ReturnType<typeof spectrumPalette>} palette
	 */
	function paintAxes(ctx2d, plot, palette) {
		const right = plot.x + plot.w;
		const bottom = plot.y + plot.h;
		ctx2d.lineWidth = 1;

		ctx2d.strokeStyle = palette.gridMinor;
		for (const hz of FREQ_MINOR) {
			const x = freqToX(hz, plot);
			ctx2d.beginPath();
			ctx2d.moveTo(x, plot.y);
			ctx2d.lineTo(x, bottom);
			ctx2d.stroke();
		}
		for (const db of GAIN_MINOR) {
			const y = gainToY(db, plot);
			ctx2d.beginPath();
			ctx2d.moveTo(plot.x, y);
			ctx2d.lineTo(right, y);
			ctx2d.stroke();
		}

		ctx2d.strokeStyle = palette.grid;
		for (const hz of FREQ_MAJOR) {
			const x = freqToX(hz, plot);
			ctx2d.beginPath();
			ctx2d.moveTo(x, plot.y);
			ctx2d.lineTo(x, bottom);
			ctx2d.stroke();
			// Stub into bottom gutter.
			ctx2d.beginPath();
			ctx2d.moveTo(x, bottom);
			ctx2d.lineTo(x, bottom + 3);
			ctx2d.stroke();
		}
		for (const db of GAIN_MAJOR) {
			const y = gainToY(db, plot);
			if (db !== 0) {
				ctx2d.beginPath();
				ctx2d.moveTo(plot.x, y);
				ctx2d.lineTo(right, y);
				ctx2d.stroke();
			}
			// Stub into left gutter.
			ctx2d.beginPath();
			ctx2d.moveTo(plot.x - 3, y);
			ctx2d.lineTo(plot.x, y);
			ctx2d.stroke();
		}

		ctx2d.strokeStyle = palette.zero;
		const zeroY = gainToY(0, plot);
		ctx2d.beginPath();
		ctx2d.moveTo(plot.x, zeroY);
		ctx2d.lineTo(right, zeroY);
		ctx2d.stroke();
	}

	/**
	 * Labels sit in the gutters outside the plot (left = dB, bottom = Hz).
	 *
	 * @param {CanvasRenderingContext2D} ctx2d
	 * @param {PlotRect} plot
	 * @param {ReturnType<typeof spectrumPalette>} palette
	 * @param {CSSStyleDeclaration} styles
	 */
	function paintAxisLabels(ctx2d, plot, palette, styles) {
		const lcd = styles.getPropertyValue('--font-lcd').trim() || 'ui-monospace, monospace';
		const freqTicks = plot.w < 340 ? FREQ_MAJOR_NARROW : FREQ_MAJOR;

		ctx2d.font = `400 9px ${lcd}`;
		ctx2d.fillStyle = palette.label;
		ctx2d.textBaseline = 'middle';
		ctx2d.textAlign = 'right';

		for (const db of GAIN_MAJOR) {
			ctx2d.fillText(formatDb(db), plot.x - 5, gainToY(db, plot));
		}

		ctx2d.textBaseline = 'top';
		const labelY = plot.y + plot.h + 4;
		for (let i = 0; i < freqTicks.length; i++) {
			const hz = freqTicks[i];
			const x = freqToX(hz, plot);
			ctx2d.textAlign = i === 0 ? 'left' : i === freqTicks.length - 1 ? 'right' : 'center';
			ctx2d.fillText(formatHz(hz), x, labelY);
		}
	}

	/** @param {number} hz */
	function formatHz(hz) {
		if (hz >= 1000) return `${hz / 1000}k`;
		return String(hz);
	}

	/** @param {number} db */
	function formatDb(db) {
		if (db > 0) return `+${db}`;
		return String(db);
	}

	/**
	 * Canvas-only palettes (Waveform-style hex paints; not layout.css tokens).
	 *
	 * @param {import('#lib/player/eq-bands.js').EqTheme} theme
	 * @param {{ ink: string, muted: string, accent: string }} tokens
	 */
	function spectrumPalette(theme, tokens) {
		const { ink, muted, accent } = tokens;

		if (theme === 'winamp') {
			const curve = '#b8ff3c';
			return {
				grid: withAlpha('#6b7a3a', 0.28),
				gridMinor: withAlpha('#6b7a3a', 0.12),
				zero: withAlpha('#8a9a4a', 0.45),
				label: withAlpha('#6b7a3a', 0.95),
				curve,
				nodeActive: curve,
				nodeIdle: withAlpha('#6b7a3a', 0.85),
				nodeHalo: withAlpha(curve, 0.22),
				nodeHaloStroke: withAlpha(curve, 0.85),
				nodeStroke: withAlpha(ink, 0.45),
				nodeStrokeSelected: withAlpha(ink, 0.65),
				/** @param {number} v */
				bar: (v) => winampBarColor(v)
			};
		}

		if (theme === 'lcd') {
			const phosphor = '#39ff6a';
			return {
				grid: withAlpha('#3d5a45', 0.4),
				gridMinor: withAlpha('#3d5a45', 0.18),
				zero: withAlpha('#6a8570', 0.5),
				label: withAlpha('#3d5a45', 0.95),
				curve: phosphor,
				nodeActive: phosphor,
				nodeIdle: withAlpha('#5a7460', 0.85),
				nodeHalo: withAlpha(phosphor, 0.2),
				nodeHaloStroke: withAlpha(phosphor, 0.8),
				nodeStroke: withAlpha(ink, 0.45),
				nodeStrokeSelected: withAlpha(ink, 0.65),
				/** @param {number} v */
				bar: (v) => withAlpha(phosphor, 0.28 + v * 0.62)
			};
		}

		return {
			grid: withAlpha(ink, 0.12),
			gridMinor: withAlpha(ink, 0.06),
			zero: withAlpha(ink, 0.28),
			label: withAlpha(muted, 0.95),
			curve: accent,
			nodeActive: accent,
			nodeIdle: withAlpha(muted, 0.75),
			nodeHalo: withAlpha(accent, 0.22),
			nodeHaloStroke: withAlpha(accent, 0.85),
			nodeStroke: withAlpha(ink, 0.35),
			nodeStrokeSelected: withAlpha(ink, 0.55),
			/** @param {number} v */
			bar: (v) => withAlpha(accent, 0.22 + v * 0.45)
		};
	}

	/** Classic analyzer: green → yellow → orange → red by level. @param {number} v */
	function winampBarColor(v) {
		const t = Math.min(1, Math.max(0, v));
		if (t < 0.35) return lerpHex('#1f8f2e', '#7dcf2a', t / 0.35);
		if (t < 0.65) return lerpHex('#7dcf2a', '#e8d020', (t - 0.35) / 0.3);
		if (t < 0.85) return lerpHex('#e8d020', '#e87a14', (t - 0.65) / 0.2);
		return lerpHex('#e87a14', '#e02418', (t - 0.85) / 0.15);
	}

	/**
	 * @param {string} a
	 * @param {string} b
	 * @param {number} t
	 */
	function lerpHex(a, b, t) {
		const pa = hexRgb(a);
		const pb = hexRgb(b);
		if (!pa || !pb) return a;
		const u = Math.min(1, Math.max(0, t));
		const r = Math.round(pa.r + (pb.r - pa.r) * u);
		const g = Math.round(pa.g + (pb.g - pa.g) * u);
		const bl = Math.round(pa.b + (pb.b - pa.b) * u);
		return `rgb(${r},${g},${bl})`;
	}

	/** @param {string} color @returns {{ r: number, g: number, b: number } | null} */
	function hexRgb(color) {
		if (!color.startsWith('#')) return null;
		const hex = color.slice(1);
		const full =
			hex.length === 3
				? hex
						.split('')
						.map((c) => c + c)
						.join('')
				: hex.slice(0, 6);
		const r = parseInt(full.slice(0, 2), 16);
		const g = parseInt(full.slice(2, 4), 16);
		const b = parseInt(full.slice(4, 6), 16);
		if (![r, g, b].every((n) => Number.isFinite(n))) return null;
		return { r, g, b };
	}

	/**
	 * Dots: XY drag. Empty canvas: let the event bubble so the panel can move.
	 * @param {PointerEvent} event
	 */
	function onPointerDown(event) {
		if (!host || !canvas || event.button !== 0) return;
		const { x, y, plot } = localPoint(event);
		const hit = hitTest(x, y, plot);
		if (hit == null) {
			eq.selectNode(null);
			return;
		}
		eq.selectNode(hit);
		dragIndex = hit;
		host.setPointerCapture(event.pointerId);
		event.stopPropagation();
		event.preventDefault();
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onPointerMove(event) {
		if (dragIndex == null || !canvas) return;
		const { x, y, plot } = localPoint(event);
		eq.setNode(dragIndex, { hz: xToFreq(x, plot), gain: yToGain(y, plot) });
		event.stopPropagation();
		event.preventDefault();
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onPointerUp(event) {
		if (dragIndex == null) return;
		dragIndex = null;
		try {
			host?.releasePointerCapture(event.pointerId);
		} catch {
			// Capture already released.
		}
		event.stopPropagation();
	}

	/**
	 * @param {MouseEvent} event
	 */
	function onDblClick(event) {
		if (!canvas) return;
		const { x, y, plot } = localPoint(event);
		const hit = hitTest(x, y, plot);
		if (hit != null) {
			eq.setNode(hit, { gain: 0 });
			eq.selectNode(hit);
			event.preventDefault();
			return;
		}
		// Double-click the zero line to flatten the EQ.
		if (Math.abs(y - gainToY(0, plot)) <= 8) {
			eq.reset();
			event.preventDefault();
		}
	}

	/**
	 * @param {PointerEvent | MouseEvent} event
	 */
	function localPoint(event) {
		const el = canvas;
		if (!el) return { x: 0, y: 0, plot: plotRect(1, 1) };
		const rect = el.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
			plot: plotRect(rect.width, rect.height)
		};
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {PlotRect} plot
	 * @returns {number | null}
	 */
	function hitTest(x, y, plot) {
		let best = null;
		let bestDist = NODE_HIT_R;
		for (let i = 0; i < eq.nodes.length; i++) {
			const node = eq.nodes[i];
			const nx = freqToX(node.hz, plot);
			const ny = gainToY(node.gain, plot);
			const d = Math.hypot(x - nx, y - ny);
			if (d <= bestDist) {
				bestDist = d;
				best = i;
			}
		}
		return best;
	}

	/**
	 * @param {number} hz
	 * @param {PlotRect} plot
	 */
	function freqToX(hz, plot) {
		const t =
			(Math.log10(Math.min(EQ_FREQ_MAX, Math.max(EQ_FREQ_MIN, hz))) - Math.log10(EQ_FREQ_MIN)) /
			(Math.log10(EQ_FREQ_MAX) - Math.log10(EQ_FREQ_MIN));
		return plot.x + t * plot.w;
	}

	/**
	 * @param {number} x
	 * @param {PlotRect} plot
	 */
	function xToFreq(x, plot) {
		const t = Math.min(1, Math.max(0, (x - plot.x) / Math.max(1, plot.w)));
		return (
			10 ** (Math.log10(EQ_FREQ_MIN) + t * (Math.log10(EQ_FREQ_MAX) - Math.log10(EQ_FREQ_MIN)))
		);
	}

	/**
	 * @param {number} gain
	 * @param {PlotRect} plot
	 */
	function gainToY(gain, plot) {
		const clamped = Math.min(EQ_GAIN_MAX, Math.max(EQ_GAIN_MIN, gain));
		const pad = 2;
		return plot.y + plot.h / 2 - (clamped / EQ_GAIN_MAX) * (plot.h / 2 - pad);
	}

	/**
	 * @param {number} y
	 * @param {PlotRect} plot
	 */
	function yToGain(y, plot) {
		const pad = 2;
		const half = plot.h / 2 - pad;
		if (half <= 0) return 0;
		const mid = plot.y + plot.h / 2;
		return ((mid - y) / half) * EQ_GAIN_MAX;
	}

	/**
	 * @param {string} color
	 * @param {number} alpha
	 */
	function withAlpha(color, alpha) {
		if (color.startsWith('#')) {
			const hex = color.slice(1);
			const full =
				hex.length === 3
					? hex
							.split('')
							.map((c) => c + c)
							.join('')
					: hex.slice(0, 6);
			const r = parseInt(full.slice(0, 2), 16);
			const g = parseInt(full.slice(2, 4), 16);
			const b = parseInt(full.slice(4, 6), 16);
			if ([r, g, b].every((n) => Number.isFinite(n))) {
				return `rgba(${r},${g},${b},${alpha})`;
			}
		}
		return color;
	}
</script>

<div
	bind:this={host}
	class="spectrum-host"
	class:dragging={dragIndex != null}
	aria-label="Live frequency spectrum with EQ curve"
	role="application"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	ondblclick={onDblClick}
>
	<canvas bind:this={canvas} class="spectrum" aria-hidden="true"></canvas>
</div>

<style>
	.spectrum-host {
		width: 100%;
		height: 100%;
		min-height: 10.5rem;
		touch-action: none;
		/* Empty canvas moves the floating panel; dots capture their own drag. */
		cursor: grab;
		user-select: none;
	}

	.spectrum-host.dragging {
		cursor: grabbing;
	}

	.spectrum {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 10.5rem;
		border: 0;
		background: transparent;
	}
</style>
