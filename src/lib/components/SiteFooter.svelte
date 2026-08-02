<script>
	/**
	 * @type {{
	 *   bordered?: boolean
	 * }}
	 */
	let { bordered = false } = $props();

	const year = new Date().getFullYear();
</script>

<footer class:bordered>
	<div class="brand">
		<a class="logo display-face" href="/" aria-label="SNDBNK home">SNDBNK</a>
		<p class="credit">Built by The American Spreadsheet Co. 🤙</p>
	</div>

	<nav class="links" aria-label="Legal">
		<a href="/privacy">Privacy</a>
		<a href="/terms">Terms</a>
		<a href="/copyright">Copyright</a>
	</nav>

	<p class="copy">© {year} SNDBNK®. All rights reserved.</p>
</footer>

<style>
	footer {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem 2rem;
		align-items: end;
		padding: 2rem 0;
	}

	footer.bordered {
		margin-top: clamp(3rem, 10vw, 6rem);
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.brand {
		display: grid;
		gap: 0.35rem;
	}

	.logo {
		color: var(--ink);
		font-size: clamp(1.5rem, 2.5vw, 2.1rem);
		letter-spacing: 0.04em;
		text-decoration: none;
	}

	.credit,
	.copy {
		margin: 0;
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.4;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1.1rem;
		justify-content: end;
		grid-column: 2;
		grid-row: 1 / span 2;
		align-self: center;
	}

	.links a {
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.links a:hover {
		color: var(--ink);
	}

	.copy {
		grid-column: 1;
	}

	@media (max-width: 560px) {
		footer {
			grid-template-columns: 1fr;
		}

		.links {
			grid-column: auto;
			grid-row: auto;
			justify-content: start;
		}
	}
</style>
