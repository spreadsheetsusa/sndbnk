<script>
	import { prefersReducedMotion } from 'svelte/motion';
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { THEME_SLOTS } from '#lib/builder/theme-persona.js';
	import AccentPicker from '#lib/components/AccentPicker.svelte';

	/** @typedef {import('#lib/builder/theme-persona.js').ThemeChip} ThemeChip */

	const DRAG_THRESHOLD_PX = 10;

	/**
	 * @type {{
	 *   chips: ThemeChip[],
	 *   onReorder: (fromIndex: number, toIndex: number) => void,
	 *   onOverride: (index: number, hex: string) => void
	 * }}
	 */
	let { chips, onReorder, onOverride } = $props();

	const flipDuration = $derived(prefersReducedMotion.current ? 0 : 180);

	/** @type {string | null} */
	let pickingChipId = $state(null);

	/**
	 * @type {null | {
	 *   chipId: string,
	 *   fromIndex: number,
	 *   startX: number,
	 *   startY: number,
	 *   armed: boolean,
	 *   pointerId: number
	 * }}
	 */
	let drag = $state(null);

	/** @type {number | null} */
	let dropIndex = $state(null);

	const pickingIndex = $derived(
		pickingChipId == null ? -1 : chips.findIndex((chip) => chip.id === pickingChipId)
	);
	const pickingHex = $derived(pickingIndex >= 0 ? chips[pickingIndex].hex : null);

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 * @param {string} chipId
	 * @param {number} index
	 */
	function onSwatchPointerDown(event, chipId, index) {
		if (event.button !== 0) return;
		drag = {
			chipId,
			fromIndex: index,
			startX: event.clientX,
			startY: event.clientY,
			armed: false,
			pointerId: event.pointerId
		};
		dropIndex = index;
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function onSwatchPointerMove(event) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const dx = event.clientX - drag.startX;
		const dy = event.clientY - drag.startY;
		if (!drag.armed) {
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
			drag = { ...drag, armed: true };
			pickingChipId = null;
		}

		const row = event.currentTarget.closest('.swatch-row');
		if (!row) return;
		const swatches = [...row.querySelectorAll('[data-persona-swatch]')];
		let next = drag.fromIndex;
		for (let i = 0; i < swatches.length; i += 1) {
			const rect = swatches[i].getBoundingClientRect();
			const mid = rect.left + rect.width / 2;
			if (event.clientX < mid) {
				next = i;
				break;
			}
			next = i;
		}
		dropIndex = next;
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function onSwatchPointerUp(event) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const { armed, fromIndex, chipId } = drag;
		const toIndex = dropIndex ?? fromIndex;
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// Already released.
		}
		drag = null;
		dropIndex = null;

		if (!armed) {
			pickingChipId = pickingChipId === chipId ? null : chipId;
			return;
		}
		if (toIndex !== fromIndex) onReorder(fromIndex, toIndex);
	}

	/**
	 * @param {string} hex
	 */
	function commitOverride(hex) {
		if (pickingIndex < 0) return;
		onOverride(pickingIndex, hex);
	}
</script>

<div class="persona-palette">
	<div class="slot-labels" aria-hidden="true">
		{#each THEME_SLOTS as slot (slot.id)}
			<span class="slot-label">{slot.label}</span>
		{/each}
	</div>

	<div
		class="swatch-row"
		role="toolbar"
		aria-label="Theme color slots"
		class:dragging={Boolean(drag?.armed)}
	>
		{#each chips as chip, index (chip.id)}
			<div class="swatch-wrap" animate:flip={{ duration: flipDuration }}>
				<button
					type="button"
					class="swatch"
					class:drop-target={drag?.armed && dropIndex === index}
					class:dragging={drag?.armed && drag.chipId === chip.id}
					class:picking={pickingChipId === chip.id}
					style:background={chip.hex}
					data-persona-swatch
					aria-label="{THEME_SLOTS[index]?.label ??
						'Color'}: {chip.hex}. Click to edit, drag to reorder."
					aria-pressed={pickingChipId === chip.id}
					onpointerdown={(e) => onSwatchPointerDown(e, chip.id, index)}
					onpointermove={onSwatchPointerMove}
					onpointerup={onSwatchPointerUp}
					onpointercancel={onSwatchPointerUp}
				></button>
			</div>
		{/each}
	</div>

	{#if pickingHex}
		<div
			class="slot-picker"
			transition:slide={{ duration: prefersReducedMotion.current ? 0 : 200 }}
		>
			<p class="picker-label">
				{THEME_SLOTS[pickingIndex]?.label ?? 'Color'}
			</p>
			{#key pickingChipId}
				<AccentPicker value={pickingHex} onchange={commitOverride} />
			{/key}
		</div>
	{/if}
</div>

<style>
	.persona-palette {
		display: grid;
		gap: 0.35rem;
		padding: 0 0.55rem 0.2rem;
	}

	.slot-labels,
	.swatch-row {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.3rem;
		align-items: center;
	}

	.slot-label {
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-align: center;
		line-height: 1.15;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.swatch-wrap {
		display: flex;
		justify-content: center;
		min-width: 0;
	}

	.swatch {
		aspect-ratio: 1;
		width: 100%;
		max-width: 2rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: var(--paper);
		cursor: grab;
		touch-action: none;
	}

	.swatch:hover {
		border-color: var(--ink);
	}

	.swatch.picking,
	.swatch:focus-visible {
		box-shadow:
			0 0 0 2px var(--paper),
			0 0 0 3px var(--accent);
	}

	.swatch.dragging {
		cursor: grabbing;
		opacity: 0.85;
		z-index: 2;
	}

	.swatch.drop-target {
		outline: 1px dashed var(--accent);
		outline-offset: 2px;
	}

	.swatch-row.dragging .swatch {
		cursor: grabbing;
	}

	.slot-picker {
		display: grid;
		gap: 0.35rem;
		padding-top: 0.25rem;
	}

	.picker-label {
		margin: 0;
		color: var(--ink);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
</style>
