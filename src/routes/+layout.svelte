<script>
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { accent } from '#lib/stores/brand.js';
	import { initTheme } from '#lib/stores/theme.js';

	let { children } = $props();

	onMount(() => {
		initTheme();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="app-shell" style:--accent={$accent}>
	{@render children()}
</div>

<style>
	.app-shell {
		min-height: 100vh;
	}
</style>
