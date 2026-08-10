<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   mapLabel?: string,
	 *   heading?: string,
	 *   nameLabel?: string,
	 *   emailLabel?: string,
	 *   messageLabel?: string,
	 *   submitLabel?: string
	 * }}
	 */
	let {
		mapLabel = 'Map',
		heading = 'Book a session',
		nameLabel = 'Name',
		emailLabel = 'Email',
		messageLabel = 'Message',
		submitLabel = 'Send'
	} = $props();
</script>

<section class="contact">
	<div class="map">
		<MediaPlaceholder label={mapLabel} ratio="4 / 3" />
	</div>
	<form class="form" onsubmit={(e) => e.preventDefault()}>
		<h2>{heading}</h2>
		<label>
			<span>{nameLabel}</span>
			<input type="text" name="name" autocomplete="name" />
		</label>
		<label>
			<span>{emailLabel}</span>
			<input type="email" name="email" autocomplete="email" />
		</label>
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
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		align-items: start;
		padding: 2rem 0;
	}

	@media (max-width: 720px) {
		.contact {
			grid-template-columns: 1fr;
		}
	}

	.form {
		display: grid;
		gap: 0.65rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
	}

	h2 {
		margin: 0 0 0.2rem;
		font-family: var(--font-editorial);
		font-size: clamp(1.25rem, 2.2vw, 1.55rem);
		font-weight: 500;
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
