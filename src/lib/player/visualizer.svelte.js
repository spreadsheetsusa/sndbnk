import { browser } from '$app/env';
import { audioGraph } from '#lib/player/audio-graph.svelte.js';
import { eq } from '#lib/player/eq.svelte.js';
import { dockKeyAt, stackDock } from '#lib/player/window-snap.js';

const STORAGE_KEY = 'sndbnk:milkdrop';
const DEFAULT_W = 480;
const DEFAULT_H = 360;
const MIN_W = 280;
const MIN_H = 200;
/** Pointer travel before dock dropzones / host highlights arm. */
const DOCK_DRAG_THRESHOLD_PX = 10;

/** Backdrop canvas opacity — dial here / via `--hero-viz-opacity`. */
export const HERO_VIZ_OPACITY = 0.45;
/** Paper veil over the canvas (0–1) — dial here / via `--hero-viz-veil`. */
export const HERO_VIZ_VEIL = 0.4;

const WINDOW_PIXEL_RATIO = 1.5;
const BACKDROP_PIXEL_RATIO = 1;
const BACKDROP_PRESET_BLEND_S = 3;
const BACKDROP_CYCLE_MS = 50_000;

/** Slower / softer presets for the hero ambient layer. Filtered against the pack at load. */
const MELLOW_PRESET_KEYS = [
	'Aderrasi - Potion of Spirits',
	'Aderrasi - Songflower (Moss Posy)',
	'Eo.S. + Zylot - skylight (Stained Glass Majesty mix)',
	'Flexi + Martin - astral projection',
	'Flexi + Martin - cascading decay swing',
	'Flexi - alien fish pond',
	'Flexi - truly soft piece of software - this is generic texturing (Jelly) ',
	'Geiss - Cauldron - painterly 2 (saturation remix)',
	'Geiss - Reaction Diffusion 2',
	'_Geiss - Desert Rose 2',
	'cope + martin - mother-of-pearl',
	'martin - angel flight',
	'martin - castle in the air',
	'martin - frosty caves 2',
	'martin - ghost city',
	'martin - reflections on black tiles',
	'yin - 191 - Temporal singularities',
	'Zylot - Paint Spill (Music Reactive Paint Mix)'
];

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} VizBounds
 * @typedef {'inline' | 'window'} VizMode
 */

/**
 * @returns {boolean}
 */
function detectSupport() {
	if (!browser) return false;
	try {
		const canvas = document.createElement('canvas');
		// Butterchurn uses WebGL1; accept either context.
		const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
		const hasAudio = Boolean(window.AudioContext || window.webkitAudioContext);
		return Boolean(gl) && hasAudio;
	} catch {
		return false;
	}
}

/**
 * @returns {VizBounds}
 */
function defaultBounds() {
	if (!browser) return { x: 40, y: 80, w: DEFAULT_W, h: DEFAULT_H };
	const w = Math.min(DEFAULT_W, window.innerWidth - 24);
	const h = Math.min(DEFAULT_H, window.innerHeight - 24);
	return {
		x: Math.max(12, window.innerWidth - w - 24),
		y: Math.max(12, window.innerHeight - h - 24),
		w,
		h
	};
}

/**
 * @param {unknown} value
 * @returns {value is VizBounds}
 */
function isBounds(value) {
	if (typeof value !== 'object' || value === null) return false;
	const b = /** @type {Record<string, unknown>} */ (value);
	return (
		typeof b.x === 'number' &&
		typeof b.y === 'number' &&
		typeof b.w === 'number' &&
		typeof b.h === 'number'
	);
}

/**
 * Global Milkdrop visualizer. Uses the shared `audioGraph` output hub and owns
 * up to two butterchurn instances: primary surface (inline / floating) and
 * hero backdrop.
 */
class Visualizer {
	enabled = $state(false);
	supported = $state(false);
	ready = $state(false);
	backdropReady = $state(false);
	/** Last primary-surface attach failure (shown in the panel; does not auto-close). */
	error = $state(/** @type {string | null} */ (null));
	/** @type {VizMode} */
	mode = $state('window');
	x = $state(40);
	y = $state(80);
	w = $state(DEFAULT_W);
	h = $state(DEFAULT_H);
	/** True while the floating window is being dragged (for dock dropzone highlight). */
	draggingWindow = $state(false);
	/** `data-viz-dock` key under the pointer while dragging, else null. */
	dockHotKey = $state(/** @type {string | null} */ (null));
	/** True while the pointer is over a registered sidebar dock slot (preview snap). */
	dockHover = $state(false);

	/** Inline hosts (feed/library/profile/track) when planet is on and mode is inline. */
	get showInline() {
		return this.enabled && this.mode === 'inline' && this.supported;
	}

	/** Floating window when planet is on and mode is window. */
	get showWindow() {
		return this.enabled && this.mode === 'window' && this.supported;
	}

	/** @type {HTMLElement | null} */
	#dockSlot = null;
	/** @type {VizBounds | null} */
	#preDockBounds = null;
	/** @type {number | null} */
	#dragOriginX = null;
	/** @type {number | null} */
	#dragOriginY = null;

	/** @type {any} */
	#butterchurn = null;
	/** @type {any} */
	#butter = null;
	/** @type {any} */
	#backdropButter = null;
	/** @type {Record<string, unknown> | null} */
	#presets = null;
	/** @type {string[]} */
	#presetKeys = [];
	#presetIndex = 0;
	/** @type {string[]} */
	#backdropPresetKeys = [];
	#backdropPresetIndex = 0;
	/** @type {HTMLCanvasElement | null} */
	#canvas = null;
	/** @type {HTMLCanvasElement | null} */
	#backdropCanvas = null;
	#raf = 0;
	#attachGen = 0;
	#backdropAttachGen = 0;
	#backdropCycleTimer = 0;
	/** @type {(() => void) | null} */
	#onVisibility = null;

	constructor() {
		if (!browser) return;
		this.supported = detectSupport();
		this.#restoreBounds();
		this.#onVisibility = () => {
			if (document.visibilityState === 'hidden') {
				this.#stopLoop();
			} else if (this.#hasActiveRenderer()) {
				this.#startLoop();
			}
		};
		document.addEventListener('visibilitychange', this.#onVisibility);
		// Warm the shared graph as soon as the player creates <audio>.
		document.addEventListener('sndbnk:audio-ready', () => {
			audioGraph.ensure();
		});
	}

	toggle() {
		void this.setEnabled(!this.enabled);
	}

	/**
	 * @param {boolean} on
	 */
	async setEnabled(on) {
		if (!browser || !this.supported) return;
		if (on === this.enabled) return;
		if (on) {
			// Resume only — never rewire the speaker path on toggle.
			audioGraph.ensure();
			audioGraph.resume();
			this.error = null;
			this.enabled = true;
			if (this.mode === 'window') this.spawnDocked();
			return;
		}
		this.enabled = false;
		this.error = null;
		this.setWindowDragging(false);
		this.#teardownWindowButter();
		this.ready = false;
	}

	/**
	 * @param {VizMode} next
	 */
	setMode(next) {
		if (!browser || !this.supported) return;
		if (next !== 'inline' && next !== 'window') return;
		if (next === this.mode) return;
		this.mode = next;
		this.#persistPrefs();
	}

	popOut() {
		if (this.mode !== 'window') this.setMode('window');
		this.spawnDocked();
	}

	dock() {
		this.setWindowDragging(false);
		this.setMode('inline');
	}

	/**
	 * Place the floating window under the player strip (or under a strip-snapped EQ),
	 * matching the strip width. EQ uses the inverse: under a strip-snapped viz.
	 */
	spawnDocked() {
		if (!browser) return;
		const dock = stackDock({ eqOpen: eq.open });
		if (!dock) {
			this.setBounds({ ...defaultBounds(), h: DEFAULT_H });
			return;
		}
		this.setBounds({ x: dock.x, y: dock.y, w: dock.w, h: DEFAULT_H });
	}

	/**
	 * @param {HTMLElement | null} el
	 */
	registerDockSlot(el) {
		this.#dockSlot = el;
	}

	/**
	 * @param {HTMLElement | null} [el]
	 */
	unregisterDockSlot(el = null) {
		if (el && this.#dockSlot !== el) return;
		this.#dockSlot = null;
		if (this.dockHover) this.#exitDockPreview(true);
	}

	/**
	 * Start a floating-window drag; drop-zones arm after DOCK_DRAG_THRESHOLD_PX.
	 * @param {number} clientX
	 * @param {number} clientY
	 */
	beginWindowDrag(clientX, clientY) {
		this.#dragOriginX = clientX;
		this.#dragOriginY = clientY;
	}

	/**
	 * Update dock hit-test / preview while dragging.
	 * @param {number} clientX
	 * @param {number} clientY
	 */
	updateWindowDrag(clientX, clientY) {
		if (this.#dragOriginX == null || this.#dragOriginY == null) return;
		if (!this.draggingWindow) {
			const dx = clientX - this.#dragOriginX;
			const dy = clientY - this.#dragOriginY;
			if (Math.hypot(dx, dy) < DOCK_DRAG_THRESHOLD_PX) return;
			this.draggingWindow = true;
		}
		this.#syncDockHover(clientX, clientY);
	}

	/**
	 * End drag: dock to inline when over a slot or any `[data-viz-dock]` host.
	 * @param {number} clientX
	 * @param {number} clientY
	 */
	endWindowDrag(clientX, clientY) {
		if (!this.draggingWindow) {
			this.#clearWindowDrag();
			return;
		}
		const overSlot = this.#pointerOverDockSlot(clientX, clientY);
		const hotKey = dockKeyAt(clientX, clientY);
		const shouldDock = this.dockHover || overSlot || Boolean(hotKey);
		this.#exitDockPreview(false);
		this.#clearWindowDrag();
		if (shouldDock) {
			this.dock();
			return;
		}
		this.#persistPrefs();
	}

	/**
	 * @param {boolean} on
	 */
	setWindowDragging(on) {
		if (!on) {
			this.#exitDockPreview(true);
			this.#clearWindowDrag();
			return;
		}
		this.draggingWindow = true;
	}

	#clearWindowDrag() {
		this.draggingWindow = false;
		this.dockHotKey = null;
		this.#dragOriginX = null;
		this.#dragOriginY = null;
	}

	/**
	 * @param {number} clientX
	 * @param {number} clientY
	 */
	#syncDockHover(clientX, clientY) {
		this.dockHotKey = dockKeyAt(clientX, clientY);
		const overSlot = this.#pointerOverDockSlot(clientX, clientY);
		if (overSlot && !this.dockHover) {
			this.#preDockBounds = { x: this.x, y: this.y, w: this.w, h: this.h };
			this.dockHover = true;
			// Next frame so `.dock-preview` transition is active before bounds change.
			requestAnimationFrame(() => {
				if (this.dockHover) this.#applyDockPreview();
			});
			return;
		}
		if (!overSlot && this.dockHover) {
			// Restore free size; caller reapplies position on the same move frame.
			this.#exitDockPreview(true);
		}
	}

	/**
	 * @param {number} clientX
	 * @param {number} clientY
	 * @returns {boolean}
	 */
	#pointerOverDockSlot(clientX, clientY) {
		const el = this.#dockSlot;
		if (!el) return false;
		const r = el.getBoundingClientRect();
		return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
	}

	#applyDockPreview() {
		const el = this.#dockSlot;
		if (!el) return;
		const r = el.getBoundingClientRect();
		this.setBounds(
			{ x: r.left, y: r.top, w: r.width, h: r.height },
			{ persist: false, relaxMin: true }
		);
	}

	/**
	 * @param {boolean} restore
	 */
	#exitDockPreview(restore) {
		if (!this.dockHover && !this.#preDockBounds) return;
		const prev = this.#preDockBounds;
		this.dockHover = false;
		this.#preDockBounds = null;
		if (restore && prev) this.setBounds(prev, { persist: false });
	}

	/** Re-measure the primary canvas after the host layout changes. */
	resize() {
		this.#resizeWindow();
	}

	/**
	 * Bind a canvas and start rendering. Called from MilkdropWindow / InlineMilkdrop.
	 * Drops any previous primary renderer first so popout/dock can race outros safely.
	 * @param {HTMLCanvasElement} canvas
	 */
	async attach(canvas) {
		if (!browser || !this.supported || !this.enabled) return;
		const gen = ++this.#attachGen;
		this.#teardownWindowButter();
		this.#canvas = canvas;
		this.ready = false;
		this.error = null;

		try {
			await this.#ensureGraph();
			if (gen !== this.#attachGen || !this.enabled || this.#canvas !== canvas) return;
			await this.#waitForCanvasLayout(canvas, gen);
			if (gen !== this.#attachGen || !this.enabled || this.#canvas !== canvas) return;
			await this.#ensureWindowButter();
			if (gen !== this.#attachGen || !this.enabled || this.#canvas !== canvas) return;
			if (!this.#butter) throw new Error('butterchurn instance missing');
			this.#resizeWindow();
			this.#startLoop();
			this.ready = true;
			this.error = null;
		} catch (err) {
			console.error('Milkdrop visualizer failed to start', err);
			// Keep the panel open with an error — auto-disabling looked like a flicker.
			this.#teardownWindowButter();
			this.ready = false;
			this.error = err instanceof Error ? err.message : 'Visualizer failed to start';
		}
	}

	/**
	 * @param {HTMLCanvasElement} [canvas] Only tear down if still bound to this canvas.
	 */
	detach(canvas) {
		if (canvas && this.#canvas !== canvas) return;
		this.#attachGen += 1;
		this.#teardownWindowButter();
		this.#canvas = null;
		this.ready = false;
	}

	/**
	 * Bind the hero ambient canvas. Independent of the floating-window toggle.
	 * @param {HTMLCanvasElement} canvas
	 */
	async attachBackdrop(canvas) {
		if (!browser || !this.supported) return;
		const gen = ++this.#backdropAttachGen;
		this.#backdropCanvas = canvas;

		try {
			await this.#ensureGraph();
			if (gen !== this.#backdropAttachGen) return;
			await this.#ensureBackdropButter();
			if (gen !== this.#backdropAttachGen) return;
			if (!this.#backdropButter) throw new Error('backdrop butterchurn missing');
			this.#resizeBackdrop();
			this.#startBackdropCycle();
			this.#startLoop();
			this.backdropReady = true;
		} catch (err) {
			console.error('Hero Milkdrop backdrop failed to start', err);
			this.#teardownBackdropButter();
		}
	}

	detachBackdrop() {
		this.#backdropAttachGen += 1;
		this.#teardownBackdropButter();
	}

	resizeBackdrop() {
		this.#resizeBackdrop();
	}

	/**
	 * @param {Partial<VizBounds>} bounds
	 * @param {{ persist?: boolean, relaxMin?: boolean }} [opts]
	 */
	setBounds(bounds, opts = {}) {
		if (!browser) return;
		const persist = opts.persist !== false;
		const next = this.#clampBounds(
			{
				x: bounds.x ?? this.x,
				y: bounds.y ?? this.y,
				w: bounds.w ?? this.w,
				h: bounds.h ?? this.h
			},
			{ relaxMin: Boolean(opts.relaxMin) }
		);
		this.x = next.x;
		this.y = next.y;
		this.w = next.w;
		this.h = next.h;
		if (persist && !this.dockHover) this.#persistPrefs();
		this.#resizeWindow();
	}

	nextPreset() {
		if (!this.#butter || this.#presetKeys.length === 0 || !this.#presets) return;
		this.#presetIndex = (this.#presetIndex + 1) % this.#presetKeys.length;
		const key = this.#presetKeys[this.#presetIndex];
		this.#butter.loadPreset(this.#presets[key], 1.5);
	}

	async #ensureGraph() {
		if (!audioGraph.ensure()) throw new Error('No audio element');
		const ctx = audioGraph.ctx;
		if (!ctx) throw new Error('No audio context');
		if (ctx.state === 'suspended') {
			await ctx.resume();
		}
	}

	async #loadModules() {
		if (this.#butterchurn && this.#presets) return;

		// Static import() paths so Vite can code-split; merge all packs (~395 unique).
		const [butterMod, ...presetMods] = await Promise.all([
			import('butterchurn'),
			import('butterchurn-presets/lib/butterchurnPresets.min.js'),
			import('butterchurn-presets/lib/butterchurnPresetsExtra.min.js'),
			import('butterchurn-presets/lib/butterchurnPresetsExtra2.min.js'),
			import('butterchurn-presets/lib/butterchurnPresetsMD1.min.js')
		]);

		const butterchurn = unwrapButterchurn(butterMod);
		if (typeof butterchurn?.createVisualizer !== 'function') {
			throw new Error('butterchurn.createVisualizer missing');
		}

		/** @type {Record<string, unknown>} */
		const presets = {};
		for (const mod of presetMods) {
			const next = unwrapPresets(mod);
			if (next) Object.assign(presets, next);
		}

		this.#butterchurn = butterchurn;
		this.#presets = presets;
		this.#presetKeys = Object.keys(this.#presets);
		if (this.#presetKeys.length === 0) throw new Error('No Milkdrop presets loaded');

		const mellow = MELLOW_PRESET_KEYS.filter((key) => key in this.#presets);
		this.#backdropPresetKeys = mellow.length > 0 ? mellow : this.#presetKeys;
	}

	/**
	 * Panel intros animate height from 0 — wait until the canvas has a real layout
	 * box so WebGL init isn't racing the enter transition.
	 * @param {HTMLCanvasElement} canvas
	 * @param {number} gen
	 */
	async #waitForCanvasLayout(canvas, gen) {
		if (canvas.clientWidth > 0 && canvas.clientHeight > 0) return;

		await new Promise((resolve) => {
			const done = () => {
				ro.disconnect();
				resolve(undefined);
			};
			const ro = new ResizeObserver(() => {
				if (canvas.clientWidth > 0 && canvas.clientHeight > 0) done();
			});
			ro.observe(canvas);
			// Cap wait so a permanently-hidden host still fails clearly.
			window.setTimeout(done, 800);
		});

		if (gen !== this.#attachGen || this.#canvas !== canvas) return;
		if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) {
			throw new Error('Visualizer canvas has no layout size');
		}
	}

	async #ensureWindowButter() {
		const ctx = audioGraph.ctx;
		const output = audioGraph.output;
		if (!this.#canvas || !ctx || !output) {
			throw new Error('Audio graph not ready');
		}
		if (this.#butter) {
			// Re-bind after remount; connectAudio fans out and is safe to re-call.
			this.#butter.connectAudio(output);
			return;
		}

		await this.#loadModules();
		const { width, height, pixelRatio } = this.#syncCanvasBuffer(this.#canvas, WINDOW_PIXEL_RATIO);
		this.#butter = this.#butterchurn.createVisualizer(ctx, this.#canvas, {
			width,
			height,
			pixelRatio
		});
		// Tap the gain hub so analysis shares the same post-EQ node the speakers hear.
		this.#butter.connectAudio(output);

		this.#presetIndex = Math.floor(Math.random() * this.#presetKeys.length);
		const key = this.#presetKeys[this.#presetIndex];
		this.#butter.loadPreset(this.#presets[key], 0);
	}

	async #ensureBackdropButter() {
		const ctx = audioGraph.ctx;
		const output = audioGraph.output;
		if (!this.#backdropCanvas || !ctx || !output) {
			throw new Error('Audio graph not ready');
		}
		if (this.#backdropButter) {
			this.#backdropButter.connectAudio(output);
			return;
		}

		await this.#loadModules();
		// Size the drawing buffer before getContext — changing canvas.width later
		// loses the WebGL context, and butterchurn does not set it itself.
		const { width, height, pixelRatio } = this.#syncCanvasBuffer(
			this.#backdropCanvas,
			BACKDROP_PIXEL_RATIO
		);
		this.#backdropButter = this.#butterchurn.createVisualizer(ctx, this.#backdropCanvas, {
			width,
			height,
			pixelRatio
		});
		this.#backdropButter.connectAudio(output);

		this.#backdropPresetIndex = Math.floor(Math.random() * this.#backdropPresetKeys.length);
		const key = this.#backdropPresetKeys[this.#backdropPresetIndex];
		this.#backdropButter.loadPreset(this.#presets[key], 0);
	}

	#resizeWindow() {
		if (!this.#butter || !this.#canvas) return;
		const { width, height } = this.#syncCanvasBuffer(this.#canvas, WINDOW_PIXEL_RATIO);
		this.#butter.setRendererSize(width, height);
	}

	#resizeBackdrop() {
		if (!this.#backdropButter || !this.#backdropCanvas) return;
		const { width, height } = this.#syncCanvasBuffer(this.#backdropCanvas, BACKDROP_PIXEL_RATIO);
		this.#backdropButter.setRendererSize(width, height);
	}

	/**
	 * Match the drawing buffer to CSS client size. Butterchurn's screen blit
	 * uses logical width×height as the WebGL viewport; pixelRatio only sizes
	 * internal FBOs. Setting attrs after create clears the default framebuffer
	 * but keeps the context — pair with setRendererSize.
	 * @param {HTMLCanvasElement} canvas
	 * @param {number} maxPixelRatio
	 * @returns {{ width: number, height: number, pixelRatio: number }}
	 */
	#syncCanvasBuffer(canvas, maxPixelRatio) {
		const width = Math.max(1, Math.floor(canvas.clientWidth));
		const height = Math.max(1, Math.floor(canvas.clientHeight));
		const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		return { width, height, pixelRatio };
	}

	#hasActiveRenderer() {
		return Boolean((this.enabled && this.#butter) || this.#backdropButter);
	}

	#startLoop() {
		this.#stopLoop();
		const tick = () => {
			const win = this.enabled && this.#butter;
			const back = this.#backdropButter;
			if (!win && !back) {
				this.#raf = 0;
				return;
			}
			// Recover from Chrome auto-suspending the context while HTMLAudio plays.
			audioGraph.resume();
			if (win) this.#butter.render();
			if (back) this.#backdropButter.render();
			this.#raf = requestAnimationFrame(tick);
		};
		this.#raf = requestAnimationFrame(tick);
	}

	#stopLoop() {
		if (this.#raf) {
			cancelAnimationFrame(this.#raf);
			this.#raf = 0;
		}
	}

	/**
	 * Stop floating-window WebGL. Leave the speaker graph (and backdrop) alone.
	 */
	#teardownWindowButter() {
		this.#butter = null;
		if (!this.#backdropButter) this.#stopLoop();
	}

	/**
	 * Stop hero-backdrop WebGL. Leave the speaker graph (and floating window) alone.
	 */
	#teardownBackdropButter() {
		this.#stopBackdropCycle();
		this.#backdropButter = null;
		this.#backdropCanvas = null;
		this.backdropReady = false;
		if (!this.#butter) this.#stopLoop();
	}

	#startBackdropCycle() {
		this.#stopBackdropCycle();
		if (this.#backdropPresetKeys.length < 2) return;
		this.#backdropCycleTimer = window.setInterval(() => {
			this.#nextBackdropPreset();
		}, BACKDROP_CYCLE_MS);
	}

	#stopBackdropCycle() {
		if (this.#backdropCycleTimer) {
			clearInterval(this.#backdropCycleTimer);
			this.#backdropCycleTimer = 0;
		}
	}

	#nextBackdropPreset() {
		if (!this.#backdropButter || this.#backdropPresetKeys.length === 0 || !this.#presets) return;
		this.#backdropPresetIndex = (this.#backdropPresetIndex + 1) % this.#backdropPresetKeys.length;
		const key = this.#backdropPresetKeys[this.#backdropPresetIndex];
		this.#backdropButter.loadPreset(this.#presets[key], BACKDROP_PRESET_BLEND_S);
	}

	/**
	 * @param {VizBounds} bounds
	 * @param {{ relaxMin?: boolean }} [opts]
	 * @returns {VizBounds}
	 */
	#clampBounds(bounds, opts = {}) {
		const minW = opts.relaxMin ? 1 : MIN_W;
		const minH = opts.relaxMin ? 1 : MIN_H;
		const maxW = Math.max(minW, window.innerWidth - 16);
		const maxH = Math.max(minH, window.innerHeight - 16);
		const w = Math.min(Math.max(bounds.w, minW), maxW);
		const h = Math.min(Math.max(bounds.h, minH), maxH);
		const x = Math.min(Math.max(bounds.x, 0), Math.max(0, window.innerWidth - w));
		const y = Math.min(Math.max(bounds.y, 0), Math.max(0, window.innerHeight - h));
		return { x, y, w, h };
	}

	#persistPrefs() {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ x: this.x, y: this.y, w: this.w, h: this.h, mode: this.mode })
			);
		} catch {
			// Storage full/unavailable: prefs just won't persist.
		}
	}

	#restoreBounds() {
		const fallback = defaultBounds();
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) {
				this.x = fallback.x;
				this.y = fallback.y;
				this.w = fallback.w;
				this.h = fallback.h;
				this.mode = 'window';
				return;
			}
			const parsed = JSON.parse(raw);
			const next = this.#clampBounds(isBounds(parsed) ? parsed : fallback);
			this.x = next.x;
			this.y = next.y;
			this.w = next.w;
			this.h = next.h;
			const savedMode =
				parsed && typeof parsed === 'object' && 'mode' in parsed
					? /** @type {{ mode?: unknown }} */ (parsed).mode
					: null;
			this.mode = savedMode === 'inline' ? 'inline' : 'window';
		} catch {
			this.x = fallback.x;
			this.y = fallback.y;
			this.w = fallback.w;
			this.h = fallback.h;
			this.mode = 'window';
		}
	}
}

/**
 * Rolldown/Vite wrap butterchurn's UMD as nested `{ default: … }` (sometimes
 * more than once) and occasionally as a constructor with static methods.
 * @param {any} mod
 * @returns {any}
 */
function unwrapButterchurn(mod) {
	let cur = mod;
	for (let i = 0; i < 6 && cur; i++) {
		if (typeof cur.createVisualizer === 'function') return cur;
		if (cur.butterchurn && typeof cur.butterchurn.createVisualizer === 'function') {
			return cur.butterchurn;
		}
		if (cur.default) {
			cur = cur.default;
			continue;
		}
		break;
	}
	return cur;
}

/**
 * @param {any} mod
 * @returns {Record<string, unknown> | null}
 */
function unwrapPresets(mod) {
	let cur = mod;
	for (let i = 0; i < 6 && cur; i++) {
		if (typeof cur.getPresets === 'function') {
			const next = cur.getPresets();
			return next && typeof next === 'object'
				? /** @type {Record<string, unknown>} */ (next)
				: null;
		}
		if (cur && typeof cur === 'object' && !cur.default && !cur.butterchurnPresets) {
			// Already a preset map (keys → preset objects).
			const keys = Object.keys(cur);
			if (keys.length > 0 && typeof cur[keys[0]] === 'object') {
				return /** @type {Record<string, unknown>} */ (cur);
			}
		}
		if (cur.butterchurnPresets) {
			cur = cur.butterchurnPresets;
			continue;
		}
		if (cur.default) {
			cur = cur.default;
			continue;
		}
		break;
	}
	return null;
}

export const visualizer = new Visualizer();
