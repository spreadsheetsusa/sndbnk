<script>
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';
	import { builder } from '#lib/builder/builder.svelte.js';
	import { getBlockDefinition } from '#lib/components/blocks/registry.js';
	import BlocksHud from '#lib/components/builder/BlocksHud.svelte';
	import BuilderToolbar from '#lib/components/builder/BuilderToolbar.svelte';
	import InspectorHud from '#lib/components/builder/InspectorHud.svelte';

	/**
	 * @type {{
	 *   data: {
	 *     site: {
	 *       id: string,
	 *       name: string,
	 *       header: { id: string, type: string, props: Record<string, unknown> } | null,
	 *       footer: { id: string, type: string, props: Record<string, unknown> } | null
	 *     },
	 *     pages: Array<{
	 *       id: string,
	 *       siteId: string,
	 *       parentId: string | null,
	 *       slug: string,
	 *       path: string,
	 *       title: string,
	 *       seoTitle: string,
	 *       seoDescription: string,
	 *       blocks: Array<{ id: string, type: string, props: Record<string, unknown> }>,
	 *       sortOrder: number,
	 *       updatedAt: number
	 *     }>,
	 *     currentPageId: string
	 *   },
	 *   form?: {
	 *     pageMessage?: string,
	 *     pageSuccess?: string,
	 *     pageId?: string,
	 *     title?: string,
	 *     slug?: string,
	 *     seoTitle?: string,
	 *     seoDescription?: string
	 *   } | null
	 * }}
	 */
	let { data, form = null } = $props();

	/** @type {number | null} */
	let dropIndex = $state(null);

	$effect(() => {
		builder.hydrate({
			siteId: data.site.id,
			siteName: data.site.name,
			header: data.site.header,
			footer: data.site.footer,
			pages: data.pages,
			currentPageId: data.currentPageId
		});
	});

	const headerDef = $derived(builder.header ? getBlockDefinition(builder.header.type) : null);
	const footerDef = $derived(builder.footer ? getBlockDefinition(builder.footer.type) : null);
	const HeaderBlock = $derived(headerDef?.component);
	const FooterBlock = $derived(footerDef?.component);

	/**
	 * @param {DragEvent} event
	 */
	function onDragOver(event) {
		if (!event.dataTransfer?.types.includes(builder.blockMime)) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	}

	/**
	 * @param {DragEvent} event
	 * @param {number} index
	 */
	function onGapDragOver(event, index) {
		if (!event.dataTransfer?.types.includes(builder.blockMime)) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		dropIndex = index;
	}

	function onDragLeaveGap() {
		dropIndex = null;
	}

	/**
	 * @param {DragEvent} event
	 * @param {number} index
	 */
	function onDropAt(event, index) {
		event.preventDefault();
		const type =
			event.dataTransfer?.getData(builder.blockMime) ||
			event.dataTransfer?.getData('text/plain') ||
			'';
		dropIndex = null;
		if (!type) return;
		builder.insertBlock(type, index);
	}
</script>

<svelte:head>
	<title>{data.site.name || 'Site'} builder | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<main>
		<div class="canvas" aria-label="Site builder canvas" ondragover={onDragOver} role="region">
			<div class="preview">
				{#if builder.header && HeaderBlock}
					<div class="chrome instance" class:selected={builder.selectedChrome === 'header'}>
						<button
							type="button"
							class="instance-hit"
							aria-label="Select site header"
							aria-pressed={builder.selectedChrome === 'header'}
							onclick={() => builder.selectChrome('header')}
						>
							<HeaderBlock {...builder.header.props} />
						</button>
					</div>
				{/if}

				<div class="stack">
					{#each builder.blocks as instance, index (instance.id)}
						{@const def = getBlockDefinition(instance.type)}
						{@const Block = def?.component}
						<div
							class="drop-gap"
							class:active={dropIndex === index}
							role="separator"
							aria-label="Drop block here"
							ondragover={(e) => onGapDragOver(e, index)}
							ondragleave={onDragLeaveGap}
							ondrop={(e) => onDropAt(e, index)}
						></div>
						<div class="instance" class:selected={builder.selectedInstanceId === instance.id}>
							<button
								type="button"
								class="instance-hit"
								aria-label="Select {def?.label ?? instance.type}"
								aria-pressed={builder.selectedInstanceId === instance.id}
								onclick={() => builder.selectInstance(instance.id)}
							>
								{#if Block}
									<Block {...instance.props} />
								{:else}
									<p class="missing">Unknown block: {instance.type}</p>
								{/if}
							</button>
							{#if builder.selectedInstanceId === instance.id}
								<button
									type="button"
									class="remove"
									aria-label="Remove block"
									onclick={() => builder.removeBlock(instance.id)}
								>
									<IconTrash size={15} stroke={1.75} aria-hidden="true" />
								</button>
							{/if}
						</div>
					{/each}
					<div
						class="drop-gap end"
						class:active={dropIndex === builder.blocks.length}
						class:empty={builder.blocks.length === 0}
						role="separator"
						aria-label="Drop block at end"
						ondragover={(e) => onGapDragOver(e, builder.blocks.length)}
						ondragleave={onDragLeaveGap}
						ondrop={(e) => onDropAt(e, builder.blocks.length)}
					>
						{#if builder.blocks.length === 0}
							<p class="placeholder">Drag a block from the Blocks HUD onto the canvas.</p>
						{/if}
					</div>
				</div>

				{#if builder.footer && FooterBlock}
					<div class="chrome instance" class:selected={builder.selectedChrome === 'footer'}>
						<button
							type="button"
							class="instance-hit"
							aria-label="Select site footer"
							aria-pressed={builder.selectedChrome === 'footer'}
							onclick={() => builder.selectChrome('footer')}
						>
							<FooterBlock {...builder.footer.props} />
						</button>
					</div>
				{/if}
			</div>
		</div>
	</main>

	<BuilderToolbar />
	<InspectorHud siteId={data.site.id} {form} />
	<BlocksHud />
</div>

<style>
	.page {
		min-height: 100vh;
		display: grid;
		grid-template-rows: 1fr;
	}

	main {
		min-height: 0;
		padding: 0.75rem var(--site-shell-pad-x) 1.25rem;
	}

	.canvas {
		min-height: calc(100vh - 2rem);
		display: grid;
		align-content: start;
		gap: 1.25rem;
		padding: 1.5rem 1.25rem 4rem;
		border: 1px dashed color-mix(in srgb, var(--ink) 35%, transparent);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--ink) 4%, var(--paper)),
			color-mix(in srgb, var(--accent) 5%, var(--paper))
		);
	}

	.preview {
		display: grid;
		gap: 0;
		width: min(100%, 56rem);
		margin-inline: auto;
	}

	.stack {
		display: grid;
		gap: 0;
		min-width: 0;
	}

	.drop-gap {
		min-height: 0.55rem;
		border: 1px dashed transparent;
		transition:
			min-height 120ms ease,
			border-color 120ms ease,
			background 120ms ease;
	}

	.drop-gap.active {
		min-height: 1.4rem;
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}

	.drop-gap.end.empty {
		min-height: 8rem;
		display: grid;
		place-items: center;
		border: 1px dashed color-mix(in srgb, var(--ink) 28%, transparent);
		background: color-mix(in srgb, var(--paper) 82%, transparent);
	}

	.drop-gap.end.empty.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, var(--paper));
	}

	.placeholder {
		margin: 0;
		padding: 0.75rem 1rem;
		color: var(--muted);
		text-align: center;
		font-size: 0.9rem;
	}

	.instance {
		position: relative;
		outline: 1px solid transparent;
		background: var(--paper);
	}

	.instance.selected {
		outline-color: var(--accent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.chrome {
		margin-bottom: 0;
	}

	.chrome + .stack {
		border-top: 1px dashed color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.stack + .chrome {
		border-top: 1px dashed color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.instance-hit {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
		font: inherit;
	}

	.instance-hit :global(a),
	.instance-hit :global(button),
	.instance-hit :global(input) {
		pointer-events: none;
	}

	.remove {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		z-index: 2;
	}

	.remove:hover {
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	.missing {
		margin: 0;
		padding: 1rem;
		color: var(--muted);
	}
</style>
