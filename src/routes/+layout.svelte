<script>
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import EqPanel from '#lib/components/player/EqPanel.svelte';
	import MilkdropWindow from '#lib/components/player/MilkdropWindow.svelte';
	import { eq } from '#lib/player/eq.svelte.js';
	import { setPlayThresholds } from '#lib/player/play-thresholds.js';
	import { visualizer } from '#lib/player/visualizer.svelte.js';
	import { initAccent, onAccentFor } from '#lib/stores/brand.js';
	import { applyTheme, initTheme } from '#lib/stores/theme.js';

	let { data, children } = $props();

	const tenantLogo = $derived(data.tenantSite?.logoUrl ?? null);
	const tenantAccent = $derived(data.tenantSite?.accentColor ?? null);
	const tenantAppearance = $derived(
		data.tenantSite?.appearance === 'dark' ? 'dark' : data.tenantSite ? 'light' : null
	);

	$effect(() => {
		setPlayThresholds(data.playThresholds);
	});

	onMount(() => {
		// Tenant hosts use site appearance; apex keeps the listener preference.
		if (!data.tenantSite) initTheme();
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

	// Artist-chosen light/dark for public tenant pages — not the listener SNDBNK theme.
	$effect(() => {
		if (!browser) return;
		const appearance = tenantAppearance;
		if (!appearance) return;
		applyTheme(appearance);
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
{#if eq.open}
	<EqPanel active={eq.open} />
{/if}
{#if visualizer.showWindow}
	<MilkdropWindow />
{/if}

<style>
	.app-shell {
		min-height: 100vh;
		min-height: 100dvh;
	}
</style>
