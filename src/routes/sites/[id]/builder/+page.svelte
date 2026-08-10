<script>
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';
	import { builder } from '#lib/builder/builder.svelte.js';
	import { getBlockDefinition } from '#lib/components/blocks/registry.js';
	import {
		BLOCK_MIN_WIDTH_PX,
		clampBlockMaxWidth,
		layoutFromMaxWidth
	} from '#lib/components/blocks/types.js';
	import BlocksHud from '#lib/components/builder/BlocksHud.svelte';
	import BuilderToolbar from '#lib/components/builder/BuilderToolbar.svelte';
	import InspectorHud from '#lib/components/builder/InspectorHud.svelte';
	import { ACCENTS, normalizeHex, onAccentFor } from '#lib/stores/brand.js';

	/** @typedef {import('#lib/components/blocks/types.js').PageBlockInstance} PageBlockInstance */

	const DEFAULT_SITE_ACCENT = ACCENTS[0].value;

	/**
	 * Scope site accent + light/dark tokens on the canvas so HUDs keep platform theme.
	 * @param {string} accentHex
	 * @param {'light' | 'dark'} appearance
	 */
	function previewThemeStyle(accentHex, appearance) {
		const accent = normalizeHex(accentHex) ?? DEFAULT_SITE_ACCENT;
		const onAccent = onAccentFor(accent);
		const dark = appearance === 'dark';
		const ink = dark ? '#f2f0e8' : '#11110f';
		const paper = dark ? '#141410' : '#f2f0e8';
		const muted = dark ? '#a8a69c' : '#696861';
		const hardBorder = dark ? accent : ink;
		const hardShadow = dark ? `color-mix(in srgb, ${accent} 30%, black)` : ink;
		const coverShadow = dark ? 'color-mix(in srgb, #f2f0e8 28%, transparent)' : ink;
		const fieldBorder = dark
			? `color-mix(in srgb, color-mix(in srgb, ${accent} 38%, black) 62%, ${muted})`
			: `color-mix(in srgb, color-mix(in srgb, ${accent} 68%, black) 78%, ${muted})`;
		const fieldSurface = dark
			? `color-mix(in srgb, ${accent} 10%, transparent)`
			: `color-mix(in srgb, ${accent} 7%, transparent)`;
		return [
			`--accent: ${accent}`,
			`--on-accent: ${onAccent}`,
			`--ink: ${ink}`,
			`--paper: ${paper}`,
			`--muted: ${muted}`,
			`--inverse: ${dark ? '#050504' : ink}`,
			`--on-inverse: #f2f0e8`,
			`--hard-border: ${hardBorder}`,
			`--hard-shadow: ${hardShadow}`,
			`--cover-shadow: ${coverShadow}`,
			`--field-border: ${fieldBorder}`,
			`--field-surface: ${fieldSurface}`,
			`color: ${ink}`,
			`background-color: ${paper}`,
			`color-scheme: ${dark ? 'dark' : 'light'}`
		].join('; ');
	}

	/**
	 * @type {{
	 *   data: {
	 *     site: {
	 *       id: string,
	 *       name: string,
	 *       accentColor?: string,
	 *       appearance?: 'light' | 'dark',
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
	 *       blocks: PageBlockInstance[],
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
	/** @type {HTMLElement | null} */
	let canvasEl = $state(null);
	/** Inner content width of `.canvas` (padding box), used as the resize ceiling. */
	let canvasWidth = $state(0);

	/**
	 * @type {null | {
	 *   instanceId: string,
	 *   side: 'left' | 'right',
	 *   pointerId: number,
	 *   startX: number,
	 *   startWidth: number,
	 *   liveWidth: number
	 * }}
	 */
	let resizeDrag = $state(null);

	$effect(() => {
		builder.hydrate({
			siteId: data.site.id,
			siteName: data.site.name,
			accentColor: data.site.accentColor ?? '',
			appearance: data.site.appearance === 'dark' ? 'dark' : 'light',
			header: data.site.header,
			footer: data.site.footer,
			pages: data.pages,
			currentPageId: data.currentPageId
		});
	});

	const previewStyle = $derived(previewThemeStyle(builder.accentColor, builder.appearance));

	/** @type {import('svelte/attachments').Attachment} */
	const measureCanvas = (el) => {
		canvasEl = el;
		const measure = () => {
			const style = getComputedStyle(el);
			const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
			canvasWidth = Math.max(0, el.clientWidth - padX);
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => {
			ro.disconnect();
			if (canvasEl === el) canvasEl = null;
		};
	};

	const headerDef = $derived(builder.header ? getBlockDefinition(builder.header.type) : null);
	const footerDef = $derived(builder.footer ? getBlockDefinition(builder.footer.type) : null);
	const HeaderBlock = $derived(headerDef?.component);
	const FooterBlock = $derived(footerDef?.component);

	/**
	 * Full canvas content width — resize ceiling (not the old 56rem preview rail).
	 * @returns {number}
	 */
	function boardWidth() {
		return canvasWidth || BLOCK_MIN_WIDTH_PX;
	}

	/**
	 * @param {PageBlockInstance} instance
	 * @returns {number | null}
	 */
	function displayMaxWidth(instance) {
		if (resizeDrag?.instanceId === instance.id) return resizeDrag.liveWidth;
		const stored = instance.layout?.maxWidth;
		return typeof stored === 'number' ? stored : null;
	}

	/**
	 * @param {PageBlockInstance} instance
	 * @returns {string | undefined}
	 */
	function instanceMaxWidthStyle(instance) {
		const max = displayMaxWidth(instance);
		if (max == null) return undefined;
		const board = boardWidth();
		if (max >= board) return undefined;
		return `${max}px`;
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 * @param {PageBlockInstance} instance
	 * @param {'left' | 'right'} side
	 */
	function startResize(event, instance, side) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		const board = boardWidth();
		const current = instance.layout?.maxWidth ?? board;
		const startWidth = clampBlockMaxWidth(current, board);
		resizeDrag = {
			instanceId: instance.id,
			side,
			pointerId: event.pointerId,
			startX: event.clientX,
			startWidth,
			liveWidth: startWidth
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onResizePointerMove(event) {
		if (!resizeDrag || event.pointerId !== resizeDrag.pointerId) return;
		const board = boardWidth();
		const dx = event.clientX - resizeDrag.startX;
		const signed = resizeDrag.side === 'right' ? dx : -dx;
		const liveWidth = clampBlockMaxWidth(resizeDrag.startWidth + 2 * signed, board);
		resizeDrag = { ...resizeDrag, liveWidth };
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function onResizePointerUp(event) {
		if (!resizeDrag || event.pointerId !== resizeDrag.pointerId) return;
		const board = boardWidth();
		const layout = layoutFromMaxWidth(resizeDrag.liveWidth, board);
		const instanceId = resizeDrag.instanceId;
		resizeDrag = null;
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// Already released.
		}
		builder.updateBlockLayout(instanceId, layout ?? null, { immediate: true });
	}

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
		<div
			class="canvas"
			aria-label="Site builder canvas"
			ondragover={onDragOver}
			role="region"
			{@attach measureCanvas}
		>
			<div class="preview" style={previewStyle}>
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
						{@const maxWidthStyle = instanceMaxWidthStyle(instance)}
						<div
							class="drop-gap"
							class:active={dropIndex === index}
							role="separator"
							aria-label="Drop block here"
							ondragover={(e) => onGapDragOver(e, index)}
							ondragleave={onDragLeaveGap}
							ondrop={(e) => onDropAt(e, index)}
						></div>
						<div
							class="instance"
							class:selected={builder.selectedInstanceId === instance.id}
							class:resizing={resizeDrag?.instanceId === instance.id}
							style:max-width={maxWidthStyle}
						>
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
									class="resize-handle left"
									aria-label="Resize block width from left"
									data-builder-no-drag
									onpointerdown={(e) => startResize(e, instance, 'left')}
									onpointermove={onResizePointerMove}
									onpointerup={onResizePointerUp}
									onpointercancel={onResizePointerUp}
								></button>
								<button
									type="button"
									class="resize-handle right"
									aria-label="Resize block width from right"
									data-builder-no-drag
									onpointerdown={(e) => startResize(e, instance, 'right')}
									onpointermove={onResizePointerMove}
									onpointerup={onResizePointerUp}
									onpointercancel={onResizePointerUp}
								></button>
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
		width: 100%;
		min-width: 0;
		/* Site theme tokens applied inline; isolate from listener dark/light on <html>. */
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
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
		width: 100%;
		margin-inline: auto;
		outline: 1px solid transparent;
		background: var(--paper);
	}

	.instance.selected {
		outline-color: var(--accent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.instance.resizing {
		user-select: none;
	}

	.resize-handle {
		position: absolute;
		top: 0;
		bottom: 0;
		z-index: 3;
		width: 0.55rem;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: ew-resize;
		touch-action: none;
	}

	.resize-handle.left {
		left: 0;
		transform: translateX(-50%);
	}

	.resize-handle.right {
		right: 0;
		transform: translateX(50%);
	}

	.resize-handle::after {
		content: '';
		position: absolute;
		top: 0.65rem;
		bottom: 0.65rem;
		left: 50%;
		width: 3px;
		transform: translateX(-50%);
		background: color-mix(in srgb, var(--accent) 72%, var(--ink));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.resize-handle:hover::after,
	.instance.resizing .resize-handle::after {
		background: var(--accent);
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
