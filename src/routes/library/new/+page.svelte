<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let busy = $state(false);

	const titleValue = $derived(form?.title ?? '');
	const descriptionValue = $derived(form?.description ?? '');
	const artistValue = $derived(form?.artist ?? '');
	const albumValue = $derived(form?.album ?? '');
	const genreValue = $derived(form?.genre ?? '');
	const yearValue = $derived(form?.year ?? '');
	const trackNumberValue = $derived(form?.trackNumber ?? '');
	const bpmValue = $derived(form?.bpm ?? '');
	const isrcValue = $derived(form?.isrc ?? '');
	const commentValue = $derived(form?.comment ?? '');

	function handleSubmit() {
		busy = true;

		return async ({ update }) => {
			try {
				await update();
			} finally {
				busy = false;
			}
		};
	}
</script>

<svelte:head>
	<title>Upload track | SNDBNK</title>
	<meta name="description" content="Upload a new track to your SNDBNK library." />
</svelte:head>

<div class="library-page">
	<header class="site-header">
		<a class="logo display-face" href="/" aria-label="SNDBNK home">SNDBNK</a>
		<nav aria-label="Library">
			<a href="/library" aria-current="page">Library</a>
			<a href="/settings">Settings</a>
			<a href="/users/{data.profile.username}">View profile</a>
			<a href="/">Home</a>
		</nav>
	</header>

	<main>
		<p class="eyebrow accent-text">Library</p>
		<h1 class="display-face">Upload track</h1>
		<p class="intro">Add audio and metadata to your private library.</p>

		<section class="block" aria-labelledby="upload-heading">
			<div class="block-head">
				<p class="eyebrow">01</p>
				<h2 id="upload-heading">New track</h2>
				<p>Audio file is required. Cover art is optional.</p>
			</div>

			{#if form?.message && !busy}
				<div class="banner error" role="alert">{form.message}</div>
			{/if}

			<form method="POST" enctype="multipart/form-data" use:enhance={handleSubmit} aria-busy={busy}>
				<label for="title">Title</label>
				<input id="title" name="title" type="text" value={titleValue} required />

				<label for="description">Description</label>
				<textarea id="description" name="description" rows="4">{descriptionValue}</textarea>

				<label for="artist">Artist</label>
				<input id="artist" name="artist" type="text" value={artistValue} />

				<label for="album">Album</label>
				<input id="album" name="album" type="text" value={albumValue} />

				<label for="genre">Genre</label>
				<input id="genre" name="genre" type="text" value={genreValue} />

				<div class="field-row">
					<div>
						<label for="year">Year</label>
						<input id="year" name="year" type="text" inputmode="numeric" value={yearValue} />
					</div>
					<div>
						<label for="trackNumber">Track number</label>
						<input
							id="trackNumber"
							name="trackNumber"
							type="text"
							inputmode="numeric"
							value={trackNumberValue}
						/>
					</div>
					<div>
						<label for="bpm">BPM</label>
						<input id="bpm" name="bpm" type="text" inputmode="numeric" value={bpmValue} />
					</div>
				</div>

				<label for="isrc">ISRC</label>
				<input id="isrc" name="isrc" type="text" value={isrcValue} autocapitalize="none" />

				<label for="comment">Comment</label>
				<textarea id="comment" name="comment" rows="3">{commentValue}</textarea>

				<label for="audio">Audio file</label>
				<input id="audio" name="audio" type="file" accept="audio/*" required />
				<p class="hint">Supported audio formats depend on your storage adapter.</p>

				<label for="cover">Cover image</label>
				<input id="cover" name="cover" type="file" accept="image/*" />

				<div class="form-actions">
					<button class="pressable" type="submit" disabled={busy}>
						{busy ? 'Uploading…' : 'Upload track'}
					</button>
					<a class="pressable ghost" href="/library">Cancel</a>
				</div>
			</form>
		</section>
	</main>
</div>

<style>
	.library-page {
		width: min(100%, 920px);
		min-height: 100vh;
		margin: 0 auto;
		padding: clamp(1.25rem, 4vw, 2.5rem) clamp(1.25rem, 4vw, 2.5rem) 4rem;
	}

	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: clamp(2rem, 5vw, 3.5rem);
	}

	.logo {
		color: var(--ink);
		font-size: clamp(1.5rem, 3vw, 2rem);
		line-height: 1;
		text-decoration: none;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.75rem 1rem;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	nav a {
		color: var(--ink);
		text-underline-offset: 0.25rem;
	}

	nav a[aria-current='page'] {
		text-decoration: underline;
	}

	main > .eyebrow {
		margin: 0 0 0.75rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(3.2rem, 9vw, 5.5rem);
		line-height: 0.92;
		animation: rise 0.65s ease both;
	}

	.intro {
		max-width: 34rem;
		margin: 1rem 0 0;
		color: var(--muted);
		line-height: 1.5;
		animation: rise 0.75s ease 0.05s both;
	}

	.block {
		margin-top: clamp(2.75rem, 7vw, 4rem);
		padding-top: clamp(1.75rem, 4vw, 2.25rem);
		border-top: 1px solid rgb(17 17 15 / 18%);
		animation: rise 0.8s ease both;
	}

	.block-head h2 {
		margin: 0.35rem 0 0.5rem;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 400;
		letter-spacing: -0.03em;
	}

	.block-head p:last-child {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
	}

	.banner {
		margin-top: 1.25rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--ink);
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.4;
	}

	.banner.error {
		background: rgb(200 255 61 / 25%);
	}

	form {
		display: grid;
		margin-top: 1.5rem;
	}

	label {
		margin: 0 0 0.5rem;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	input,
	textarea {
		width: 100%;
		margin-bottom: 0.35rem;
		padding: 0 0.85rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		color: var(--ink);
		background: transparent;
		outline: none;
	}

	input {
		height: 3.1rem;
	}

	textarea {
		padding: 0.75rem 0.85rem;
		margin-bottom: 1rem;
		line-height: 1.45;
		resize: vertical;
	}

	input[type='file'] {
		height: auto;
		padding: 0.65rem 0.85rem;
		margin-bottom: 0.35rem;
	}

	input:focus,
	textarea:focus {
		box-shadow: 4px 4px 0 var(--accent);
	}

	.hint {
		margin: 0 0 1.15rem;
		color: var(--muted);
		font-size: 0.72rem;
		line-height: 1.45;
	}

	.field-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.35rem;
	}

	.pressable {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		min-height: 3.1rem;
		padding: 0 1.1rem;
		border: 1px solid var(--ink);
		color: var(--ink);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--ink);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
	}

	.pressable:disabled {
		opacity: 0.55;
		box-shadow: 2px 2px 0 var(--ink);
		cursor: not-allowed;
	}

	.pressable.ghost {
		background: transparent;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.6rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 720px) {
		.field-row {
			grid-template-columns: 1fr;
		}
	}
</style>
