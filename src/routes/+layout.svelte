<script>
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import MilkdropWindow from '#lib/components/player/MilkdropWindow.svelte';
	import { setPlayThresholds } from '#lib/player/play-thresholds.js';
	import { visualizer } from '#lib/player/visualizer.svelte.js';
	import { initAccent, onAccentFor } from '#lib/stores/brand.js';
	import { initTheme } from '#lib/stores/theme.js';

	let { data, children } = $props();

	const tenantLogo = $derived(data.tenantSite?.logoUrl ?? null);
	const tenantAccent = $derived(data.tenantSite?.accentColor ?? null);

	$effect(() => {
		setPlayThresholds(data.playThresholds);
	});

	onMount(() => {
		initTheme();
	});

	// Tenant site accent overrides the listener store only while on a tenant host.
	// When absent, re-apply the listener accent from localStorage (also covers first paint).
	$effect(() => {
		if (!browser) return;

		const hex = tenantAccent;
		const root = document.documentElement;

		if (!hex) {
			initAccent();
			return;
		}

		root.style.setProperty('--accent', hex);
		root.style.setProperty('--on-accent', onAccentFor(hex));

		return () => {
			root.style.removeProperty('--accent');
			root.style.removeProperty('--on-accent');
		};
	});
</script>

<svelte:head>
	{#if tenantLogo}
		<link rel="icon" href={tenantLogo} />
		<link rel="apple-touch-icon" href={tenantLogo} />
	{:else}
		<link rel="icon" href={favicon} />
		<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	{/if}
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content={data.tenantSite?.name ?? 'SNDBNK'} />
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
