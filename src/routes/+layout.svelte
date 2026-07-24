<script>
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { accent } from '#lib/stores/brand.js';

	let { children } = $props();
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
