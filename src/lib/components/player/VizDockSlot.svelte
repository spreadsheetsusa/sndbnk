<script>
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
</script>

{#if visible}
	<div
		class="viz-dock-slot"
		class:active={visualizer.dockHover}
		data-viz-dock={dockKey}
		style:height="{PANEL_VIZ_HEIGHT_REM}rem"
		aria-hidden="true"
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
