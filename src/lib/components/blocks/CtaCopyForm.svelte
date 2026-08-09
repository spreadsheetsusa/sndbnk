<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   body?: string,
	 *   panelTitle?: string,
	 *   emailLabel?: string,
	 *   nameLabel?: string,
	 *   submitLabel?: string
	 * }}
	 */
	let {
		heading = 'Stay on the list',
		body = 'Drop drops, tour dates, and new mixes — no spam, just signal.',
		panelTitle = 'Join the mailing list',
		emailLabel = 'Email',
		nameLabel = 'Name',
		submitLabel = 'Subscribe'
	} = $props();
</script>

<section class="cta">
	<div class="copy">
		<h2>{heading}</h2>
		<p>{body}</p>
	</div>
	<form class="panel" onsubmit={(e) => e.preventDefault()}>
		<h3>{panelTitle}</h3>
		<label>
			<span>{nameLabel}</span>
			<input type="text" name="name" autocomplete="name" />
		</label>
		<label>
			<span>{emailLabel}</span>
			<input type="email" name="email" autocomplete="email" />
		</label>
		<button type="submit" class="accent-fill">{submitLabel}</button>
	</form>
</section>

<style>
	.cta {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		align-items: center;
		padding: 2rem 0;
	}

	@media (max-width: 720px) {
		.cta {
			grid-template-columns: 1fr;
		}
	}

	h2 {
		margin: 0 0 0.5rem;
		font-family: var(--font-editorial);
		font-size: clamp(1.4rem, 2.5vw, 1.85rem);
		font-weight: 500;
	}

	.copy p {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
		max-width: 36ch;
	}

	.panel {
		display: grid;
		gap: 0.65rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
	}

	h3 {
		margin: 0 0 0.2rem;
		font-size: 1rem;
		font-weight: 500;
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--muted);
	}

	input {
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--field-border);
		border-radius: 0.125rem;
		background: var(--field-surface);
		color: var(--ink);
	}

	button {
		margin-top: 0.2rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		cursor: pointer;
		font: inherit;
	}
</style>
