<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   mapLabel?: string,
	 *   panelTitle?: string,
	 *   panelBody?: string,
	 *   heading?: string,
	 *   nameLabel?: string,
	 *   emailLabel?: string,
	 *   messageLabel?: string,
	 *   submitLabel?: string
	 * }}
	 */
	let {
		mapLabel = 'Map',
		panelTitle = 'Studio hours',
		panelBody = 'Mon–Fri · 10am–6pm CET\nWalk-ins welcome for mix feedback.',
		heading = 'Visit or write in',
		nameLabel = 'Name',
		emailLabel = 'Email',
		messageLabel = 'Message',
		submitLabel = 'Send'
	} = $props();
</script>

<section class="contact">
	<div class="map-wrap">
		<MediaPlaceholder label={mapLabel} ratio="16 / 11" />
		<div class="panel">
			<h3>{panelTitle}</h3>
			{#each panelBody.split('\n').filter(Boolean) as line (line)}
				<p>{line}</p>
			{/each}
		</div>
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
		grid-template-columns: 1.15fr 0.85fr;
		gap: 1.5rem;
		align-items: start;
		padding: 2rem 0;
	}

	@media (max-width: 720px) {
		.contact {
			grid-template-columns: 1fr;
		}
	}

	.map-wrap {
		position: relative;
	}

	.panel {
		position: absolute;
		left: 1rem;
		bottom: 1rem;
		max-width: min(16rem, calc(100% - 2rem));
		padding: 0.85rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: var(--paper);
		box-shadow: 4px 4px 0 color-mix(in srgb, var(--ink) 12%, transparent);
	}

	h3 {
		margin: 0 0 0.35rem;
		font-size: 0.95rem;
		font-weight: 500;
	}

	.panel p {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.panel p + p {
		margin-top: 0.25rem;
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
