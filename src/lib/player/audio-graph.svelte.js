import { browser } from '$app/env';
import { player } from '#lib/player/player.svelte.js';

/**
 * Survives HMR so we never call createMediaElementSource twice on the same element.
 * Shape: `{ ctx, source, analyser, output }`.
 */
const GRAPH_KEY = 'sndbnk:audio-graph';
const VOLUME_KEY = 'sndbnk:volume';

/**
 * Shared Web Audio graph for playback taps (EQ, Milkdrop).
 *
 * Chain: MediaElementSource → [EQ filters] → Analyser → Gain(output) → destination
 * Butterchurn and other consumers tap `output` so they hear post-EQ audio.
 */
class AudioGraph {
	ready = $state(false);
	/**
	 * Reactive mirror of master level for UI that isn't dragging.
	 * Live drags use `#volume` + `setVolumeLive` so they don't invalidate the page.
	 */
	volume = $state(1);

	/** @type {AudioContext | null} */
	#ctx = null;
	/** @type {MediaElementAudioSourceNode | null} */
	#source = null;
	/** @type {AnalyserNode | null} */
	#analyser = null;
	/** Stable hub: never rewired away from destination. @type {GainNode | null} */
	#output = null;
	/** @type {BiquadFilterNode[]} */
	#eqFilters = [];
	/** Live gain target 0–1 (source of truth while dragging). */
	#volume = 1;

	constructor() {
		if (!browser) return;
		this.#restoreVolume();
		document.addEventListener('sndbnk:audio-ready', () => {
			this.ensure();
		});
	}

	/** Non-reactive read for RAF meters — does not subscribe. */
	getVolume() {
		return this.#volume;
	}

	/**
	 * Apply gain immediately without reactive invalidation or persistence.
	 * @param {number} next
	 */
	setVolumeLive(next) {
		const v = clampVolume(next);
		if (v === this.#volume) {
			this.#applyVolume();
			return;
		}
		this.#volume = v;
		this.#applyVolume();
	}

	/**
	 * Commit live level into reactive `volume` + localStorage (pointer-up / keys).
	 */
	commitVolume() {
		if (this.volume !== this.#volume) this.volume = this.#volume;
		this.#persistVolume();
	}

	/**
	 * Set + commit in one step (keyboard / non-drag).
	 * @param {number} next
	 */
	setVolume(next) {
		this.setVolumeLive(next);
		this.commitVolume();
	}

	/** @returns {AudioContext | null} */
	get ctx() {
		return this.#ctx;
	}

	/** @returns {GainNode | null} */
	get output() {
		return this.#output;
	}

	/** @returns {AnalyserNode | null} */
	get analyser() {
		return this.#analyser;
	}

	/**
	 * Create or restore the graph. Safe to call repeatedly.
	 * @returns {boolean}
	 */
	ensure() {
		if (!browser) return false;
		const audioEl = player.getAudioElement();
		if (!audioEl) return false;

		if (!this.#ctx) {
			const existing =
				/** @type {{
				 *   ctx?: AudioContext,
				 *   source?: MediaElementAudioSourceNode,
				 *   analyser?: AnalyserNode,
				 *   output?: GainNode
				 * } | undefined} */ (globalThis[GRAPH_KEY]);

			if (existing?.ctx && existing?.source && existing?.output) {
				this.#ctx = existing.ctx;
				this.#source = existing.source;
				this.#output = existing.output;
				if (existing.analyser) {
					this.#analyser = existing.analyser;
				} else {
					// Upgrade pre-EQ HMR graphs: source → output → source → analyser → output.
					this.#source.disconnect();
					this.#analyser = this.#ctx.createAnalyser();
					this.#configureAnalyser(this.#analyser);
					this.#source.connect(this.#analyser);
					this.#analyser.connect(this.#output);
					globalThis[GRAPH_KEY] = {
						ctx: this.#ctx,
						source: this.#source,
						analyser: this.#analyser,
						output: this.#output
					};
				}
			} else {
				const AC = window.AudioContext || window.webkitAudioContext;
				this.#ctx = new AC();
				this.#source = this.#ctx.createMediaElementSource(audioEl);
				this.#analyser = this.#ctx.createAnalyser();
				this.#configureAnalyser(this.#analyser);
				this.#output = this.#ctx.createGain();
				this.#source.connect(this.#analyser);
				this.#analyser.connect(this.#output);
				this.#output.connect(this.#ctx.destination);
				globalThis[GRAPH_KEY] = {
					ctx: this.#ctx,
					source: this.#source,
					analyser: this.#analyser,
					output: this.#output
				};
			}
		}

		this.#applyVolume();
		this.ready = Boolean(this.#ctx && this.#source && this.#analyser && this.#output);
		this.resume();
		return this.ready;
	}

	resume() {
		if (this.#ctx?.state === 'suspended') {
			void this.#ctx.resume();
		}
	}

	/**
	 * Insert or replace the EQ peaking-filter chain between source and analyser.
	 * Pass an empty array for a flat path (source → analyser).
	 * @param {BiquadFilterNode[]} filters
	 */
	setEqFilters(filters) {
		if (!this.ensure() || !this.#source || !this.#analyser || !this.#output) return;

		this.#source.disconnect();
		for (const node of this.#eqFilters) {
			try {
				node.disconnect();
			} catch {
				// Already disconnected.
			}
		}
		try {
			this.#analyser.disconnect();
		} catch {
			// Already disconnected.
		}

		this.#eqFilters = filters;

		/** @type {AudioNode} */
		let prev = this.#source;
		for (const node of filters) {
			prev.connect(node);
			prev = node;
		}
		prev.connect(this.#analyser);
		this.#analyser.connect(this.#output);
	}

	/** @param {AnalyserNode} analyser */
	#configureAnalyser(analyser) {
		analyser.fftSize = 2048;
		analyser.smoothingTimeConstant = 0.75;
		analyser.minDecibels = -90;
		analyser.maxDecibels = -10;
	}

	#applyVolume() {
		if (this.#output) this.#output.gain.value = this.#volume;
	}

	#persistVolume() {
		try {
			localStorage.setItem(VOLUME_KEY, String(this.#volume));
		} catch {
			// Storage full/unavailable: prefs just won't persist.
		}
	}

	#restoreVolume() {
		try {
			const raw = localStorage.getItem(VOLUME_KEY);
			if (raw == null) return;
			const n = Number(raw);
			if (!Number.isFinite(n)) return;
			this.#volume = clampVolume(n);
			this.volume = this.#volume;
		} catch {
			// Corrupt / unavailable storage — keep default.
		}
	}
}

/**
 * @param {number} value
 * @returns {number}
 */
function clampVolume(value) {
	if (!Number.isFinite(value)) return 1;
	return Math.min(1, Math.max(0, value));
}

export const audioGraph = new AudioGraph();
