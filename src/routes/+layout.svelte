<script>
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import GlobalPlayerBar from '#lib/components/player/GlobalPlayerBar.svelte';
	import { initAccent } from '#lib/stores/brand.js';
	import { player } from '#lib/player/player.svelte.js';
	import { initTheme } from '#lib/stores/theme.js';

	let { children } = $props();

	onMount(() => {
		initTheme();
		initAccent();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="app-shell" class:has-player={player.current}>
	{@render children()}
	<GlobalPlayerBar />
</div>

<style>
	.app-shell {
		min-height: 100vh;
	}

	/* Keep page content clear of the fixed player bar. */
	.app-shell.has-player {
		padding-bottom: 4.5rem;
	}
</style>
