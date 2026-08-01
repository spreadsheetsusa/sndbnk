<script>
	import { get } from 'svelte/store';
	import { customAccent, normalizeHex, setCustomAccent } from '#lib/stores/brand.js';

	/**
	 * @param {number} h hue in degrees
	 * @param {number} s saturation 0-1
	 * @param {number} v value 0-1
	 * @returns {string}
	 */
	function hsvToHex(h, s, v) {
		/** @param {number} n */
		const channel = (n) => {
			const k = (n + h / 60) % 6;
			return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
				.toString(16)
				.padStart(2, '0');
		};

		return `#${channel(5)}${channel(3)}${channel(1)}`;
	}

	/**
	 * @param {string} hex
	 * @returns {{ h: number, s: number, v: number }}
	 */
	function hexToHsv(hex) {
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
		const max = Math.max(r, g, b);
		const span = max - Math.min(r, g, b);

		const h =
			span === 0
				? 0
				: max === r
					? 60 * (((g - b) / span + 6) % 6)
					: max === g
						? 60 * ((b - r) / span + 2)
						: 60 * ((r - g) / span + 4);

		return { h, s: max === 0 ? 0 : span / max, v: max };
	}

	/** @param {number} n */
	const clamp = (n) => Math.min(1, Math.max(0, n));

	// HSV is the source of truth so dragging into black or grey does not lose the chosen hue.
	const initial = hexToHsv(get(customAccent));
	let hue = $state(initial.h);
	let saturation = $state(initial.s);
	let value = $state(initial.v);
	let hexDraft = $state(/** @type {string | null} */ (null));
	let dragging = $state(false);

	const hex = $derived(hsvToHex(hue, saturation, value));
	const hexField = $derived(hexDraft ?? hex);

	function commit() {
		setCustomAccent(hsvToHex(hue, saturation, value));
	}

	/** @param {PointerEvent} event */
	function trackPointer(event) {
		const rect = /** @type {HTMLElement} */ (event.currentTarget).getBoundingClientRect();
		saturation = clamp((event.clientX - rect.left) / rect.width);
		value = 1 - clamp((event.clientY - rect.top) / rect.height);
		commit();
	}

	/** @param {PointerEvent} event */
	function onAreaPointerDown(event) {
		// Suppresses the text-selection drag, which also suppresses focus, so focus explicitly.
		event.preventDefault();
		dragging = true;

		const target = /** @type {HTMLElement} */ (event.currentTarget);
		target.focus();
		// Capture keeps the drag tracking once the pointer leaves the square.
		target.setPointerCapture(event.pointerId);
		trackPointer(event);
	}

	/** @param {PointerEvent} event */
	function onAreaPointerMove(event) {
		if (dragging) trackPointer(event);
	}

	/** @param {KeyboardEvent} event */
	function onAreaKeydown(event) {
		const step = event.shiftKey ? 0.1 : 0.02;
		const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
		const dy = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0;
		if (!dx && !dy) return;

		event.preventDefault();
		saturation = clamp(saturation + dx);
		value = clamp(value + dy);
		commit();
	}

	/** @param {Event} event */
	function onHueInput(event) {
		hue = Number(/** @type {HTMLInputElement} */ (event.currentTarget).value);
		commit();
	}

	/** @param {Event} event */
	function onHexInput(event) {
		const raw = /** @type {HTMLInputElement} */ (event.currentTarget).value;
		hexDraft = raw;

		const parsed = normalizeHex(raw);
		if (!parsed) return;

		const next = hexToHsv(parsed);
		// A pure grey or black has no meaningful hue of its own; keep the strip where the user left it.
		if (next.s > 0 && next.v > 0) hue = next.h;
		saturation = next.s;
		value = next.v;
		setCustomAccent(parsed);
	}
</script>

<div class="picker">
	<button
		type="button"
		class="area"
		style:--hue="{hue}deg"
		aria-label="Saturation and brightness. Use the arrow keys to adjust."
		onpointerdown={onAreaPointerDown}
		onpointermove={onAreaPointerMove}
		onpointerup={() => (dragging = false)}
		onpointercancel={() => (dragging = false)}
		onkeydown={onAreaKeydown}
	>
		<span class="handle" style:left="{saturation * 100}%" style:top="{(1 - value) * 100}%"></span>
	</button>

	<input
		class="hue"
		type="range"
		min="0"
		max="360"
		step="1"
		value={hue}
		aria-label="Hue"
		oninput={onHueInput}
	/>

	<label class="hex-row">
		<span>Hex</span>
		<input
			type="text"
			maxlength="7"
			spellcheck="false"
			autocomplete="off"
			value={hexField}
			aria-label="Accent hex value"
			oninput={onHexInput}
			onblur={() => (hexDraft = null)}
		/>
	</label>
</div>

<style>
	.picker {
		display: grid;
		gap: 0.5rem;
		padding: 0.45rem 0.7rem 0.65rem;
	}

	.area {
		position: relative;
		display: block;
		width: 100%;
		height: 7rem;
		padding: 0;
		border: 1px solid var(--ink);
		background:
			linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent),
			hsl(var(--hue) 100% 50%);
		cursor: crosshair;
		touch-action: none;
	}

	.handle {
		position: absolute;
		width: 0.75rem;
		height: 0.75rem;
		border: 1px solid var(--ink);
		outline: 1px solid #fff;
		pointer-events: none;
		translate: -50% -50%;
	}

	.hue {
		width: 100%;
		height: 1rem;
		margin: 0;
		border: 1px solid var(--ink);
		background: linear-gradient(
			to right,
			#f00 0%,
			#ff0 17%,
			#0f0 33%,
			#0ff 50%,
			#00f 67%,
			#f0f 83%,
			#f00 100%
		);
		appearance: none;
		cursor: pointer;
	}

	.hue::-webkit-slider-thumb {
		width: 0.5rem;
		height: 1rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		appearance: none;
		cursor: pointer;
	}

	.hue::-moz-range-thumb {
		width: 0.5rem;
		height: 1rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: var(--paper);
		cursor: pointer;
	}

	.hex-row {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		justify-content: space-between;
		color: var(--ink);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.hex-row input {
		width: 6rem;
		padding: 0.25rem 0.4rem;
		border: 1px solid var(--ink);
		color: var(--ink);
		background: var(--paper);
		font-family: inherit;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: lowercase;
	}
</style>
