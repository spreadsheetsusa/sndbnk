<script>
	import IconChevronDown from '@tabler/icons-svelte-runes/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte-runes/icons/chevron-up';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import { builder } from '#lib/builder/builder.svelte.js';
	import { builderFloatStack } from '#lib/builder/float-stack.svelte.js';
	import { clampBounds, HUD_SPECS } from '#lib/builder/hud-bounds.js';
	import AccountMenu from '#lib/components/AccountMenu.svelte';

	/** Titlebar-only height used for viewport clamping while collapsed. */
	const COLLAPSED_H = 28;
	/** Pixels of pointer travel before a titlebar press becomes a drag. */
	const DRAG_THRESHOLD_PX = 7;

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

	/** @type {'pending-drag' | 'drag' | 'resize-se' | null} */
	let mode = $state(null);
	/** @type {number | null} */
	let pointerId = $state(null);
	let originX = 0;
	let originY = 0;
	let startX = 0;
	let startY = 0;
	let startW = 0;
	let startH = 0;
	/** Suppress the click that fires after a committed titlebar drag. */
	let suppressClick = false;
	/** @type {HTMLElement | null} */
	let titlebarEl = null;
	/** @type {ReturnType<typeof setTimeout> | null} */
	let suppressClickTimer = null;

	function clearTitlebarListeners() {
		window.removeEventListener('pointermove', onTitlebarPointerMove);
		window.removeEventListener('pointerup', onTitlebarPointerUp);
		window.removeEventListener('pointercancel', onTitlebarPointerUp);
	}

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
		return () => {
			window.removeEventListener('resize', onResize);
			clearTitlebarListeners();
			if (suppressClickTimer != null) clearTimeout(suppressClickTimer);
		};
	});

	/**
	 * Pending drag on titlebar: track on window, capture only after threshold so
	 * brand / account / collapse clicks still fire when movement stays under 7px.
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function onTitlebarPointerDown(event) {
		if (event.button !== 0) return;
		const target = event.target;
		// Dropdown panels live in the titlebar DOM; never treat those presses as drags.
		if (target instanceof Element && target.closest('.account-panel')) return;
		if (suppressClickTimer != null) {
			clearTimeout(suppressClickTimer);
			suppressClickTimer = null;
		}
		suppressClick = false;
		mode = 'pending-drag';
		pointerId = event.pointerId;
		originX = event.clientX;
		originY = event.clientY;
		startX = x;
		startY = y;
		titlebarEl = event.currentTarget;
		window.addEventListener('pointermove', onTitlebarPointerMove);
		window.addEventListener('pointerup', onTitlebarPointerUp);
		window.addEventListener('pointercancel', onTitlebarPointerUp);
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onTitlebarPointerMove(event) {
		if (pointerId == null || event.pointerId !== pointerId) return;
		if (mode === 'pending-drag') {
			const dist = Math.hypot(event.clientX - originX, event.clientY - originY);
			if (dist < DRAG_THRESHOLD_PX) return;
			mode = 'drag';
			suppressClick = true;
			try {
				titlebarEl?.setPointerCapture(event.pointerId);
			} catch {
				// Capture optional once drag is committed.
			}
			event.preventDefault();
		}
		if (mode !== 'drag') return;
		applyBounds({
			x: startX + (event.clientX - originX),
			y: startY + (event.clientY - originY),
			w,
			h
		});
	}

	/**
	 * @param {PointerEvent} event
	 */
	function onTitlebarPointerUp(event) {
		if (pointerId == null || event.pointerId !== pointerId) return;
		const wasDrag = mode === 'drag';
		mode = null;
		pointerId = null;
		clearTitlebarListeners();
		try {
			titlebarEl?.releasePointerCapture(event.pointerId);
		} catch {
			// Already released or never captured.
		}
		titlebarEl = null;
		if (!wasDrag) return;
		suppressClick = true;
		suppressClickTimer = setTimeout(() => {
			suppressClick = false;
			suppressClickTimer = null;
		}, 0);
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
	function onResizePointerMove(event) {
		if (pointerId == null || event.pointerId !== pointerId || mode !== 'resize-se') return;
		const nextH = spec.lockH ? h : startH + (event.clientY - originY);
		applyBounds({ x: startX, y: startY, w: startW + (event.clientX - originX), h: nextH });
	}

	/**
	 * @param {PointerEvent & { currentTarget: HTMLElement }} event
	 */
	function onResizePointerUp(event) {
		if (pointerId == null || event.pointerId !== pointerId) return;
		mode = null;
		pointerId = null;
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// Already released.
		}
	}

	/**
	 * @param {MouseEvent} event
	 */
	function onTitlebarClickCapture(event) {
		if (!suppressClick) return;
		suppressClick = false;
		if (suppressClickTimer != null) {
			clearTimeout(suppressClickTimer);
			suppressClickTimer = null;
		}
		event.preventDefault();
		event.stopPropagation();
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
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="hud-titlebar"
		onpointerdown={onTitlebarPointerDown}
		onclickcapture={onTitlebarClickCapture}
	>
		<div class="hud-leading">
			{#if brandHref}
				<a class="hud-brand" href={brandHref} aria-label="Exit builder to settings">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 64 64"
						width="14"
						height="14"
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
		<div class="hud-actions">
			{#if brandHref}
				<AccountMenu align="end" avatarSize="1.1rem" idPrefix="builder-account" compact />
			{/if}
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
						<IconChevronDown size={12} stroke={1.75} aria-hidden="true" />
					{:else}
						<IconChevronUp size={12} stroke={1.75} aria-hidden="true" />
					{/if}
				</button>
			{/if}
			{#if onclose}
				<button type="button" class="hud-close" aria-label="Close {panelLabel}" onclick={onclose}>
					<IconX size={12} stroke={1.75} aria-hidden="true" />
				</button>
			{/if}
		</div>
	</div>
	<div class="hud-body" inert={collapsed || undefined}>
		{@render children()}
	</div>
	{#if resizable && !collapsed}
		<button
			type="button"
			class="resize-se"
			aria-label="Resize {panelLabel}"
			onpointerdown={startResize}
			onpointermove={onResizePointerMove}
			onpointerup={onResizePointerUp}
			onpointercancel={onResizePointerUp}
		></button>
	{/if}
</section>

<style>
	.floating-hud {
		position: fixed;
		display: grid;
		grid-template-rows: auto 1fr;
		overflow: visible;
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
		gap: 0.25rem;
		padding: 0.15rem 0.3rem;
		overflow: visible;
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
		overflow: visible;
	}

	.hud-brand {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 0.95rem;
		height: 0.95rem;
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
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink);
		line-height: 1;
		min-width: 0;
	}

	.hud-actions {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		margin-inline-start: auto;
	}

	.hud-actions :global(.account-wrap) {
		flex-shrink: 0;
	}

	.hud-close {
		display: grid;
		place-items: center;
		width: 1rem;
		height: 1rem;
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
