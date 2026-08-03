import { browser } from '$app/env';
import { player } from '#lib/player/player.svelte.js';

const STORAGE_KEY = 'sndbnk:milkdrop';
/** Survives HMR so we never call createMediaElementSource twice on the same element. */
const GRAPH_KEY = 'sndbnk:audio-graph';
const DEFAULT_W = 480;
const DEFAULT_H = 360;
const MIN_W = 280;
const MIN_H = 200;
const TITLE_H = 32;

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
 */

/**
 * @returns {boolean}
 */
function detectSupport() {
	if (!browser) return false;
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl2');
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
 * Global Milkdrop visualizer. Owns the one-shot Web Audio graph and up to two
 * butterchurn instances: floating window (planet toggle) and hero backdrop.
 */
class Visualizer {
	enabled = $state(false);
	supported = $state(false);
	ready = $state(false);
	backdropReady = $state(false);
	x = $state(40);
	y = $state(80);
	w = $state(DEFAULT_W);
	h = $state(DEFAULT_H);

	/** @type {AudioContext | null} */
	#ctx = null;
	/** @type {MediaElementAudioSourceNode | null} */
	#source = null;
	/** Stable hub: source → output → destination (never rewired on toggle). */
	/** @type {GainNode | null} */
	#output = null;
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
	/** @type {(() => void) | null} */
	#onAudioReady = null;

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
		// Wire MediaElementSource as soon as the player creates <audio>, before play.
		this.#onAudioReady = () => this.#primeAudio();
		document.addEventListener('sndbnk:audio-ready', this.#onAudioReady);
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
			this.#primeAudio();
			this.enabled = true;
			return;
		}
		this.enabled = false;
		this.#teardownWindowButter();
		this.ready = false;
	}

	/** Synchronously wire the media-element source and kick off ctx.resume(). */
	#primeAudio() {
		const audioEl = player.getAudioElement();
		if (!audioEl) return;

		if (!this.#ctx) {
			const existing =
				/** @type {{ ctx: AudioContext, source: MediaElementAudioSourceNode, output: GainNode } | undefined} */ (
					globalThis[GRAPH_KEY]
				);
			if (existing?.ctx && existing?.source && existing?.output) {
				this.#ctx = existing.ctx;
				this.#source = existing.source;
				this.#output = existing.output;
			} else {
				const AC = window.AudioContext || window.webkitAudioContext;
				this.#ctx = new AC();
				this.#source = this.#ctx.createMediaElementSource(audioEl);
				this.#output = this.#ctx.createGain();
				this.#output.gain.value = 1;
				this.#source.connect(this.#output);
				this.#output.connect(this.#ctx.destination);
				globalThis[GRAPH_KEY] = {
					ctx: this.#ctx,
					source: this.#source,
					output: this.#output
				};
			}
		}

		if (this.#ctx.state === 'suspended') {
			void this.#ctx.resume();
		}
	}

	/**
	 * Bind a canvas and start rendering. Called from MilkdropWindow onMount.
	 * @param {HTMLCanvasElement} canvas
	 */
	async attach(canvas) {
		if (!browser || !this.supported || !this.enabled) return;
		const gen = ++this.#attachGen;
		this.#canvas = canvas;

		try {
			await this.#ensureGraph();
			if (gen !== this.#attachGen || !this.enabled) return;
			await this.#ensureWindowButter();
			if (gen !== this.#attachGen || !this.enabled) return;
			if (!this.#butter) throw new Error('butterchurn instance missing');
			this.#resizeWindow();
			this.#startLoop();
			this.ready = true;
		} catch (err) {
			console.error('Milkdrop visualizer failed to start', err);
			this.enabled = false;
			this.#teardownWindowButter();
			this.ready = false;
		}
	}

	detach() {
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
	 */
	setBounds(bounds) {
		if (!browser) return;
		const next = this.#clampBounds({
			x: bounds.x ?? this.x,
			y: bounds.y ?? this.y,
			w: bounds.w ?? this.w,
			h: bounds.h ?? this.h
		});
		this.x = next.x;
		this.y = next.y;
		this.w = next.w;
		this.h = next.h;
		this.#persistBounds();
		this.#resizeWindow();
	}

	nextPreset() {
		if (!this.#butter || this.#presetKeys.length === 0 || !this.#presets) return;
		this.#presetIndex = (this.#presetIndex + 1) % this.#presetKeys.length;
		const key = this.#presetKeys[this.#presetIndex];
		this.#butter.loadPreset(this.#presets[key], 1.5);
	}

	async #ensureGraph() {
		this.#primeAudio();
		if (!this.#ctx || !this.#source) throw new Error('No audio element');
		if (this.#ctx.state === 'suspended') {
			await this.#ctx.resume();
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

		const butterchurn = unwrapModule(butterMod);
		if (!butterchurn?.createVisualizer) {
			throw new Error('butterchurn.createVisualizer missing');
		}

		/** @type {Record<string, unknown>} */
		const presets = {};
		for (const mod of presetMods) {
			const pack = unwrapModule(mod);
			const next = typeof pack?.getPresets === 'function' ? pack.getPresets() : pack;
			if (next && typeof next === 'object') Object.assign(presets, next);
		}

		this.#butterchurn = butterchurn;
		this.#presets = presets;
		this.#presetKeys = Object.keys(this.#presets);
		if (this.#presetKeys.length === 0) throw new Error('No Milkdrop presets loaded');

		const mellow = MELLOW_PRESET_KEYS.filter((key) => key in this.#presets);
		this.#backdropPresetKeys = mellow.length > 0 ? mellow : this.#presetKeys;
	}

	async #ensureWindowButter() {
		if (!this.#canvas || !this.#ctx || !this.#output) {
			throw new Error('Audio graph not ready');
		}
		if (this.#butter) {
			// Re-bind after remount; connectAudio fans out and is safe to re-call.
			this.#butter.connectAudio(this.#output);
			return;
		}

		await this.#loadModules();
		const { width, height, pixelRatio } = this.#syncCanvasBuffer(this.#canvas, WINDOW_PIXEL_RATIO);
		this.#butter = this.#butterchurn.createVisualizer(this.#ctx, this.#canvas, {
			width,
			height,
			pixelRatio
		});
		// Tap the gain hub (not the raw MediaElementSource) so analysis shares
		// the same post-source node the speakers hear.
		this.#butter.connectAudio(this.#output);

		this.#presetIndex = Math.floor(Math.random() * this.#presetKeys.length);
		const key = this.#presetKeys[this.#presetIndex];
		this.#butter.loadPreset(this.#presets[key], 0);
	}

	async #ensureBackdropButter() {
		if (!this.#backdropCanvas || !this.#ctx || !this.#output) {
			throw new Error('Audio graph not ready');
		}
		if (this.#backdropButter) {
			this.#backdropButter.connectAudio(this.#output);
			return;
		}

		await this.#loadModules();
		// Size the drawing buffer before getContext — changing canvas.width later
		// loses the WebGL context, and butterchurn does not set it itself.
		const { width, height, pixelRatio } = this.#syncCanvasBuffer(
			this.#backdropCanvas,
			BACKDROP_PIXEL_RATIO
		);
		this.#backdropButter = this.#butterchurn.createVisualizer(this.#ctx, this.#backdropCanvas, {
			width,
			height,
			pixelRatio
		});
		this.#backdropButter.connectAudio(this.#output);

		this.#backdropPresetIndex = Math.floor(Math.random() * this.#backdropPresetKeys.length);
		const key = this.#backdropPresetKeys[this.#backdropPresetIndex];
		this.#backdropButter.loadPreset(this.#presets[key], 0);
	}

	#resizeWindow() {
		if (!this.#butter || !this.#canvas) return;
		const width = Math.max(1, this.#canvas.clientWidth);
		const height = Math.max(1, this.#canvas.clientHeight);
		this.#butter.setRendererSize(width, height);
	}

	#resizeBackdrop() {
		if (!this.#backdropButter || !this.#backdropCanvas) return;
		const width = Math.max(1, this.#backdropCanvas.clientWidth);
		const height = Math.max(1, this.#backdropCanvas.clientHeight);
		this.#backdropButter.setRendererSize(width, height);
	}

	/**
	 * Size the drawing buffer before `getContext`. Changing canvas.width after
	 * butterchurn owns the context loses WebGL — only call this pre-create.
	 * @param {HTMLCanvasElement} canvas
	 * @param {number} maxPixelRatio
	 * @returns {{ width: number, height: number, pixelRatio: number }}
	 */
	#syncCanvasBuffer(canvas, maxPixelRatio) {
		const width = Math.max(1, canvas.clientWidth);
		const height = Math.max(1, canvas.clientHeight);
		const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
		canvas.width = Math.max(1, Math.floor(width * pixelRatio));
		canvas.height = Math.max(1, Math.floor(height * pixelRatio));
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
			if (this.#ctx?.state === 'suspended') void this.#ctx.resume();
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
	 * @returns {VizBounds}
	 */
	#clampBounds(bounds) {
		const maxW = Math.max(MIN_W, window.innerWidth - 16);
		const maxH = Math.max(MIN_H, window.innerHeight - 16);
		const w = Math.min(Math.max(bounds.w, MIN_W), maxW);
		const h = Math.min(Math.max(bounds.h, MIN_H), maxH);
		const x = Math.min(Math.max(bounds.x, 0), Math.max(0, window.innerWidth - w));
		const y = Math.min(Math.max(bounds.y, 0), Math.max(0, window.innerHeight - h));
		return { x, y, w, h };
	}

	#persistBounds() {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ x: this.x, y: this.y, w: this.w, h: this.h })
			);
		} catch {
			// Storage full/unavailable: geometry just won't persist.
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
				return;
			}
			const parsed = JSON.parse(raw);
			const next = this.#clampBounds(isBounds(parsed) ? parsed : fallback);
			this.x = next.x;
			this.y = next.y;
			this.w = next.w;
			this.h = next.h;
		} catch {
			this.x = fallback.x;
			this.y = fallback.y;
			this.w = fallback.w;
			this.h = fallback.h;
		}
	}
}

/**
 * UMD builds sometimes nest `.default`.
 * @param {any} mod
 */
function unwrapModule(mod) {
	let cur = mod?.default ?? mod;
	if (
		cur?.default &&
		typeof cur.createVisualizer !== 'function' &&
		typeof cur.getPresets !== 'function'
	) {
		cur = cur.default;
	}
	return cur;
}

export const visualizer = new Visualizer();

/** Title bar height used by the floating window chrome. */
export const MILKDROP_TITLE_H = TITLE_H;
