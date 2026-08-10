<script>
	import { cubicOut } from 'svelte/easing';
	import { PANEL_VIZ_HEIGHT_REM } from '#lib/player/window-snap.js';
	import { visualizer } from '#lib/player/visualizer.svelte.js';

	/**
	 * @type {{
	 *   dockKey: string
	 * }}
	 */
	let { dockKey } = $props();

	const visible = $derived(visualizer.showWindow && visualizer.draggingWindow);

	/** @type {import('svelte/attachments').Attachment} */
	function dockAttach(node) {
		visualizer.registerDockSlot(node);
		return () => visualizer.unregisterDockSlot(node);
	}

	/**
	 * Slide height + fade (Svelte allows only one in:/out: per element).
	 * @param {HTMLElement} node
	 * @param {{ duration?: number }} [params]
	 */
	function slideFade(node, { duration = 180 } = {}) {
		const style = getComputedStyle(node);
		const opacity = +style.opacity;
		const height = parseFloat(style.height);
		const paddingTop = parseFloat(style.paddingTop);
		const paddingBottom = parseFloat(style.paddingBottom);
		const marginTop = parseFloat(style.marginTop);
		const marginBottom = parseFloat(style.marginBottom);
		const borderTopWidth = parseFloat(style.borderTopWidth);
		const borderBottomWidth = parseFloat(style.borderBottomWidth);

		return {
			duration,
			easing: cubicOut,
			css: (t) =>
				`overflow: hidden; opacity: ${t * opacity}; height: ${t * height}px;` +
				`padding-top: ${t * paddingTop}px; padding-bottom: ${t * paddingBottom}px;` +
				`margin-top: ${t * marginTop}px; margin-bottom: ${t * marginBottom}px;` +
				`border-top-width: ${t * borderTopWidth}px; border-bottom-width: ${t * borderBottomWidth}px;`
		};
	}
</script>

{#if visible}
	<div
		class="viz-dock-slot"
		class:active={visualizer.dockHover}
		data-viz-dock={dockKey}
		style:height="{PANEL_VIZ_HEIGHT_REM}rem"
		aria-hidden="true"
		in:slideFade={{ duration: 180 }}
		out:slideFade={{ duration: 140 }}
		{@attach dockAttach}
	></div>
{/if}

<style>
	.viz-dock-slot {
		box-sizing: border-box;
		width: 100%;
		flex: 0 0 auto;
		border: 1px dashed color-mix(in srgb, var(--ink) 32%, transparent);
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--ink) 4%, transparent);
		pointer-events: none;
	}

	.viz-dock-slot.active {
		border-color: color-mix(in srgb, var(--accent) 65%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	:global(html.dark) .viz-dock-slot {
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}

	:global(html.dark) .viz-dock-slot.active {
		border-color: color-mix(in srgb, var(--accent) 72%, transparent);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}
</style>
