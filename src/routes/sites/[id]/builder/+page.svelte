<script>
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';
	import { onDestroy } from 'svelte';
	import { builder } from '#lib/builder/builder.svelte.js';
	import { chromeAccentStyle } from '#lib/builder/chrome-accent.js';
	import { backgroundStyle, resolveBackground } from '#lib/builder/site-background.js';
	import { getBlockDefinition } from '#lib/components/blocks/registry.js';
	import { sitePlayerAccent } from '#lib/player/site-accent.svelte.js';
	import {
		heroImageWidthLabel,
		heroImageWidthValue,
		snapHeroImagePx
	} from '#lib/components/blocks/hero-frame.js';
	import {
		BLOCK_MIN_WIDTH_PX,
		clampBlockMaxWidth,
		layoutFromMaxWidth,
		snapBlockMaxWidth,
		visibleBlockWidthBreakpoints
	} from '#lib/components/blocks/types.js';
	import { buildPersonaPalette } from '#lib/builder/theme-persona.js';
	import BlocksHud from '#lib/components/builder/BlocksHud.svelte';
	import BuilderToolbar from '#lib/components/builder/BuilderToolbar.svelte';
	import InspectorHud from '#lib/components/builder/InspectorHud.svelte';
	import MediaHud from '#lib/components/builder/MediaHud.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';
	import { ACCENTS, normalizeHex } from '#lib/stores/brand.js';

	/** @typedef {import('#lib/components/blocks/types.js').PageBlockInstance} PageBlockInstance */

	const DEFAULT_SITE_ACCENT = ACCENTS[0].value;

	/**
	 * Scope site accent + persona + light/dark tokens on the preview so HUDs keep platform theme.
	 * @param {ReturnType<typeof buildPersonaPalette>} palette
	 * @param {'light' | 'dark'} previewAppearance
	 */
	function previewThemeStyle(palette, previewAppearance) {
		const accent = palette.accent;
		const onAccent = palette.onAccent;
		const dark = previewAppearance === 'dark';
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
		const themeVars = Object.entries(palette.cssVars)
			.map(([key, value]) => `${key}: ${value}`)
			.join('; ');
		return [
			themeVars,
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
	 *       appearance?: 'light' | 'dark' | 'user',
	 *       themePersona?: string,
	 *       themePalette?: import('#lib/builder/theme-persona.js').ThemeSlotColors | null,
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
	 *     currentPageId: string,
	 *     profileCatalog?: (Record<string, any> & {
	 *       tab: 'tracks' | 'likes' | 'history',
	 *       profile: { username: string },
	 *       items: Array<Record<string, any>>,
	 *       nextCursor: string | null
	 *     }) | null
	 *   },
	 *   form?: {
	 *     pagesMessage?: string,
	 *     pagesSuccess?: string,
	 *     createdPageId?: string,
	 *     deletedPageId?: string,
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
	const profileCatalog = $derived(data.profileCatalog ?? null);
	const profileCatalogList = restorableList(
		() => ({
			scope:
				profileCatalog?.tab === 'likes'
					? 'likes'
					: profileCatalog?.tab === 'history'
						? 'history'
						: 'profile',
			username: profileCatalog?.profile.username ?? null
		}),
		() => profileCatalog ?? { items: [], nextCursor: null },
		() => canvasEl
	);

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

	/**
	 * Live hero-image width while the edge handles are dragged.
	 * @type {null | {
	 *   instanceId: string,
	 *   side: 'left' | 'right',
	 *   pointerId: number,
	 *   startX: number,
	 *   startWidth: number,
	 *   slot: number,
	 *   defaultPx: number,
	 *   liveWidth: number
	 * }}
	 */
	let imageDrag = $state(null);

	/**
	 * Selected hero image box, relative to its `.instance`.
	 * @type {null | { instanceId: string, top: number, left: number, width: number, height: number }}
	 */
	let imageFrame = $state(null);

	const hydrateBuilder = $derived.by(() => {
		const state = {
			siteId: data.site.id,
			siteName: data.site.name,
			accentColor: data.site.accentColor ?? '',
			headerAccent: data.site.headerAccent ?? '',
			footerAccent: data.site.footerAccent ?? '',
			logoUrl: data.site.logoUrl ?? '',
			logoTrackId: data.site.logoTrackId ?? null,
			background: data.site.background ?? null,
			backgroundUrl: data.site.backgroundUrl ?? '',
			appearance:
				data.site.appearance === 'dark' || data.site.appearance === 'user'
					? data.site.appearance
					: 'light',
			themePersona: data.site.themePersona ?? 'mono',
			themePalette: data.site.themePalette ?? null,
			header: data.site.header,
			footer: data.site.footer,
			pages: data.pages,
			currentPageId: data.currentPageId
		};
		/** @type {import('svelte/attachments').Attachment} */
		return () => builder.hydrate(state);
	});

	const previewPalette = $derived(
		buildPersonaPalette(
			normalizeHex(builder.accentColor) ?? DEFAULT_SITE_ACCENT,
			builder.themePersona,
			builder.themeSlotColors
		)
	);
	const previewStyle = $derived(previewThemeStyle(previewPalette, builder.previewAppearance));
	const previewBackground = $derived(
		resolveBackground(
			{
				trackId: builder.backgroundTrackId,
				size: builder.backgroundSize,
				position: builder.backgroundPosition,
				attachment: builder.backgroundAttachment
			},
			builder.pages.find((page) => page.id === builder.currentPageId)?.background ?? null
		)
	);
	const previewBackgroundCss = $derived(backgroundStyle(previewBackground, builder.backgroundUrl));

	// Local counter so the effect can bump `paint` without reading it (a read would loop).
	let paintGen = 0;

	// Canvases re-read computed `--accent` when this changes. EQ stays on the
	// listener color: it is outside the preview, so its computed accent is the platform one.
	$effect(() => {
		sitePlayerAccent.hex = previewPalette.accent;
		void builder.headerAccent;
		void builder.footerAccent;
		paintGen += 1;
		sitePlayerAccent.paint = paintGen;
	});
	onDestroy(() => {
		sitePlayerAccent.hex = null;
	});

	const consoleStatus = $derived(builder.consoleStatus);

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

	const guideBreakpoints = $derived(visibleBlockWidthBreakpoints(boardWidth()));

	const imageSizeLabel = $derived.by(() => {
		if (!imageDrag || typeof document === 'undefined') return '';
		const font = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		return heroImageWidthLabel(imageDrag.liveWidth, font);
	});

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
		const raw = clampBlockMaxWidth(resizeDrag.startWidth + 2 * signed, board);
		const liveWidth = snapBlockMaxWidth(raw, board);
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
	 * Column the image can grow into. Split heroes use their grid track;
	 * centered heroes use the whole hero row.
	 * @param {HTMLElement} media
	 */
	function heroImageSlotPx(media) {
		const section = media.closest('section');
		if (!(section instanceof HTMLElement)) return media.getBoundingClientRect().width;
		const tracks = getComputedStyle(section)
			.gridTemplateColumns.split(/\s+/)
			.filter(Boolean)
			.map((track) => parseFloat(track))
			.filter((size) => Number.isFinite(size) && size > 0);
		if (tracks.length < 2) return section.clientWidth;
		const sectionRect = section.getBoundingClientRect();
		const mediaRect = media.getBoundingClientRect();
		const center = mediaRect.left + mediaRect.width / 2 - sectionRect.left;
		let cursor = 0;
		for (const size of tracks) {
			if (center <= cursor + size + 1) return size;
			cursor += size;
		}
		return mediaRect.width;
	}

	/**
	 * Width the layout uses before an image-width override (42rem cap, or the column).
	 * @param {HTMLElement} media
	 * @param {number} slot
	 */
	function heroImageDefaultPx(media, slot) {
		const cap = getComputedStyle(media).getPropertyValue('--hero-media-cap').trim();
		if (!cap || cap === '100%') return slot;
		const font = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		if (cap.endsWith('rem')) return Math.min(slot, parseFloat(cap) * font);
		if (cap.endsWith('px')) return Math.min(slot, parseFloat(cap));
		return slot;
	}

	/**
	 * @param {string} instanceId
	 */
	function measureHeroImage(instanceId) {
		const root = canvasEl?.querySelector(`[data-instance-id="${instanceId}"]`);
		const media = root?.querySelector('[data-hero-media]');
		if (!(root instanceof HTMLElement) || !(media instanceof HTMLElement)) return null;
		const rootRect = root.getBoundingClientRect();
		const mediaRect = media.getBoundingClientRect();
		return {
			instanceId,
			top: mediaRect.top - rootRect.top,
			left: mediaRect.left - rootRect.left,
			width: mediaRect.width,
			height: mediaRect.height
		};
	}

	$effect(() => {
		const id = builder.selectedInstanceId;
		const block = builder.blocks.find((item) => item.id === id);
		const live = imageDrag?.instanceId === id ? imageDrag.liveWidth : null;
		if (!id || !block?.type.startsWith('hero.')) {
			imageFrame = null;
			return;
		}
		void live;
		void canvasWidth;
		void block.props.imageWidth;
		const apply = () => {
			imageFrame = measureHeroImage(id);
		};
		apply();
		const media = canvasEl?.querySelector(`[data-instance-id="${id}"] [data-hero-media]`);
		if (!(media instanceof HTMLElement)) return;
		const ro = new ResizeObserver(apply);
		ro.observe(media);
		return () => ro.disconnect();
	});

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 * @param {PageBlockInstance} instance
	 * @param {'left' | 'right'} side
	 */
	function startImageResize(event, instance, side) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		const media = canvasEl?.querySelector(`[data-instance-id="${instance.id}"] [data-hero-media]`);
		if (!(media instanceof HTMLElement)) return;
		const slot = heroImageSlotPx(media);
		const startWidth = media.getBoundingClientRect().width;
		imageDrag = {
			instanceId: instance.id,
			side,
			pointerId: event.pointerId,
			startX: event.clientX,
			startWidth,
			slot,
			defaultPx: heroImageDefaultPx(media, slot),
			liveWidth: startWidth
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onImageResizeMove(event) {
		if (!imageDrag || event.pointerId !== imageDrag.pointerId) return;
		const font = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		const dx = event.clientX - imageDrag.startX;
		const signed = imageDrag.side === 'right' ? dx : -dx;
		const liveWidth = snapHeroImagePx(imageDrag.startWidth + 2 * signed, imageDrag.slot, font);
		imageDrag = { ...imageDrag, liveWidth };
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function onImageResizeUp(event) {
		if (!imageDrag || event.pointerId !== imageDrag.pointerId) return;
		const font = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		const drag = imageDrag;
		imageDrag = null;
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// Already released.
		}
		builder.updateBlockProps(drag.instanceId, {
			imageWidth: heroImageWidthValue(drag.liveWidth, drag.defaultPx, font)
		});
	}

	/**
	 * @param {MouseEvent} event
	 * @param {string} instanceId
	 */
	function resetImageWidth(event, instanceId) {
		event.preventDefault();
		event.stopPropagation();
		imageDrag = null;
		builder.updateBlockProps(instanceId, { imageWidth: '' });
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

	/**
	 * @param {MouseEvent} event
	 */
	function clearCanvasSelection(event) {
		if (!(event.target instanceof Element) || event.target.closest('.instance')) return;
		builder.selectInstance(null);
		builder.selectChrome(null);
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	function onBuilderKeydown(event) {
		if (event.key !== 'Escape') return;
		if (event.target instanceof HTMLElement) {
			const tag = event.target.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;
		}
		builder.selectInstance(null);
		builder.selectChrome(null);
	}
</script>

<svelte:window onkeydown={onBuilderKeydown} />

<svelte:head>
	<title>{data.site.name || 'Site'} builder | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page" {@attach hydrateBuilder}>
	<main>
		<!-- Canvas click clears selection; Escape is handled below for keyboard. -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="canvas"
			aria-label="Site builder canvas"
			ondragover={onDragOver}
			onclick={clearCanvasSelection}
			role="region"
			{@attach measureCanvas}
		>
			<div class="console-status" role="status" aria-live="polite">
				<span class="lamp" data-state={consoleStatus} aria-hidden="true"></span>
				<span class="lcd-face label">{consoleStatus}</span>
			</div>
			<div
				class="preview"
				style="{previewStyle}{previewBackgroundCss ? `;${previewBackgroundCss}` : ''}"
			>
				{#if builder.header && HeaderBlock}
					<!-- Select overlay sits under the player so transport stays clickable. -->
					<div
						class="chrome instance"
						class:selected={builder.selectedChrome === 'header'}
						style={chromeAccentStyle(builder.headerAccent)}
					>
						<HeaderBlock
							{...builder.header.props}
							logoUrl={builder.logoUrl}
							showAppearanceToggle={builder.appearance === 'user'}
							resolvedAppearance={builder.previewAppearance}
							onAppearanceToggle={() => builder.togglePreviewAppearance()}
						/>
						<button
							type="button"
							class="chrome-select"
							aria-label="Select site header"
							aria-pressed={builder.selectedChrome === 'header'}
							onclick={() => builder.selectChrome('header')}
						></button>
					</div>
				{/if}

				<div class="stack">
					{#each builder.blocks as instance, index (instance.id)}
						{@const def = getBlockDefinition(instance.type)}
						{@const Block = def?.component}
						{@const maxWidthStyle = instanceMaxWidthStyle(instance)}
						{@const liveImageWidth =
							imageDrag?.instanceId === instance.id ? `${imageDrag.liveWidth}px` : null}
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
							data-instance-id={instance.id}
							class:selected={builder.selectedInstanceId === instance.id}
							class:resizing={resizeDrag?.instanceId === instance.id ||
								imageDrag?.instanceId === instance.id}
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
									{#if instance.type === 'catalog.profile' || instance.type === 'catalog.stream'}
										<Block
											{...instance.props}
											profileData={profileCatalog}
											profileList={profileCatalog ? profileCatalogList.current : null}
										/>
									{:else}
										<Block
											{...instance.props}
											{...liveImageWidth ? { imageWidth: liveImageWidth } : {}}
										/>
									{/if}
								{:else}
									<p class="missing">Unknown block: {instance.type}</p>
								{/if}
							</button>
							{#if builder.selectedInstanceId === instance.id && imageFrame?.instanceId === instance.id}
								<button
									type="button"
									class="resize-handle image"
									aria-label="Resize image from left"
									style:top="{imageFrame.top}px"
									style:left="{imageFrame.left}px"
									style:height="{imageFrame.height}px"
									onpointerdown={(e) => startImageResize(e, instance, 'left')}
									onpointermove={onImageResizeMove}
									onpointerup={onImageResizeUp}
									onpointercancel={onImageResizeUp}
									ondblclick={(e) => resetImageWidth(e, instance.id)}
								></button>
								<button
									type="button"
									class="resize-handle image"
									aria-label="Resize image from right"
									style:top="{imageFrame.top}px"
									style:left="{imageFrame.left + imageFrame.width}px"
									style:height="{imageFrame.height}px"
									onpointerdown={(e) => startImageResize(e, instance, 'right')}
									onpointermove={onImageResizeMove}
									onpointerup={onImageResizeUp}
									onpointercancel={onImageResizeUp}
									ondblclick={(e) => resetImageWidth(e, instance.id)}
								></button>
								{#if imageDrag?.instanceId === instance.id}
									<span
										class="image-size"
										style:top="{imageFrame.top + imageFrame.height}px"
										style:left="{imageFrame.left + imageFrame.width / 2}px"
									>
										{imageSizeLabel}
									</span>
								{/if}
							{/if}
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
							{/if}
							<button
								type="button"
								class="remove"
								aria-label="Remove block"
								tabindex={builder.selectedInstanceId === instance.id ? 0 : -1}
								onclick={() => builder.removeBlock(instance.id)}
							>
								<IconTrash size={15} stroke={1.75} aria-hidden="true" />
							</button>
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
							<div class="station-boot">
								<p class="boot-title lcd-face">STATION CONSOLE</p>
								<p class="boot-line">awaiting first block</p>
								<p class="boot-hint">drag from BLOCKS · or click a cartridge to append</p>
							</div>
						{/if}
					</div>
				</div>

				{#if builder.footer && FooterBlock}
					<div
						class="chrome instance"
						class:selected={builder.selectedChrome === 'footer'}
						style={chromeAccentStyle(builder.footerAccent)}
					>
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
			<div class="width-guides" class:active={!!resizeDrag} aria-hidden="true">
				{#each guideBreakpoints as w (w)}
					<span
						class="guide"
						class:snapped={resizeDrag?.liveWidth === w}
						style:left="calc(50% - {w / 2}px)"
					></span>
					<span
						class="guide"
						class:snapped={resizeDrag?.liveWidth === w}
						style:left="calc(50% + {w / 2}px)"
					></span>
				{/each}
			</div>
		</div>
	</main>

	<BuilderToolbar />
	<InspectorHud siteId={data.site.id} {form} logoMedia={data.logoMedia} />
	<BlocksHud />
	<MediaHud />
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
		position: relative;
		min-height: calc(100vh - 2rem);
		display: grid;
		align-content: start;
		gap: 1.25rem;
		padding: 1.5rem 1.25rem 4rem;
		/* Editor frame only — not the platform accent. HUDs keep SNDBNK chrome. */
		border: 1px dotted color-mix(in srgb, var(--ink) 28%, transparent);
		border-radius: 0;
		background: transparent;
		box-shadow: none;
	}

	.console-status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		justify-self: start;
		padding: 0.12rem 0.45rem 0.08rem;
		border: 1px solid var(--hard-border);
		border-radius: 0;
		background: var(--inverse);
		color: var(--on-inverse);
	}

	.lamp {
		flex-shrink: 0;
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--on-inverse) 55%, transparent);
		border-radius: 0;
		background: color-mix(in srgb, var(--muted) 70%, var(--inverse));
	}

	.lamp[data-state='LIVE'] {
		background: color-mix(in srgb, var(--accent) 42%, var(--inverse));
	}

	.lamp[data-state='DIRTY'] {
		background: color-mix(in srgb, var(--on-inverse) 35%, var(--inverse));
	}

	.lamp[data-state='SAVED'] {
		background: var(--accent);
	}

	.lamp[data-state='SAVING'] {
		background: var(--accent);
		animation: lamp-pulse 0.9s ease-in-out infinite;
	}

	.label {
		letter-spacing: 0.14em;
		text-transform: uppercase;
		font-size: 0.8rem;
		line-height: 1;
	}

	@keyframes lamp-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.32;
		}
	}

	.width-guides {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		opacity: 0;
		transition: opacity 150ms ease;
	}

	.width-guides.active {
		opacity: 1;
	}

	.guide {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 0;
		border-left: 1px dashed color-mix(in srgb, var(--accent) 42%, transparent);
		transform: translateX(-50%);
	}

	.guide.snapped {
		border-left-color: color-mix(in srgb, var(--accent) 88%, var(--ink));
	}

	@media (prefers-reduced-motion: reduce) {
		.width-guides {
			transition: none;
		}

		.lamp[data-state='SAVING'] {
			animation: none;
		}
	}

	.preview {
		display: grid;
		gap: 0;
		width: 100%;
		min-width: 0;
		/* Site theme tokens applied inline; isolate from listener dark/light on <html>. */
		border: 0;
		background-color: var(--paper);
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

	.station-boot {
		display: grid;
		gap: 0.2rem;
		justify-items: center;
		margin: 0;
		padding: 0.75rem 1rem;
		text-align: center;
	}

	.boot-title {
		margin: 0;
		color: var(--ink);
		letter-spacing: 0.16em;
		text-transform: uppercase;
		font-size: 1.15rem;
		line-height: 1.1;
	}

	.boot-line,
	.boot-hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.35;
	}

	.boot-hint {
		margin-top: 0.45rem;
	}

	.instance {
		position: relative;
		width: 100%;
		margin-inline: auto;
		outline: 1px solid transparent;
		background: var(--paper);
	}

	.instance:not(.selected):hover {
		outline: 1px dotted color-mix(in srgb, var(--ink) 28%, transparent);
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

	.resize-handle.image {
		z-index: 4;
		right: auto;
		bottom: auto;
		width: 0.7rem;
		transform: translateX(-50%);
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

	.image-size {
		position: absolute;
		z-index: 4;
		transform: translate(-50%, 0.4rem);
		padding: 0.12rem 0.4rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		white-space: nowrap;
		pointer-events: none;
	}

	.chrome {
		position: relative;
		margin-bottom: 0;
	}

	.chrome-select {
		position: absolute;
		inset: 0;
		z-index: 1;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	/* Clicks on the nav select the header. The player sits above that overlay. */
	.chrome :global(.block-header) {
		pointer-events: none;
	}

	.chrome :global(.header-player),
	.chrome :global(.header-player *) {
		pointer-events: auto;
	}

	.chrome :global(.header-player) {
		position: relative;
		z-index: 4;
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
		opacity: 0;
		pointer-events: none;
	}

	.instance:hover .remove,
	.instance.selected .remove {
		opacity: 1;
		pointer-events: auto;
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
