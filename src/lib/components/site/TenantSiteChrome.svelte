<script>
	import { onMount } from 'svelte';
	import {
		resolveSiteAppearance,
		writeSiteVisitorAppearance
	} from '#lib/builder/site-appearance.js';
	import { chromeAccentStyle } from '#lib/builder/chrome-accent.js';
	import { backgroundStyle } from '#lib/builder/site-background.js';
	import { buildPersonaPalette } from '#lib/builder/theme-persona.js';
	import { getBlockDefinition } from '#lib/components/blocks/registry.js';
	import HeaderPlayer from '#lib/components/player/HeaderPlayer.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { ACCENTS, normalizeHex } from '#lib/stores/brand.js';
	import { applyTheme } from '#lib/stores/theme.js';

	/** @typedef {import('#lib/components/blocks/types.js').PageBlockInstance} PageBlockInstance */

	/**
	 * @type {{
	 *   site: {
	 *     id: string | null,
	 *     accentColor?: string | null,
	 *     appearance?: 'light' | 'dark' | 'user',
	 *     themePersona?: string,
	 *     themePalette?: import('#lib/builder/theme-persona.js').ThemeSlotColors | null,
	 *     logoUrl?: string | null,
	 *     headerAccent?: string | null,
	 *     footerAccent?: string | null,
	 *     background?: import('#lib/builder/site-background.js').SiteBackground | null,
	 *     backgroundUrl?: string | null,
	 *     header?: PageBlockInstance | null,
	 *     footer?: PageBlockInstance | null
	 *   },
	 *   children: import('svelte').Snippet
	 * }}
	 */
	let { site, children } = $props();

	const appearanceMode = $derived(
		site.appearance === 'dark' || site.appearance === 'user' ? site.appearance : 'light'
	);
	/** @type {'light' | 'dark' | null} */
	let visitorAppearance = $state(null);
	const resolvedAppearance = $derived(
		appearanceMode === 'user' ? (visitorAppearance ?? 'light') : appearanceMode
	);
	const palette = $derived(
		buildPersonaPalette(
			normalizeHex(site.accentColor ?? '') ?? ACCENTS[0].value,
			site.themePersona ?? 'mono',
			site.themePalette ?? null
		)
	);
	const themeStyle = $derived(
		[
			Object.entries(palette.cssVars)
				.map(([key, value]) => `${key}: ${value}`)
				.join('; '),
			backgroundStyle(site.background, site.backgroundUrl)
		]
			.filter(Boolean)
			.join('; ')
	);
	const headerDef = $derived(site.header ? getBlockDefinition(site.header.type) : null);
	const footerDef = $derived(site.footer ? getBlockDefinition(site.footer.type) : null);
	const HeaderBlock = $derived(headerDef?.component);
	const FooterBlock = $derived(footerDef?.component);

	onMount(() => {
		const appearance = resolveSiteAppearance(appearanceMode, site.id);
		visitorAppearance = appearance;
		applyTheme(appearance);
	});

	function toggleAppearance() {
		if (appearanceMode !== 'user') return;
		const next = resolvedAppearance === 'dark' ? 'light' : 'dark';
		visitorAppearance = next;
		writeSiteVisitorAppearance(site.id, next);
		applyTheme(next);
	}
</script>

<div class="tenant-site" style={themeStyle}>
	{#if site.header && HeaderBlock}
		<div class="chrome-accent" style={chromeAccentStyle(site.headerAccent)}>
			<HeaderBlock
				{...site.header.props}
				logoUrl={site.logoUrl ?? ''}
				showAppearanceToggle={appearanceMode === 'user'}
				{resolvedAppearance}
				onAppearanceToggle={toggleAppearance}
			/>
		</div>
	{:else if player.current}
		<div class="tenant-player">
			<div class="player-shell">
				<HeaderPlayer />
			</div>
		</div>
	{/if}

	{@render children()}

	{#if site.footer && FooterBlock}
		<div class="chrome-accent" style={chromeAccentStyle(site.footerAccent)}>
			<FooterBlock {...site.footer.props} />
		</div>
	{/if}
</div>

<style>
	.tenant-site {
		min-height: 100vh;
		color: var(--ink);
		background: var(--paper);
	}

	.tenant-player {
		position: sticky;
		top: 0;
		z-index: 40;
		padding: 0.55rem var(--site-shell-pad-x);
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background: color-mix(in srgb, var(--paper) 92%, transparent);
		backdrop-filter: blur(0.75rem);
	}

	.player-shell {
		display: flex;
		width: min(100%, var(--site-shell-max));
		margin-inline: auto;
	}

	.chrome-accent {
		display: contents;
	}
</style>
