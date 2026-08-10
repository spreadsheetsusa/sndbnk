<script>
	/**
	 * @type {{
	 *   heading?: string,
	 *   nameLabel?: string,
	 *   emailLabel?: string,
	 *   messageLabel?: string,
	 *   submitLabel?: string
	 * }}
	 */
	let {
		heading = 'Say hello',
		nameLabel = 'Name',
		emailLabel = 'Email',
		messageLabel = 'Message',
		submitLabel = 'Send message'
	} = $props();
</script>

<section class="contact">
	<h2>{heading}</h2>
	<form onsubmit={(e) => e.preventDefault()}>
		<div class="row">
			<label>
				<span>{nameLabel}</span>
				<input type="text" name="name" autocomplete="name" />
			</label>
			<label>
				<span>{emailLabel}</span>
				<input type="email" name="email" autocomplete="email" />
			</label>
		</div>
		<label>
			<span>{messageLabel}</span>
			<textarea name="message" rows="4"></textarea>
		</label>
		<button type="submit" class="accent-fill">{submitLabel}</button>
	</form>
</section>

<style>
	.contact {
		display: grid;
		gap: 1rem;
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

	form {
		display: grid;
		gap: 0.65rem;
		width: min(100%, 28rem);
		padding: 1rem;
		text-align: left;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
	}

	@media (max-width: 520px) {
		.row {
			grid-template-columns: 1fr;
		}
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--muted);
	}

	input,
	textarea {
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--field-border);
		border-radius: 0.125rem;
		background: var(--field-surface);
		color: var(--ink);
		font: inherit;
	}

	textarea {
		resize: vertical;
		min-height: 5.5rem;
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
