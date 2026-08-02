<script>
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import MilkdropWindow from '#lib/components/player/MilkdropWindow.svelte';
	import { visualizer } from '#lib/player/visualizer.svelte.js';
	import { initAccent } from '#lib/stores/brand.js';
	import { initTheme } from '#lib/stores/theme.js';

	let { children } = $props();

	onMount(() => {
		initTheme();
		initAccent();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="app-shell">
	{@render children()}
</div>
{#if visualizer.enabled}
	<MilkdropWindow />
{/if}

<style>
	.app-shell {
		min-height: 100vh;
	}
</style>
