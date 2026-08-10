<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   tabs?: Array<{ label: string, title: string, body: string }>,
	 *   activeIndex?: number | string,
	 *   imageLabel?: string
	 * }}
	 */
	let {
		tabs = [
			{
				label: 'Upload',
				title: 'Drop audio into the library',
				body: 'Files land in your catalog with metadata pulled from tags.'
			},
			{
				label: 'Edit',
				title: 'Tune the deck inline',
				body: 'Title, artist, genres, and cover art without leaving the page.'
			},
			{
				label: 'Publish',
				title: 'Go live on your terms',
				body: 'Flip publish when the mix is ready for the feed and your site.'
			},
			{
				label: 'Share',
				title: 'Send listeners anywhere',
				body: 'Profile link, subdomain, custom domain, or embed the player.'
			}
		],
		activeIndex = 0,
		imageLabel = 'Step preview'
	} = $props();

	const index = $derived(Math.max(0, Number(activeIndex) || 0));
	const active = $derived(tabs[index] ?? tabs[0]);
</script>

<section class="content">
	<div class="tabs" role="tablist" aria-label="Steps">
		{#each tabs as tab, i (tab.label)}
			<span class="tab" class:active={i === index} role="tab" aria-selected={i === index}>
				{tab.label}
			</span>
		{/each}
	</div>
	<div class="media">
		<MediaPlaceholder label={imageLabel} ratio="16 / 10" />
	</div>
	<div class="copy">
		<h2>{active.title}</h2>
		<p>{active.body}</p>
	</div>
</section>

<style>
	.content {
		display: grid;
		gap: 1.25rem;
		justify-items: center;
		padding: 2rem 0;
		text-align: center;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
	}

	.tab {
		padding: 0.4rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
		font-size: 0.82rem;
		color: var(--muted);
	}

	.tab.active {
		color: var(--on-accent);
		background: var(--accent);
		border-color: var(--ink);
	}

	.media {
		width: 100%;
	}

	.copy {
		display: grid;
		gap: 0.5rem;
		max-width: 42ch;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.25rem, 2.2vw, 1.55rem);
		font-weight: 500;
	}

	p {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
		font-size: 0.92rem;
	}
</style>
