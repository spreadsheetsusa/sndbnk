<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   name?: string,
	 *   role?: string,
	 *   bio?: string,
	 *   imageLabel?: string,
	 *   heading?: string,
	 *   body?: string,
	 *   ctaLabel?: string,
	 *   ctaHref?: string
	 * }}
	 */
	let {
		name = 'Ada Frequency',
		role = 'Producer · Berlin',
		bio = 'Writes late-night techno and labels that stay out of the way.',
		imageLabel = 'Portrait',
		heading = 'From the desk',
		body = 'A short note on the release, the room it was made in, and where to hear it next.',
		ctaLabel = 'Read more',
		ctaHref = '/'
	} = $props();
</script>

<section class="content">
	<aside>
		<span class="avatar" aria-hidden="true"></span>
		<div>
			<p class="name">{name}</p>
			<p class="role">{role}</p>
			<p class="bio">{bio}</p>
		</div>
	</aside>
	<div class="main">
		<MediaPlaceholder label={imageLabel} ratio="16 / 10" />
		<h2>{heading}</h2>
		<p>{body}</p>
		<a class="cta accent-fill" href={ctaHref}>{ctaLabel}</a>
	</div>
</section>

<style>
	.content {
		display: grid;
		grid-template-columns: minmax(10rem, 0.85fr) 1.4fr;
		gap: 1.5rem;
		padding: 2rem 0;
	}

	@media (max-width: 800px) {
		.content {
			grid-template-columns: 1fr;
		}
	}

	aside {
		display: grid;
		gap: 0.75rem;
		align-content: start;
		padding-right: 1.25rem;
		border-right: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	@media (max-width: 800px) {
		aside {
			padding-right: 0;
			padding-bottom: 1rem;
			border-right: 0;
			border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		}
	}

	.avatar {
		width: 3.25rem;
		height: 3.25rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		background: color-mix(in srgb, var(--accent) 22%, var(--paper));
	}

	.name {
		margin: 0;
		font-weight: 500;
	}

	.role,
	.bio {
		margin: 0.25rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.4;
	}

	.main {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		align-content: start;
	}

	h2 {
		margin: 0.15rem 0 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.25rem, 2.2vw, 1.55rem);
		font-weight: 500;
	}

	.main > p {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
	}

	.cta {
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		text-decoration: none;
		font-size: 0.88rem;
	}
</style>
