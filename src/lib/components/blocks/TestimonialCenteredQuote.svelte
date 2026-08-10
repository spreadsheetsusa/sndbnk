<script>
	/**
	 * @type {{
	 *   quote?: string,
	 *   name?: string,
	 *   role?: string
	 * }}
	 */
	let {
		quote = 'Finally a host that treats long mixes like first-class citizens — waveforms, domains, and a player that keeps up.',
		name = 'Echo Unit',
		role = 'Label owner · Berlin'
	} = $props();
</script>

<section class="content">
	<blockquote>
		<p>&ldquo;{quote}&rdquo;</p>
		<footer>
			<p class="name">{name}</p>
			<p class="role">{role}</p>
		</footer>
	</blockquote>
</section>

<style>
	.content {
		display: grid;
		justify-items: center;
		padding: 2rem 0;
		text-align: center;
	}

	blockquote {
		margin: 0;
		display: grid;
		gap: 1rem;
		max-width: 42rem;
	}

	blockquote > p {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.15rem, 2.4vw, 1.45rem);
		font-weight: 500;
		line-height: 1.45;
	}

	footer {
		display: grid;
		gap: 0.2rem;
	}

	.name {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 500;
	}

	.role {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
	}
</style>
