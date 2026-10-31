<script>
	import { visualizer } from '#lib/player/visualizer.svelte.js';
</script>

{#if visualizer.supported}
	<button
		type="button"
		class={['visuals', { on: visualizer.enabled }]}
		aria-pressed={visualizer.enabled}
		onclick={() => visualizer.toggle()}
	>
		Visuals
	</button>
{/if}

<style>
	.visuals {
		margin-top: 0.4rem;
		padding: 0.34rem 0.8rem;
		border: 1px solid var(--ink);
		border-radius: 0.125rem;
		background: var(--paper);
		color: var(--ink);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		line-height: 1;
		cursor: pointer;
		box-shadow: 2px 2px 0 var(--hard-shadow);
	}

	.visuals:hover {
		border-color: var(--accent);
	}

	.visuals.on {
		color: var(--on-accent);
		background: var(--accent);
		border-color: var(--ink);
	}

	.visuals:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}
</style>
