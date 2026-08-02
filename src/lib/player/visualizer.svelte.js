import { browser } from '$app/env';
import { player } from '#lib/player/player.svelte.js';

const STORAGE_KEY = 'sndbnk:milkdrop';
const DEFAULT_W = 480;
const DEFAULT_H = 360;
const MIN_W = 280;
const MIN_H = 200;
const TITLE_H = 32;

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
 * Global Milkdrop visualizer. Owns the one-shot Web Audio graph and a butterchurn
 * instance that mounts into the floating window canvas while enabled.
 */
class Visualizer {
	enabled = $state(false);
	supported = $state(false);
	ready = $state(false);
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
	#butter = null;
	/** @type {Record<string, unknown> | null} */
	#presets = null;
	/** @type {string[]} */
	#presetKeys = [];
	#presetIndex = 0;
	/** @type {HTMLCanvasElement | null} */
	#canvas = null;
	#raf = 0;
	#attachGen = 0;
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
			} else if (this.enabled && this.#butter) {
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
		this.#teardownButter();
		this.ready = false;
	}

	/** Synchronously wire the media-element source and kick off ctx.resume(). */
	#primeAudio() {
		const audioEl = player.getAudioElement();
		if (!audioEl) return;

		if (!this.#ctx) {
			const AC = window.AudioContext || window.webkitAudioContext;
			this.#ctx = new AC();
			this.#source = this.#ctx.createMediaElementSource(audioEl);
			this.#output = this.#ctx.createGain();
			this.#output.gain.value = 1;
			this.#source.connect(this.#output);
			this.#output.connect(this.#ctx.destination);
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
			await this.#ensureButter();
			if (gen !== this.#attachGen || !this.enabled) return;
			if (!this.#butter) throw new Error('butterchurn instance missing');
			this.#resizeToCanvas();
			this.#startLoop();
			this.ready = true;
		} catch (err) {
			console.error('Milkdrop visualizer failed to start', err);
			this.enabled = false;
			this.#teardownButter();
			this.ready = false;
		}
	}

	detach() {
		this.#attachGen += 1;
		this.#teardownButter();
		this.#canvas = null;
		this.ready = false;
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
		this.#resizeToCanvas();
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

	async #ensureButter() {
		if (!this.#canvas || !this.#ctx || !this.#output) {
			throw new Error('Audio graph not ready');
		}
		if (this.#butter) {
			// Re-bind after remount; connectAudio fans out and is safe to re-call.
			this.#butter.connectAudio(this.#output);
			return;
		}

		const [butterMod, presetsMod] = await Promise.all([
			import('butterchurn'),
			import('butterchurn-presets/lib/butterchurnPresetsMinimal.min.js')
		]);

		const butterchurn = unwrapModule(butterMod);
		const presetsPack = unwrapModule(presetsMod);
		if (!butterchurn?.createVisualizer) {
			throw new Error('butterchurn.createVisualizer missing');
		}

		const presets =
			typeof presetsPack?.getPresets === 'function' ? presetsPack.getPresets() : presetsPack;
		this.#presets = /** @type {Record<string, unknown>} */ (presets);
		this.#presetKeys = Object.keys(this.#presets);
		if (this.#presetKeys.length === 0) throw new Error('No Milkdrop presets loaded');

		const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
		this.#butter = butterchurn.createVisualizer(this.#ctx, this.#canvas, {
			width: Math.max(1, this.#canvas.clientWidth),
			height: Math.max(1, this.#canvas.clientHeight),
			pixelRatio
		});
		// Tap the gain hub (not the raw MediaElementSource) so analysis shares
		// the same post-source node the speakers hear.
		this.#butter.connectAudio(this.#output);

		this.#presetIndex = Math.floor(Math.random() * this.#presetKeys.length);
		const key = this.#presetKeys[this.#presetIndex];
		this.#butter.loadPreset(this.#presets[key], 0);
	}

	#resizeToCanvas() {
		if (!this.#butter || !this.#canvas) return;
		const width = Math.max(1, this.#canvas.clientWidth);
		const height = Math.max(1, this.#canvas.clientHeight);
		this.#butter.setRendererSize(width, height);
	}

	#startLoop() {
		this.#stopLoop();
		const tick = () => {
			if (!this.#butter || !this.enabled) return;
			// Recover from Chrome auto-suspending the context while HTMLAudio plays.
			if (this.#ctx?.state === 'suspended') void this.#ctx.resume();
			this.#butter.render();
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
	 * Stop rendering and drop the WebGL instance. Leave the speaker graph alone —
	 * disconnecting fan-out taps can hitch playback.
	 */
	#teardownButter() {
		this.#stopLoop();
		this.#butter = null;
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
