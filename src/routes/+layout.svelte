<script>
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.png';
	import EqPanel from '#lib/components/player/EqPanel.svelte';
	import MilkdropWindow from '#lib/components/player/MilkdropWindow.svelte';
	import { eq } from '#lib/player/eq.svelte.js';
	import { setPlayThresholds } from '#lib/player/play-thresholds.js';
	import { visualizer } from '#lib/player/visualizer.svelte.js';
	import { resolveSiteAppearance } from '#lib/builder/site-appearance.js';
	import { buildPersonaPalette } from '#lib/builder/theme-persona.js';
	import { sitePlayerAccent } from '#lib/player/site-accent.svelte.js';
	import { ACCENTS, initAccent, normalizeHex } from '#lib/stores/brand.js';
	import { applyTheme, initTheme } from '#lib/stores/theme.js';

	let { data, children } = $props();

	const tenantLogo = $derived(data.tenantSite?.logoUrl ?? null);
	const tenantAccent = $derived(data.tenantSite?.accentColor ?? null);
	const tenantPersona = $derived(data.tenantSite?.themePersona ?? 'mono');
	const tenantPalette = $derived(data.tenantSite?.themePalette ?? null);
	const tenantAppearanceMode = $derived(
		data.tenantSite?.appearance === 'dark' || data.tenantSite?.appearance === 'user'
			? data.tenantSite.appearance
			: data.tenantSite
				? 'light'
				: null
	);
	const tenantSiteId = $derived(data.tenantSite?.id ?? null);

	/** Visitor-resolved light/dark when mode is `user`. */
	let tenantResolvedAppearance = $state(/** @type {'light' | 'dark' | null} */ (null));

	$effect(() => {
		setPlayThresholds(data.playThresholds);
	});

	onMount(() => {
		document.dispatchEvent(new Event('sndbnk:ready'));
		// Tenant hosts use site appearance; apex keeps the listener preference.
		if (!data.tenantSite) initTheme();
	});

	// Resolve locked or visitor appearance for tenant hosts.
	$effect(() => {
		if (!browser) return;
		const mode = tenantAppearanceMode;
		if (!mode) {
			tenantResolvedAppearance = null;
			return;
		}
		tenantResolvedAppearance = resolveSiteAppearance(mode, tenantSiteId);
	});

	// Published sites paint with the site theme, including when accentColor is unset
	// (the builder default). The listener accent store stays for sndbnk.com.
	$effect(() => {
		if (!browser) return;

		const root = document.documentElement;
		if (!data.tenantSite) {
			initAccent();
			return;
		}

		const seed = normalizeHex(tenantAccent) ?? ACCENTS[0].value;
		const palette = buildPersonaPalette(seed, tenantPersona, tenantPalette);
		sitePlayerAccent.hex = palette.accent;
		for (const [key, value] of Object.entries(palette.cssVars)) {
			root.style.setProperty(key, value);
		}

		return () => {
			sitePlayerAccent.hex = null;
			for (const key of Object.keys(palette.cssVars)) {
				root.style.removeProperty(key);
			}
			initAccent();
		};
	});

	// Artist-chosen light/dark (or visitor choice) for public tenant pages.
	$effect(() => {
		if (!browser) return;
		const appearance = tenantResolvedAppearance;
		if (!appearance) return;
		applyTheme(appearance);
	});
</script>

<svelte:head>
	{#if tenantLogo}
		<link rel="icon" href={tenantLogo} />
		<link rel="apple-touch-icon" href={tenantLogo} />
	{:else}
		<link rel="icon" type="image/png" sizes="64x64" href={favicon} />
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
