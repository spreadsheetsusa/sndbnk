<script>
	import CtaCartridge from '#lib/components/funnel/CtaCartridge.svelte';

	/**
	 * @type {{
	 *   eyebrow: string,
	 *   title: string,
	 *   lede: string,
	 *   primaryHref: string,
	 *   primaryLabel: string,
	 *   secondaryHref: string,
	 *   secondaryLabel: string,
	 *   titleId?: string,
	 *   rail?: import('svelte').Snippet,
	 *   support?: import('svelte').Snippet
	 * }}
	 */
	let {
		eyebrow,
		title,
		lede,
		primaryHref,
		primaryLabel,
		secondaryHref,
		secondaryLabel,
		titleId = 'funnel-hero-title',
		rail,
		support
	} = $props();
</script>

<section class="hero-bezel" aria-labelledby={titleId}>
	<div class="titlebar">
		<p class="eyebrow accent-text eyebrow-chip">{eyebrow}</p>
		<span class="lcd-face channel" aria-hidden="true">{eyebrow}</span>
	</div>

	<div class="hero-body">
		<div class="copy">
			<h1 id={titleId} class="display-face">{title}</h1>
			<p class="lede">{lede}</p>
			<div class="actions">
				<CtaCartridge href={primaryHref} label={primaryLabel} />
				<a class="text-action" href={secondaryHref}>{secondaryLabel}</a>
			</div>
			{#if support}
				<div class="support">
					{@render support()}
				</div>
			{/if}
		</div>

		<div class="rail">
			{#if rail}
				{@render rail()}
			{:else}
				<div class="no-signal" role="img" aria-label="No signal">
					<span class="lcd-face">NO SIGNAL</span>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.hero-bezel {
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
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

	.hero-body {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(12rem, 0.85fr);
		gap: clamp(1.5rem, 4vw, 3rem);
		align-items: center;
		padding: clamp(1.5rem, 4vw, 2.75rem);
	}

	h1 {
		margin: 0;
		max-width: 16ch;
		font-size: clamp(2.2rem, 6vw, 4.2rem);
		line-height: 0.9;
	}

	.lede {
		max-width: 36rem;
		margin: 1.15rem 0 0;
		color: var(--muted);
		font-size: clamp(1rem, 1.4vw, 1.2rem);
		line-height: 1.55;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		align-items: center;
		margin-top: 1.75rem;
	}

	.text-action {
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-underline-offset: 0.35rem;
	}

	.support {
		margin-top: 1rem;
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.45;
	}

	.support :global(p) {
		margin: 0;
	}

	.support :global(p + p) {
		margin-top: 0.35rem;
	}

	.support :global(a) {
		color: var(--ink);
		font-weight: 800;
	}

	.rail {
		min-width: 0;
	}

	.no-signal {
		display: grid;
		place-items: center;
		min-height: 12rem;
		border: 1px solid var(--hard-border);
		color: var(--on-inverse);
		background: var(--inverse);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.no-signal .lcd-face {
		font-size: clamp(1.6rem, 3vw, 2.2rem);
		letter-spacing: 0.18em;
	}

	@media (max-width: 960px) {
		.hero-body {
			grid-template-columns: 1fr;
		}

		h1 {
			max-width: 14ch;
		}
	}

	@media (max-width: 640px) {
		.hero-body {
			padding: 1.15rem;
		}

		.actions {
			gap: 1rem;
		}

		.text-action {
			width: 100%;
		}

		.no-signal {
			min-height: 8.5rem;
		}
	}
</style>
