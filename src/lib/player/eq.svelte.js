import { browser } from '$app/env';
import { audioGraph } from '#lib/player/audio-graph.svelte.js';
import {
	EQ_STORAGE_KEY,
	EQ_THEMES,
	clampGain,
	clampHz,
	clampQ,
	defaultNodes,
	isEqResolution,
	isEqTheme,
	parseStoredEq
} from '#lib/player/eq-bands.js';

/** @typedef {import('#lib/player/eq-bands.js').EqNode} EqNode */
/** @typedef {import('#lib/player/eq-bands.js').EqResolution} EqResolution */
/** @typedef {import('#lib/player/eq-bands.js').EqTheme} EqTheme */

/**
 * Global parametric EQ (4/8 peaking nodes). Owns BiquadFilters inserted into
 * `audioGraph`; UI reads `enabled` / `nodes` / `open` and calls methods.
 */
class Eq {
	enabled = $state(false);
	/** Panel visibility (independent of whether processing is on). */
	open = $state(false);
	/** @type {EqResolution} */
	resolution = $state(/** @type {EqResolution} */ (4));
	/** @type {EqNode[]} */
	nodes = $state(defaultNodes(4));
	/** Spectrum canvas palette. @type {EqTheme} */
	theme = $state(/** @type {EqTheme} */ ('default'));
	/** Selected node for Curve dial; not persisted. @type {number | null} */
	selectedIndex = $state(null);

	/** @type {BiquadFilterNode[]} */
	#filters = [];
	/** @type {(() => void) | null} */
	#onAudioReady = null;

	constructor() {
		if (!browser) return;
		this.#restore();
		this.#onAudioReady = () => this.#syncGraph();
		document.addEventListener('sndbnk:audio-ready', this.#onAudioReady);
	}

	toggleOpen() {
		this.setOpen(!this.open);
	}

	/**
	 * @param {boolean} next
	 */
	setOpen(next) {
		this.open = next;
		if (next) this.#arm();
		else this.selectedIndex = null;
	}

	/**
	 * @param {boolean} on
	 */
	setEnabled(on) {
		this.enabled = on;
		this.#arm();
		this.#persist();
	}

	toggleEnabled() {
		this.setEnabled(!this.enabled);
	}

	/**
	 * @param {EqTheme} next
	 */
	setTheme(next) {
		if (!isEqTheme(next) || next === this.theme) return;
		this.theme = next;
		this.#persist();
	}

	cycleTheme() {
		const i = EQ_THEMES.indexOf(this.theme);
		const next = EQ_THEMES[(i < 0 ? 0 : i + 1) % EQ_THEMES.length];
		this.theme = next;
		this.#persist();
	}

	/**
	 * @param {EqResolution} next
	 */
	setResolution(next) {
		if (!isEqResolution(next) || next === this.resolution) return;

		if (next < this.resolution) {
			this.nodes = this.nodes.slice(0, next).map((n) => ({ ...n }));
		} else {
			const extras = defaultNodes(8).slice(this.resolution);
			this.nodes = [...this.nodes.map((n) => ({ ...n })), ...extras];
		}

		this.resolution = next;
		if (this.selectedIndex != null && this.selectedIndex >= next) {
			this.selectedIndex = null;
		}
		this.#syncGraph();
		this.#persist();
	}

	/**
	 * @param {number | null} index
	 */
	selectNode(index) {
		if (index == null) {
			this.selectedIndex = null;
			return;
		}
		if (index < 0 || index >= this.nodes.length) return;
		this.selectedIndex = index;
	}

	/**
	 * @param {number} index
	 * @param {{ hz?: number, gain?: number, q?: number }} patch
	 */
	setNode(index, patch) {
		if (index < 0 || index >= this.nodes.length) return;
		const cur = this.nodes[index];
		const next = {
			hz: patch.hz !== undefined ? clampHz(patch.hz) : cur.hz,
			gain: patch.gain !== undefined ? clampGain(patch.gain) : cur.gain,
			q: patch.q !== undefined ? clampQ(patch.q) : cur.q
		};
		if (next.hz === cur.hz && next.gain === cur.gain && next.q === cur.q) return;
		const nodes = this.nodes.map((n, i) => (i === index ? next : n));
		this.nodes = nodes;
		this.#applyNodes();
		this.#persist();
	}

	reset() {
		this.nodes = defaultNodes(this.resolution);
		this.selectedIndex = null;
		this.#applyNodes();
		this.#persist();
	}

	/**
	 * Combined magnitude response of the *applied* filter chain (flat when disabled).
	 * @param {Float32Array} frequencyHz
	 * @returns {Float32Array} linear magnitude (multiply by 20*log10 for dB)
	 */
	getFrequencyResponse(frequencyHz) {
		const n = frequencyHz.length;
		const combined = new Float32Array(n);
		combined.fill(1);

		if (!this.#filters.length) return combined;

		const mag = new Float32Array(n);
		const phase = new Float32Array(n);
		for (const filter of this.#filters) {
			filter.getFrequencyResponse(frequencyHz, mag, phase);
			for (let i = 0; i < n; i++) combined[i] *= mag[i];
		}
		return combined;
	}

	#arm() {
		if (!audioGraph.ensure()) return;
		audioGraph.resume();
		this.#syncGraph();
	}

	#syncGraph() {
		if (!audioGraph.ensure()) return;
		const ctx = audioGraph.ctx;
		if (!ctx) return;

		if (this.#filters.length !== this.resolution) {
			this.#filters = Array.from({ length: this.resolution }, () => {
				const filter = ctx.createBiquadFilter();
				filter.type = 'peaking';
				filter.frequency.value = 1000;
				filter.Q.value = 1;
				filter.gain.value = 0;
				return filter;
			});
			audioGraph.setEqFilters(this.#filters);
		}

		this.#applyNodes();
	}

	#applyNodes() {
		for (let i = 0; i < this.#filters.length; i++) {
			const node = this.nodes[i];
			const filter = this.#filters[i];
			if (!node || !filter) continue;
			filter.frequency.value = node.hz;
			filter.Q.value = node.q;
			filter.gain.value = this.enabled ? node.gain : 0;
		}
	}

	#persist() {
		try {
			localStorage.setItem(
				EQ_STORAGE_KEY,
				JSON.stringify({
					enabled: this.enabled,
					resolution: this.resolution,
					nodes: this.nodes,
					theme: this.theme
				})
			);
		} catch {
			// Storage full/unavailable: prefs just won't persist.
		}
	}

	#restore() {
		try {
			const raw = localStorage.getItem(EQ_STORAGE_KEY);
			if (!raw) return;
			const parsed = parseStoredEq(JSON.parse(raw));
			if (!parsed) return;
			this.enabled = parsed.enabled;
			this.resolution = parsed.resolution;
			this.nodes = parsed.nodes;
			this.theme = parsed.theme;
		} catch {
			// Corrupt / unavailable storage — keep defaults.
		}
	}
}

export const eq = new Eq();
