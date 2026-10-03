<script>
	import IconEye from '@tabler/icons-svelte-runes/icons/eye';
	import IconEyeOff from '@tabler/icons-svelte-runes/icons/eye-off';
	import IconGripVertical from '@tabler/icons-svelte-runes/icons/grip-vertical';
	import { prefersReducedMotion } from 'svelte/motion';
	import { flip } from 'svelte/animate';
	import { builder } from '#lib/builder/builder.svelte.js';
	import { getBlockDefinition } from '#lib/components/blocks/registry.js';

	const DRAG_THRESHOLD_PX = 10;

	const flipDuration = $derived(prefersReducedMotion.current ? 0 : 180);
	const blocks = $derived(builder.blocks);

	/**
	 * @type {null | {
	 *   id: string,
	 *   from: number,
	 *   pointerId: number,
	 *   startY: number,
	 *   armed: boolean
	 * }}
	 */
	let drag = $state(null);
	/** Visual gap index: 0 is above the first row, `blocks.length` is below the last. */
	let gap = $state(/** @type {number | null} */ (null));
	let suppressClick = false;

	const lineGap = $derived.by(() => {
		if (!drag?.armed || gap == null) return null;
		if (gap === drag.from || gap === drag.from + 1) return null;
		return gap;
	});

	/**
	 * @param {number} clientY
	 * @param {HTMLElement} list
	 */
	function gapAt(clientY, list) {
		const rows = [...list.querySelectorAll('[data-layer-index]')];
		for (let i = 0; i < rows.length; i += 1) {
			const rect = rows[i].getBoundingClientRect();
			if (clientY < rect.top + rect.height / 2) return i;
		}
		return rows.length;
	}

	/**
	 * @param {string} id
	 */
	function selectBlock(id) {
		builder.highlightBlock(id);
		const el = document.querySelector(`[data-instance-id="${CSS.escape(id)}"]`);
		if (!(el instanceof HTMLElement)) return;
		el.scrollIntoView({
			block: 'nearest',
			behavior: prefersReducedMotion.current ? 'auto' : 'smooth'
		});
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 * @param {string} id
	 * @param {number} index
	 */
	function onPointerDown(event, id, index) {
		if (event.button !== 0) return;
		const list = event.currentTarget.closest('[data-block-layers]');
		drag = { id, from: index, pointerId: event.pointerId, startY: event.clientY, armed: false };
		gap = index;

		const onMove = (/** @type {PointerEvent} */ moveEvent) => {
			if (!drag || moveEvent.pointerId !== drag.pointerId) return;
			if (!drag.armed) {
				if (Math.abs(moveEvent.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
				drag = { ...drag, armed: true };
			}
			if (list instanceof HTMLElement) gap = gapAt(moveEvent.clientY, list);
		};
		const onUp = (/** @type {PointerEvent} */ upEvent) => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			finishDrag(upEvent, upEvent.type !== 'pointercancel');
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	/**
	 * @param {PointerEvent} event
	 * @param {boolean} commit
	 */
	function finishDrag(event, commit) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const { armed, id, from } = drag;
		const nextGap = gap ?? from;
		// `gap` still counts the dragged row. A gap below it shifts up once that row is removed.
		const to = nextGap > from ? nextGap - 1 : nextGap;
		drag = null;
		gap = null;
		if (!commit || !armed || to === from) return;
		suppressClick = true;
		builder.moveBlock(id, to);
	}

	/**
	 * @param {MouseEvent} event
	 * @param {string} id
	 */
	function onClick(event, id) {
		if (suppressClick) {
			suppressClick = false;
			event.preventDefault();
			return;
		}
		selectBlock(id);
	}

	/**
	 * @param {KeyboardEvent} event
	 * @param {string} id
	 * @param {number} index
	 */
	function onKeydown(event, id, index) {
		if (event.key === 'ArrowUp' && index > 0) {
			event.preventDefault();
			builder.moveBlock(id, index - 1);
			return;
		}
		if (event.key === 'ArrowDown' && index < blocks.length - 1) {
			event.preventDefault();
			builder.moveBlock(id, index + 1);
		}
	}
</script>

<section class="layers-section" aria-labelledby="page-blocks-label">
	<header class="layers-head">
		<h2 class="layers-title" id="page-blocks-label">Blocks</h2>
		{#if blocks.length > 0}
			<span class="layers-count">{blocks.length}</span>
		{/if}
	</header>

	{#if blocks.length === 0}
		<p class="empty">No blocks on this page yet.</p>
	{:else}
		<ul class="layers" data-block-layers aria-label="Page blocks">
			{#each blocks as block, index (block.id)}
				{@const def = getBlockDefinition(block.type)}
				{@const label = def?.label ?? block.type}
				<li
					class="layer-row"
					class:selected={builder.selectedInstanceId === block.id}
					class:is-hidden={block.hidden === true}
					class:dragging={drag?.armed && drag.id === block.id}
					class:line-before={lineGap === index}
					class:line-after={lineGap === blocks.length && index === blocks.length - 1}
					data-layer-index={index}
					animate:flip={{ duration: flipDuration }}
				>
					<button
						type="button"
						class="layer"
						aria-pressed={builder.selectedInstanceId === block.id}
						aria-keyshortcuts="ArrowUp ArrowDown"
						aria-label="{label}. Drag to reorder, or use the arrow keys."
						onpointerdown={(e) => onPointerDown(e, block.id, index)}
						onclick={(e) => onClick(e, block.id)}
						onkeydown={(e) => onKeydown(e, block.id, index)}
					>
						<span class="grip">
							<IconGripVertical size={14} stroke={1.75} aria-hidden="true" />
						</span>
						<span class="copy">
							<span class="name">{label}</span>
							{#if def?.category}
								<span class="cat">{def.category}</span>
							{/if}
						</span>
					</button>
					<button
						type="button"
						class="eye"
						class:off={block.hidden === true}
						aria-pressed={block.hidden !== true}
						aria-label={block.hidden ? `Show ${label}` : `Hide ${label}`}
						onclick={() => builder.setBlockHidden(block.id, block.hidden !== true)}
					>
						{#if block.hidden}
							<IconEyeOff size={15} stroke={1.75} aria-hidden="true" />
						{:else}
							<IconEye size={15} stroke={1.75} aria-hidden="true" />
						{/if}
					</button>
				</li>
			{/each}
		</ul>
		<p class="hint">Top of the list is the top of the page. The eye hides a block on the page.</p>
	{/if}
</section>

<style>
	.layers-section {
		display: grid;
		gap: 0.4rem;
		margin-bottom: 0.85rem;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.layers-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.layers-title {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: 0.95rem;
		font-weight: 500;
	}

	.layers-count {
		color: var(--muted);
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		font-variant-numeric: tabular-nums;
	}

	.layers {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.15rem;
	}

	.layer-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.15rem;
		border: 1px solid transparent;
	}

	.layer-row.selected {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, var(--paper));
	}

	.layer-row.line-before {
		box-shadow: inset 0 2px 0 var(--accent);
	}

	.layer-row.line-after {
		box-shadow: inset 0 -2px 0 var(--accent);
	}

	.layer-row.dragging {
		opacity: 0.55;
	}

	.layer-row.is-hidden .name,
	.layer-row.is-hidden .cat {
		opacity: 0.45;
	}

	.layer {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.35rem;
		width: 100%;
		min-width: 0;
		padding: 0.28rem 0.35rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		text-align: left;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.layer-row.dragging .layer {
		cursor: grabbing;
	}

	.grip {
		display: grid;
		color: var(--muted);
	}

	.copy {
		display: grid;
		min-width: 0;
	}

	.name,
	.cat {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name {
		font-size: 0.8rem;
	}

	.cat {
		color: var(--muted);
		font-size: 0.62rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.eye {
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		margin-right: 0.15rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}

	.eye.off {
		color: var(--muted);
	}

	.eye:hover {
		color: var(--ink);
	}

	.layer:focus-visible,
	.eye:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.empty,
	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.75rem;
	}
</style>
