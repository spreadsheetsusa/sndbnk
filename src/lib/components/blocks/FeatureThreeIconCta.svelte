<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   items?: Array<{ title: string, body: string }>,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		heading = 'Everything a release needs',
		items = [
			{ title: 'Upload fast', body: 'Drop WAV, FLAC, or MP3 and keep moving.' },
			{ title: 'Waveforms that fit', body: 'Peaks generated async so pages stay snappy.' },
			{ title: 'Share anywhere', body: 'Profile, subdomain, or your own domain.' }
		],
		ctaLabel = 'Start uploading',
		ctaHref = '/'
	} = $props();
</script>

<section class="content">
	<h2>{heading}</h2>
	<div class="grid">
		{#each items as item (item.title)}
			<article>
				<span class="icon" aria-hidden="true"></span>
				<h3>{item.title}</h3>
				<p>{item.body}</p>
			</article>
		{/each}
	</div>
	<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
</section>

<style>
	.content {
		display: grid;
		gap: 1.25rem;
		justify-items: center;
		padding: 2rem 0;
		text-align: center;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		font-weight: 500;
		max-width: 28ch;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		width: 100%;
		text-align: left;
	}

	@media (max-width: 800px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	article {
		display: grid;
		gap: 0.35rem;
		align-content: start;
	}

	.icon {
		width: 1.5rem;
		height: 1.5rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: color-mix(in srgb, var(--accent) 18%, var(--paper));
	}

	h3 {
		margin: 0.2rem 0 0;
		font-size: 1rem;
		font-weight: 500;
	}

	p {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.4;
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
