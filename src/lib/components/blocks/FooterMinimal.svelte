<script>
	/**
	 * @type {{
	 *   logoText?: string,
	 *   meta?: string,
	 *   rightMeta?: string
	 * }}
	 */
	let {
		logoText = 'SNDBNK',
		meta = 'Audio host for creators',
		rightMeta = 'sndbnk.com'
	} = $props();
</script>

<footer class="footer">
	<a class="logo" href="/">{logoText}</a>
	<span class="meta">{meta}</span>
	<span class="right">{rightMeta}</span>
</footer>

<style>
	.footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.85rem 1.25rem;
		padding: 1.1rem 1.25rem;
		border-top: 1px solid color-mix(in srgb, var(--theme-2, var(--ink)) 40%, transparent);
		background: color-mix(in srgb, var(--theme-5, var(--paper)) 55%, var(--paper));
		font-size: 0.88rem;
	}

	.logo {
		font-family: var(--font-display);
		color: var(--theme-4, var(--ink));
		text-decoration: none;
	}

	.meta {
		color: var(--theme-2, var(--muted));
	}

	.right {
		margin-left: auto;
		color: var(--muted);
	}
</style>
