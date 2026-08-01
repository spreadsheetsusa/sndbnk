<script>
	import IconAlertCircle from '@tabler/icons-svelte-runes/icons/alert-circle';
	import IconCircleCheck from '@tabler/icons-svelte-runes/icons/circle-check';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.status === 'active' ? 'You are subscribed' : 'Finishing up'} | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<SiteHeader />

	<main class="shell">
		<section class="card" aria-labelledby="return-title">
			<span class="mark" class:ok={data.status === 'active'} aria-hidden="true">
				{#if data.status === 'active'}
					<IconCircleCheck size={22} stroke={1.75} />
				{:else}
					<IconAlertCircle size={22} stroke={1.75} />
				{/if}
			</span>

			{#if data.status === 'active'}
				<p class="eyebrow accent-text eyebrow-chip">Payment received</p>
				<h1 id="return-title" class="display-face">You're on {data.planLabel}.</h1>
				<p class="copy">
					Your subdomain and storage options are unlocked. Invoices and cancellation live in
					Settings → Billing.
				</p>
				<div class="actions">
					<a class="cta pressable" href="/library">Go to your library</a>
					<a class="cta ghost pressable" href="/settings?tab=billing">Billing settings</a>
				</div>
			{:else}
				<p class="eyebrow">Almost there</p>
				<h1 id="return-title" class="display-face">We're still confirming.</h1>
				<p class="copy" role="status">
					{data.message ??
						'Your bank has not finished authorizing the payment. This page is safe to reload — your plan updates as soon as Stripe confirms.'}
				</p>
				<div class="actions">
					<a class="cta pressable" href="/settings?tab=billing">Check billing status</a>
					<a class="cta ghost pressable" href="/plans">Back to plans</a>
				</div>
			{/if}
		</section>
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
	}

	.shell {
		width: min(100%, var(--site-content-max));
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 5rem;
	}

	.card {
		max-width: 34rem;
		padding: 2rem;
		border: 1px solid var(--hard-border);
		box-shadow: 6px 6px 0 var(--hard-shadow);
	}

	.mark {
		display: grid;
		width: 2.75rem;
		aspect-ratio: 1;
		margin-bottom: 1.25rem;
		place-items: center;
		border: 1px solid var(--ink);
		color: var(--ink);
	}

	.mark.ok {
		color: var(--on-accent);
		background: var(--accent);
	}

	.mark :global(svg) {
		display: block;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
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
