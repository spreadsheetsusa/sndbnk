<script>
	import { blockCatalog } from '#lib/components/block-previews/index.js';
</script>

<svelte:head>
	<title>Block previews | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<h1 class="display-face">Block previews</h1>
	<p class="intro">Smoke grid — delete <code>src/routes/dev/block-previews</code> when done.</p>
	<ul>
		{#each blockCatalog as entry (entry.id)}
			{@const Preview = entry.component}
			<li>
				<span class="name">{entry.id}</span>
				<div class="frame">
					<Preview />
				</div>
			</li>
		{/each}
	</ul>
</main>

<style>
	main {
		width: min(100% - 2 * var(--site-shell-pad-x), var(--site-shell-max));
		margin-inline: auto;
		padding-block: 1.5rem 3rem;
		display: grid;
		gap: 1rem;
	}

	.intro {
		margin: 0;
		color: var(--muted);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.75rem;
	}

	li {
		display: grid;
		gap: 0.35rem;
	}

	.name {
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.frame {
		border: 1px solid color-mix(in srgb, var(--ink) 24%, transparent);
		background: var(--paper);
	}
</style>
