<script>
	import IconArrowUpRight from '@tabler/icons-svelte-runes/icons/arrow-up-right';
	import PublicProfile from '#lib/components/PublicProfile.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import HeroSoundCard from '#lib/components/home/HeroSoundCard.svelte';
	import HeroVisualizer from '#lib/components/home/HeroVisualizer.svelte';
	import LatestMembers from '#lib/components/home/LatestMembers.svelte';
	import StatBadges from '#lib/components/home/StatBadges.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';
	import { webSiteJsonLd } from '#lib/seo.js';

	let { data } = $props();

	/** @type {HTMLElement | undefined} */
	let container;

	// Tenant hosts serve one profile from `/`; the marketing home has no paged
	// list, so this stays empty and inert there.
	const paged = restorableList(
		() => ({
			scope: 'profile',
			username: data.mode === 'tenant-profile' ? data.profile.username : null
		}),
		() => (data.mode === 'tenant-profile' ? data : { items: [], nextCursor: null }),
		() => container
	);

	export const snapshot = paged.snapshot;

	const shortName = $derived(
		data.mode === 'marketing'
			? (data.user?.name?.trim().split(/\s+/)[0] ?? data.user?.email?.split('@')[0] ?? 'Account')
			: 'Account'
	);

	const tenantSiteName = $derived(
		data.mode === 'tenant-profile' ? data.site?.name?.trim() || data.profile.name : null
	);

	const pageTitle = $derived(
		data.mode === 'tenant-profile'
			? `${tenantSiteName} (@${data.profile.username})`
			: 'SNDBNK | A place for sound'
	);

	const pageDescription = $derived(
		data.mode === 'tenant-profile'
			? data.site?.description?.trim() || `${data.profile.name} — a public profile for sound.`
			: 'An audio multi-tool for both artists and listeners.'
	);

	const seoCanonical = $derived(
		data.mode === 'tenant-profile'
			? `${data.siteOrigin}/users/${data.profile.username}`
			: `${data.siteOrigin}/`
	);

	const seoImage = $derived(
		data.mode === 'tenant-profile'
			? (data.site?.ogImageUrl ?? data.site?.logoUrl ?? data.profile.avatarUrl ?? null)
			: null
	);

	const seoType = $derived(data.mode === 'tenant-profile' ? 'profile' : 'website');

	const seoJsonLd = $derived(
		data.mode === 'tenant-profile'
			? webSiteJsonLd({
					origin: data.siteOrigin,
					description: pageDescription,
					name: tenantSiteName ?? data.profile.name,
					logo: data.site?.logoUrl ?? data.profile.avatarUrl ?? null
				})
			: webSiteJsonLd({ origin: data.siteOrigin, description: pageDescription })
	);
</script>

<SeoHead
	title={pageTitle}
	description={pageDescription}
	canonical={seoCanonical}
	origin={data.siteOrigin}
	image={seoImage}
	siteName={tenantSiteName}
	type={seoType}
	jsonLd={seoJsonLd}
/>

{#if data.mode === 'tenant-profile'}
	<div bind:this={container}>
		<PublicProfile {data} list={paged.current} />
	</div>
{:else}
	<div class="landing">
		<SiteHeader --site-header-gap="0" />

		<main>
			<section class="hero" aria-labelledby="hero-title">
				<HeroVisualizer />
				<div class="hero-copy">
					<p class="eyebrow">A place for sound</p>
					<h1 id="hero-title" class="display-face">Punch it in. <span>Turn it up.</span></h1>
					<p class="intro">An audio multi-tool for both artists and creative listeners.</p>
					{#if data.authNotice}
						<p class="auth-notice" role="status" aria-live="polite">{data.authNotice}</p>
					{/if}
					{#if data.user}
						<p class="welcome">Good to have you here, {shortName}.</p>
					{:else}
						<div class="hero-actions">
							<a class="primary-action pressable" href="/signup">
								Create account
								<IconArrowUpRight size={16} stroke={1.75} aria-hidden="true" />
							</a>
							<a class="text-action" href="/signin">Sign in</a>
						</div>
					{/if}
				</div>

				<div class="hero-card">
					<HeroSoundCard track={data.heroTrack} />
				</div>
			</section>

			{#if data.stats.trackCount > 0}
				<section class="stats">
					<StatBadges stats={data.stats} />
				</section>
			{/if}

			{#if data.latestMembers?.length}
				<section class="latest-members" aria-label="Latest members">
					<LatestMembers members={data.latestMembers} />
				</section>
			{/if}

			<section class="manifesto" aria-label="Our intention">
				<p class="eyebrow">Why we are here</p>
				<p class="manifesto-copy">
					Starting from what we know and are familiar with and taking it for a ride. Things will get
					weird here. SNDBNK is an Audio Multi-Tool built for vibes.
				</p>
				<span class="manifesto-mark" aria-hidden="true">///</span>
			</section>
		</main>

		<SiteFooter />
	</div>
{/if}

<style>
	.landing {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x);
		/* Not `overflow: hidden` — that makes a scroll container and breaks the sticky header. */
		overflow-x: clip;
	}

	.hero-actions {
		display: flex;
		align-items: center;
	}

	.hero {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(24rem, 1.1fr);
		gap: clamp(2rem, 5vw, 6rem);
		align-items: center;
		margin: 0;
		/* Inset copy + card from the Butterchurn edge; viz stays full-bleed via absolute inset. */
		padding: clamp(3rem, 7vw, 7rem) clamp(1.25rem, 3.5vw, 2.75rem);
		overflow: hidden;
	}

	.hero-copy,
	.hero-card {
		position: relative;
		z-index: 1;
	}

	.hero-copy > .eyebrow {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin: 0 0 1.5rem;
	}

	.hero-copy > .eyebrow::before {
		width: 2.75rem;
		height: 0.65rem;
		background: var(--accent);
		content: '';
	}

	h1 {
		max-width: 10ch;
		margin: 0;
		font-size: clamp(4.5rem, 8.4vw, 9rem);
		line-height: 0.78;
	}

	h1 span {
		display: block;
		color: transparent;
		-webkit-text-stroke: clamp(1px, 0.12vw, 2px) var(--ink);
	}

	.intro {
		max-width: 35rem;
		margin: clamp(2rem, 4vw, 3.5rem) 0 0;
		font-size: clamp(1rem, 1.4vw, 1.25rem);
		line-height: 1.55;
	}

	.hero-actions {
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.primary-action,
	.text-action {
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.primary-action {
		display: inline-flex;
		gap: 2rem;
		align-items: center;
		justify-content: space-between;
		min-width: 13rem;
		padding: 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		text-decoration: none;
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.text-action {
		text-underline-offset: 0.35rem;
	}

	.welcome {
		display: inline-block;
		margin: 2rem 0 0;
		padding: 0.8rem 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		font-weight: 800;
	}

	.auth-notice {
		width: fit-content;
		max-width: 35rem;
		margin: 2rem 0 0;
		padding: 0.9rem 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-weight: 800;
		line-height: 1.4;
	}

	.auth-notice + .welcome {
		margin-top: 1.25rem;
	}

	.stats {
		width: 100%;
		padding: clamp(2rem, 4vw, 3rem) 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.85s ease both;
	}

	.latest-members {
		width: 100%;
		padding: clamp(2rem, 4vw, 3rem) 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.85s ease both;
	}

	.manifesto {
		display: grid;
		grid-template-columns: 0.35fr 1fr auto;
		gap: 2rem;
		align-items: start;
		padding: clamp(3rem, 6vw, 6rem) 0;
		border-top: 1px solid var(--ink);
		border-bottom: 1px solid var(--ink);
	}

	.manifesto .eyebrow {
		margin: 0.65rem 0 0;
	}

	.manifesto-copy {
		max-width: 24ch;
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: clamp(2rem, 4vw, 4.5rem);
		line-height: 1.06;
	}

	.manifesto-mark {
		padding: 0.45rem 0.7rem;
		color: var(--on-accent);
		background: var(--accent);
		font-weight: 900;
		letter-spacing: 0.15em;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.6rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 960px) {
		.hero {
			grid-template-columns: 1fr;
		}

		h1 {
			max-width: 8ch;
			font-size: clamp(4.4rem, 18vw, 8rem);
		}
	}

	@media (max-width: 640px) {
		.hero {
			gap: 3rem;
			padding: 3.5rem 1.25rem 4.5rem;
		}

		h1 {
			font-size: clamp(4rem, 20vw, 6.5rem);
		}

		.intro {
			margin-top: 2rem;
		}

		.hero-actions {
			flex-wrap: wrap;
		}

		.primary-action {
			min-width: 100%;
		}
	}

	@media (max-width: 560px) {
		.manifesto {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.manifesto-copy {
			grid-column: auto;
			grid-row: auto;
		}

		.manifesto-mark {
			grid-column: auto;
			grid-row: auto;
			justify-self: start;
		}
	}
</style>
