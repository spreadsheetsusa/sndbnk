<script>
	import { builder } from '#lib/builder/builder.svelte.js';
	import { pageInsertableBlockCatalog } from '#lib/components/blocks/registry.js';
	import FloatingHud from '#lib/components/builder/FloatingHud.svelte';

	/** @type {Array<{ category: string, items: typeof pageInsertableBlockCatalog }>} */
	const groups = $derived.by(() => {
		/** @type {Map<string, typeof pageInsertableBlockCatalog>} */
		const map = new Map();
		for (const entry of pageInsertableBlockCatalog) {
			const list = map.get(entry.category) ?? [];
			list.push(entry);
			map.set(entry.category, list);
		}
		return [...map.entries()].map(([category, items]) => ({ category, items }));
	});

	/**
	 * @param {DragEvent} event
	 * @param {string} type
	 */
	function onDragStart(event, type) {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData(builder.blockMime, type);
		event.dataTransfer.setData('text/plain', type);
		event.dataTransfer.effectAllowed = 'copy';
		builder.selectCatalogType(type);
	}

	/**
	 * @param {string} type
	 */
	function appendBlock(type) {
		builder.insertBlock(type);
	}
</script>

{#if builder.blocksOpen}
	<FloatingHud id="blocks" title="Blocks" onclose={() => builder.setTool(null)}>
		<div class="scroller" data-builder-no-drag>
			{#each groups as group (group.category)}
				<section class="group" aria-label={group.category}>
					<p class="group-label">{group.category}</p>
					<ul>
						{#each group.items as entry (entry.type)}
							{@const Preview = entry.preview}
							<li>
								<button
									type="button"
									class="thumb"
									class:selected={builder.selectedCatalogType === entry.type}
									aria-pressed={builder.selectedCatalogType === entry.type}
									title="Drag onto the canvas, or click to append — {entry.label}"
									draggable="true"
									ondragstart={(e) => onDragStart(e, entry.type)}
									onclick={() => appendBlock(entry.type)}
								>
									<span class="frame">
										<Preview />
									</span>
									<span class="label">{entry.label}</span>
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	</FloatingHud>
{/if}

<style>
	.scroller {
		display: flex;
		gap: 0.85rem;
		align-items: stretch;
		padding: 0.55rem 0.65rem 0.7rem;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-behavior: smooth;
		height: 100%;
	}

	.group {
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 0.3rem;
		flex: 0 0 auto;
		min-width: 0;
	}

	.group-label {
		margin: 0;
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		gap: 0.45rem;
	}

	.thumb {
		display: grid;
		gap: 0.2rem;
		width: 8.5rem;
		padding: 0.3rem;
		border: 1px solid color-mix(in srgb, var(--ink) 32%, transparent);
		background: color-mix(in srgb, var(--ink) 3%, var(--paper));
		color: var(--muted);
		cursor: grab;
		text-align: left;
	}

	.thumb:active {
		cursor: grabbing;
	}

	.thumb:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	.thumb.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
		color: var(--ink);
	}

	.frame {
		display: block;
		aspect-ratio: 266 / 150;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background: var(--paper);
		pointer-events: none;
	}

	.frame :global(.block-preview) {
		width: 100%;
		height: 100%;
		display: block;
	}

	.label {
		font-size: 0.65rem;
		letter-spacing: 0.03em;
		line-height: 1.25;
		color: inherit;
	}
</style>
