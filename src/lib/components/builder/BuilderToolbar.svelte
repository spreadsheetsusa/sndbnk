<script>
	import IconLayoutGrid from '@tabler/icons-svelte-runes/icons/layout-grid';
	import { builder } from '#lib/builder/builder.svelte.js';
	import FloatingHud from '#lib/components/builder/FloatingHud.svelte';

	const blockActive = $derived(builder.tool === 'block');
</script>

<FloatingHud id="toolbar" brandHref="/settings">
	<div class="tools" role="toolbar" aria-label="Builder tools">
		<button
			type="button"
			class="tool"
			class:active={blockActive}
			aria-pressed={blockActive}
			title="Blocks"
			onclick={() => builder.toggleBlockTool()}
		>
			<IconLayoutGrid size={18} stroke={1.75} aria-hidden="true" />
			<span>Block</span>
		</button>
	</div>
</FloatingHud>

<style>
	.tools {
		display: grid;
		gap: 0.35rem;
		padding: 0.3rem 0.2rem;
	}

	.tool {
		display: grid;
		justify-items: center;
		gap: 0.15rem;
		padding: 0.35rem 0.2rem;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.5rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.tool:hover {
		color: var(--ink);
	}

	.tool.active {
		color: var(--accent);
		text-shadow: 0 0 8px color-mix(in srgb, var(--accent) 45%, transparent);
	}
</style>
