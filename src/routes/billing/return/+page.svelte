<script>
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	let { data } = $props();

	const ownsDomain = $derived(data.status === 'active' && data.ownsCustomDomain);
	const channel = $derived(data.status !== 'active' ? 'HOLD' : ownsDomain ? 'OWN IT' : 'ON AIR');
	const eyebrow = $derived(data.status !== 'active' ? 'Billing' : (data.planLabel ?? 'Plan'));
	const title = $derived(
		data.status !== 'active'
			? 'Still confirming.'
			: ownsDomain
				? 'Your name. Your domain.'
				: 'Catalog unlocked.'
	);
	const pageTitle = $derived(
		data.status === 'active' ? `${data.planLabel} is live` : 'Still confirming'
	);
</script>

<svelte:head>
	<title>{pageTitle} | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<SiteHeader />

	<main class="shell">
		<section class="bezel" aria-labelledby="return-title">
			<div class="titlebar">
				<p class="eyebrow accent-text eyebrow-chip">{eyebrow}</p>
				<span class="lcd-face channel" aria-hidden="true">{channel}</span>
			</div>

			<div class="body">
				<h1 id="return-title" class="display-face">{title}</h1>

				{#if data.status === 'active'}
					{#if ownsDomain}
						<p class="copy">
							Point a domain at SNDBNK so listeners land on you. Chrome-off and the builder stay in
							Settings.
						</p>
						<div class="actions">
							<a class="cta pressable" href="/settings?tab=domain">Set up your domain</a>
							<a class="cta ghost pressable" href="/library">Library</a>
							{#if data.siteHref}
								<a class="cta ghost pressable" href={data.siteHref}>Station builder</a>
							{/if}
						</div>
					{:else}
						<p class="copy">
							Unlimited tracks and your subdomain are live. Invoices and cancellation live in
							Settings → Billing.
						</p>
						<div class="actions">
							<a class="cta pressable" href="/library">Go to your library</a>
							<a class="cta ghost pressable" href="/settings?tab=billing">Billing settings</a>
						</div>
					{/if}
				{:else}
					<p class="copy" role="status">
						{data.message ??
							'The bank has not finished authorizing. This page is safe to reload — the plan updates when Stripe confirms.'}
					</p>
					<div class="actions">
						<a class="cta pressable" href="/settings?tab=billing">Check billing status</a>
						<a class="cta ghost pressable" href="/plans">Back to plans</a>
					</div>
				{/if}
			</div>
		</section>
	</main>
</div>

<style>
	.page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 5rem;
	}

	.shell {
		width: min(100%, var(--site-content-max));
		margin: 0 auto;
	}

	.bezel {
		max-width: 34rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 6px 6px 0 var(--hard-shadow);
	}

	.titlebar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.35rem 0.65rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		background: color-mix(in srgb, var(--ink) 6%, var(--paper));
	}

	.eyebrow {
		margin: 0;
	}

	.channel {
		color: var(--muted);
		font-size: 0.85rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.body {
		padding: 1.5rem 1.5rem 1.75rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		line-height: 0.95;
	}

	.copy {
		margin: 1.1rem 0 0;
		color: var(--muted);
		line-height: 1.55;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		margin-top: 2rem;
	}

	.cta {
		padding: 0.85rem 1.2rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		text-decoration: none;
	}

	.cta.ghost {
		border-color: var(--hard-border);
		color: var(--ink);
		background: transparent;
	}

	@media (pointer: coarse) {
		.actions .pressable {
			min-height: var(--tap-min);
		}
	}
</style>
