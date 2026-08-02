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

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="SNDBNK" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
</svelte:head>
<div class="app-shell">
	{@render children()}
</div>
{#if visualizer.enabled}
	<MilkdropWindow />
{/if}

<style>
	.app-shell {
		min-height: 100vh;
		min-height: 100dvh;
	}
</style>
