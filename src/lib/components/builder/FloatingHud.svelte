<script>
	import IconChevronDown from '@tabler/icons-svelte-runes/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte-runes/icons/chevron-up';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import { builder } from '#lib/builder/builder.svelte.js';
	import { builderFloatStack } from '#lib/builder/float-stack.svelte.js';
	import { clampBounds, HUD_SPECS } from '#lib/builder/hud-bounds.js';

	/** Titlebar-only height used for viewport clamping while collapsed. */
	const COLLAPSED_H = 40;

	/**
	 * @type {{
	 *   id: import('#lib/builder/hud-bounds.js').BuilderHudId,
	 *   title?: string,
	 *   brandHref?: string | null,
	 *   resizable?: boolean,
	 *   collapsible?: boolean,
	 *   onclose?: () => void,
	 *   children: import('svelte').Snippet,
	 *   actions?: import('svelte').Snippet
	 * }}
	 */
	let {
		id,
		title = '',
		brandHref = null,
		resizable = false,
		collapsible = false,
		onclose,
		children,
		actions
	} = $props();

	const hasTitle = $derived(Boolean(title.trim()));
	const panelLabel = $derived(hasTitle ? title : 'Panel');

	const spec = $derived(HUD_SPECS[id]);
	const z = $derived(builderFloatStack[id]);

	let x = $state(0);
	let y = $state(0);
	let w = $state(280);
	let h = $state(200);
	let collapsed = $state(false);

	/** @type {'drag' | 'resize-se' | null} */
	let mode = $state(null);
	/** @type {number | null} */
	let pointerId = $state(null);
	let originX = 0;
	let originY = 0;
	let startX = 0;
	let startY = 0;
	let startW = 0;
	let startH = 0;

	/**
	 * @param {import('#lib/builder/hud-bounds.js').HudBounds} bounds
	 */
	function applyBounds(bounds) {
		if (!browser) return;
		const viewport = { innerWidth: window.innerWidth, innerHeight: window.innerHeight };
		if (collapsed) {
			const next = clampBounds(
				{ x: bounds.x, y: bounds.y, w: bounds.w, h: COLLAPSED_H },
				{ minW: spec.minW, minH: COLLAPSED_H, lockH: true },
				viewport
			);
			x = next.x;
			y = next.y;
			w = next.w;
			builder.persistHudBounds(id, { x, y, w, h });
			return;
		}
		const next = clampBounds(bounds, spec, viewport);
		x = next.x;
		y = next.y;
		w = next.w;
		h = next.h;
		builder.persistHudBounds(id, next);
	}

	function toggleCollapsed() {
		if (!collapsible) return;
		if (collapsed) {
			collapsed = false;
			applyBounds({ x, y, w, h });
			return;
		}
		collapsed = true;
		applyBounds({ x, y, w, h });
	}

	onMount(() => {
		builderFloatStack.raise(id);
		applyBounds(builder.resolveHudBounds(id));
		const onResize = () => applyBounds({ x, y, w, h });
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function startDrag(event) {
		if (event.button !== 0) return;
		const target = event.target;
		if (!(target instanceof Element) || target.closest('[data-builder-no-drag]')) return;
		mode = 'drag';
		pointerId = event.pointerId;
		originX = event.clientX;
		originY = event.clientY;
		startX = x;
		startY = y;
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function startResize(event) {
		if (event.button !== 0 || !resizable) return;
		mode = 'resize-se';
		pointerId = event.pointerId;
		originX = event.clientX;
		originY = event.clientY;
		startX = x;
		startY = y;
		startW = w;
		startH = h;
		event.currentTarget.setPointerCapture(event.pointerId);
		event.stopPropagation();
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onPointerMove(event) {
		if (pointerId == null || event.pointerId !== pointerId || !mode) return;
		const dx = event.clientX - originX;
		const dy = event.clientY - originY;
		if (mode === 'drag') {
			applyBounds({ x: startX + dx, y: startY + dy, w, h });
			return;
		}
		if (mode === 'resize-se') {
			const nextH = spec.lockH ? h : startH + dy;
			applyBounds({ x: startX, y: startY, w: startW + dx, h: nextH });
		}
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function onPointerUp(event) {
		if (pointerId == null || event.pointerId !== pointerId) return;
		mode = null;
		pointerId = null;
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// Already released.
		}
	}
</script>

<section
	class="floating-hud"
	class:resizing={mode === 'resize-se'}
	class:dragging={mode === 'drag'}
	class:collapsed
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height={collapsed ? 'auto' : `${h}px`}
	style:z-index={z}
	aria-label={panelLabel}
	onpointerdowncapture={() => builderFloatStack.raise(id)}
	onpointerdown={startDrag}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
>
	<header class="hud-titlebar">
		<div class="hud-leading">
			{#if brandHref}
				<a
					class="hud-brand"
					href={brandHref}
					aria-label="Exit builder to settings"
					data-builder-no-drag
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 64 64"
						width="16"
						height="16"
						aria-hidden="true"
					>
						<path
							d="M8 32h8l4-10 6 21 6-30 7 39 6-26 5 15 4-9h2"
							fill="none"
							stroke="currentColor"
							stroke-linejoin="bevel"
							stroke-width="4"
						/>
					</svg>
				</a>
			{/if}
			{#if hasTitle}
				<span class="hud-title lcd-face">{title}</span>
			{/if}
		</div>
		<div class="hud-actions" data-builder-no-drag>
			{#if actions}
				{@render actions()}
			{/if}
			{#if collapsible}
				<button
					type="button"
					class="hud-close"
					aria-label={collapsed ? `Expand ${panelLabel}` : `Collapse ${panelLabel}`}
					aria-expanded={!collapsed}
					onclick={toggleCollapsed}
				>
					{#if collapsed}
						<IconChevronDown size={14} stroke={1.75} aria-hidden="true" />
					{:else}
						<IconChevronUp size={14} stroke={1.75} aria-hidden="true" />
					{/if}
				</button>
			{/if}
			{#if onclose}
				<button type="button" class="hud-close" aria-label="Close {panelLabel}" onclick={onclose}>
					<IconX size={14} stroke={1.75} aria-hidden="true" />
				</button>
			{/if}
		</div>
	</header>
	<div class="hud-body" data-builder-no-drag inert={collapsed || undefined}>
		{@render children()}
	</div>
	{#if resizable && !collapsed}
		<button
			type="button"
			class="resize-se"
			aria-label="Resize {panelLabel}"
			data-builder-no-drag
			onpointerdown={startResize}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		></button>
	{/if}
</section>

<style>
	.floating-hud {
		position: fixed;
		display: grid;
		grid-template-rows: auto 1fr;
		background: var(--paper);
		border: 1px solid var(--hard-border);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		user-select: none;
		min-width: 0;
		min-height: 0;
	}

	.floating-hud.collapsed {
		grid-template-rows: auto;
	}

	.floating-hud.dragging,
	.floating-hud.resizing {
		cursor: grabbing;
	}

	.hud-titlebar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.35rem;
		padding: 0.35rem 0.4rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		background: color-mix(in srgb, var(--ink) 6%, var(--paper));
		cursor: grab;
	}

	.floating-hud.collapsed .hud-titlebar {
		border-bottom: 0;
	}

	.floating-hud.dragging .hud-titlebar {
		cursor: grabbing;
	}

	.hud-leading {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
	}

	.hud-brand {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.1rem;
		height: 1.1rem;
		color: var(--accent);
		line-height: 0;
		cursor: pointer;
	}

	.hud-brand:hover {
		filter: brightness(1.12);
	}

	.hud-brand:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.hud-brand svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.hud-title {
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink);
		line-height: 1;
		min-width: 0;
	}

	.hud-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.hud-close {
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		padding: 0;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
	}

	.hud-close:hover {
		background: color-mix(in srgb, var(--accent) 22%, var(--paper));
	}

	.hud-body {
		min-height: 0;
		min-width: 0;
		overflow: auto;
		cursor: default;
	}

	.floating-hud.collapsed .hud-body {
		display: none;
	}

	.resize-se {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 14px;
		height: 14px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: nwse-resize;
	}

	.resize-se::after {
		content: '';
		position: absolute;
		right: 3px;
		bottom: 3px;
		width: 8px;
		height: 8px;
		border-right: 1px solid var(--ink);
		border-bottom: 1px solid var(--ink);
	}
</style>
