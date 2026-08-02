<script>
	import { enhance } from '$app/forms';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	let { data, form } = $props();

	let busy = $state(false);
	let title = $state(form?.title ?? '');
	let description = $state(form?.description ?? '');
	let published = $state(form?.published ?? true);

	$effect(() => {
		if (!form) return;
		title = form.title ?? title;
		description = form.description ?? description;
		published = form.published ?? published;
	});
</script>

<svelte:head>
	<title>New playlist | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<SiteHeader />

	<main>
		<header class="page-head">
			<p class="eyebrow eyebrow-chip accent-text">@{data.profile.username}</p>
			<h1 class="display-face">New playlist</h1>
			<p class="intro">Collect published tracks into a playlist for your profile and the feed.</p>
		</header>

		<form
			method="POST"
			class="playlist-form"
			aria-label="Create playlist"
			aria-busy={busy}
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					try {
						await update({ reset: false });
					} finally {
						busy = false;
					}
				};
			}}
		>
			{#if form?.message && !busy}
				<p class="form-error" role="alert" aria-live="polite">{form.message}</p>
			{/if}

			<label>
				<span>Title</span>
				<input
					name="title"
					type="text"
					required
					maxlength="200"
					bind:value={title}
					aria-invalid={form?.message ? 'true' : undefined}
					disabled={busy}
				/>
			</label>

			<label>
				<span>Description</span>
				<textarea
					name="description"
					rows="4"
					maxlength="5000"
					bind:value={description}
					disabled={busy}></textarea>
			</label>

			<label class="check">
				<input
					type="checkbox"
					name="published"
					value="true"
					bind:checked={published}
					disabled={busy}
				/>
				<span>Publish to profile and feed</span>
			</label>

			<div class="actions">
				<button type="submit" class="pressable" disabled={busy}>
					{busy ? 'Creating…' : 'Create playlist'}
				</button>
				<a href="/library">Cancel</a>
			</div>
		</form>
	</main>
</div>

<style>
	.page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 4rem;
	}

	main {
		width: min(100%, var(--site-content-max));
		margin: 0 auto;
		padding-top: clamp(0.75rem, 2vw, 1.25rem);
	}

	.page-head {
		margin-bottom: 1.5rem;
	}

	.intro {
		margin: 0.5rem 0 0;
		max-width: 36rem;
		color: var(--muted);
		line-height: 1.5;
	}

	.playlist-form {
		display: flex;
		max-width: 32rem;
		flex-direction: column;
		gap: 1rem;
	}

	.playlist-form label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.playlist-form input[type='text'],
	.playlist-form textarea {
		padding: 0.55rem 0.65rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--ink));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 6%, var(--paper));
		color: var(--ink);
		font: inherit;
		font-size: 0.95rem;
		font-weight: 500;
		letter-spacing: 0;
		text-transform: none;
	}

	.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 700;
		font-size: 0.9rem;
	}

	.actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.actions a {
		color: var(--muted);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.pressable {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		padding: 0 1.1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.pressable:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.form-error {
		margin: 0;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, #b00020 12%, var(--paper));
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
	}
</style>
