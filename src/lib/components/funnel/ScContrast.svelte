<script>
	/**
	 * @type {{
	 *   eyebrow?: string,
	 *   leftLabel?: string,
	 *   leftBody?: string,
	 *   rightLabel?: string,
	 *   rightBody?: string,
	 *   line?: string
	 * }}
	 */
	let {
		eyebrow = 'Contrast',
		leftLabel = 'The feed you rent',
		leftBody = 'A rented feed. Their rules.',
		rightLabel = 'The station you run',
		rightBody = 'SNDBNK is a station you run. Your music is the product here.',
		line = 'Not another SoundCloud. Your station. Your rules.'
	} = $props();
</script>

<section class="contrast" aria-labelledby="sc-contrast-title">
	<div class="head">
		<p class="eyebrow accent-text eyebrow-chip">{eyebrow}</p>
		<h2 id="sc-contrast-title">{line}</h2>
	</div>

	<div class="panels">
		<article class="panel">
			<p class="lcd-face label">{leftLabel}</p>
			<p class="body">{leftBody}</p>
		</article>
		<article class="panel yours">
			<p class="lcd-face label">{rightLabel}</p>
			<p class="body">{rightBody}</p>
		</article>
	</div>
</section>

<style>
	.contrast {
		display: grid;
		gap: 1.25rem;
	}

	.head {
		display: grid;
		gap: 0.65rem;
	}

	.eyebrow {
		margin: 0;
		width: fit-content;
	}

	h2 {
		margin: 0;
		max-width: 22ch;
		font-family: var(--font-editorial);
		font-size: clamp(1.6rem, 3.4vw, 2.4rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.panels {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.panel {
		display: grid;
		gap: 0.7rem;
		padding: 1.25rem 1.3rem 1.4rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.panel.yours {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 10%, var(--paper));
	}

	.label {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.body {
		margin: 0;
		font-size: 1rem;
		line-height: 1.5;
	}

	@media (max-width: 640px) {
		.panels {
			grid-template-columns: 1fr;
		}
	}
</style>
