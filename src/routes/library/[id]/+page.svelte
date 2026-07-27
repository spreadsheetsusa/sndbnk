<script>
	import { enhance } from '$app/forms';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';

	let { data, form } = $props();

	let updateBusy = $state(false);
	let deleteBusy = $state(false);

	const titleValue = $derived(form?.title ?? data.track.title);
	const descriptionValue = $derived(form?.description ?? data.track.description);
	const artistValue = $derived(form?.artist ?? data.track.artist);
	const albumValue = $derived(form?.album ?? data.track.album);
	const genreValue = $derived(form?.genre ?? data.track.genre);
	const yearValue = $derived(form?.year ?? data.track.year);
	const trackNumberValue = $derived(form?.trackNumber ?? data.track.trackNumber);
	const bpmValue = $derived(form?.bpm ?? data.track.bpm);
	const isrcValue = $derived(form?.isrc ?? data.track.isrc);
	const commentValue = $derived(form?.comment ?? data.track.comment);

	const formattedBytes = $derived(formatBytes(data.track.audioBytes));

	/**
	 * @param {number | null | undefined} bytes
	 */
	function formatBytes(bytes) {
		if (bytes == null || bytes <= 0) return '—';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	/**
	 * @param {'update' | 'delete'} which
	 */
	function busyHandler(which) {
		return () => {
			if (which === 'update') updateBusy = true;
			if (which === 'delete') deleteBusy = true;

			return async ({ update }) => {
				try {
					await update();
				} finally {
					if (which === 'update') updateBusy = false;
					if (which === 'delete') deleteBusy = false;
				}
			};
		};
	}

	/**
	 * @param {SubmitEvent} event
	 */
	function confirmDelete(event) {
		if (!confirm('Delete this track permanently? This cannot be undone.')) {
			event.preventDefault();
		}
	}
</script>

<svelte:head>
	<title>{data.track.title} | SNDBNK</title>
	<meta name="description" content="Edit track metadata in your SNDBNK library." />
</svelte:head>

<div class="library-page">
	<header class="site-header">
		<a class="logo display-face" href="/" aria-label="SNDBNK home">SNDBNK</a>
		<nav aria-label="Library">
			<a href="/library" aria-current="page">Library</a>
			<a href="/settings">Settings</a>
			<a href="/users/{data.profile.username}">View profile</a>
			<a href="/">Home</a>
			<ThemeToggle />
		</nav>
	</header>

	<main>
		<p class="eyebrow accent-text">Library</p>
		<h1 class="display-face">{data.track.title}</h1>
		<p class="intro">
			Edit metadata or replace files. Stored via <strong>{data.track.storageAdapter}</strong>.
		</p>

		<section class="block" aria-labelledby="edit-heading">
			<div class="block-head">
				<p class="eyebrow">01</p>
				<h2 id="edit-heading">Track details</h2>
				<p>Update fields and optionally replace the audio or cover.</p>
			</div>

			{#if form?.message && !updateBusy && !deleteBusy}
				<div class="banner error" role="alert">{form.message}</div>
			{/if}
			{#if form?.success && !updateBusy}
				<div class="banner ok" role="status">{form.success}</div>
			{/if}

			<div class="current-files">
				{#if data.track.hasCover}
					<div class="current-cover">
						<p class="eyebrow">Current cover</p>
						<img
							src="/api/media/{data.track.id}/cover"
							alt="Current cover for {data.track.title}"
							width="160"
							height="160"
						/>
					</div>
				{/if}
				<div class="current-audio">
					<p class="eyebrow">Current audio</p>
					<p class="file-detail">
						<span class="mono">{data.track.audioFilename}</span>
						<span>{data.track.audioMime} · {formattedBytes}</span>
					</p>
				</div>
			</div>

			<form
				method="POST"
				action="?/update"
				enctype="multipart/form-data"
				use:enhance={busyHandler('update')}
				aria-busy={updateBusy}
			>
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

				<label for="audio">Replace audio</label>
				<input id="audio" name="audio" type="file" accept="audio/*" />
				<p class="hint">Leave empty to keep the current file.</p>

				<label for="cover">Replace cover</label>
				<input id="cover" name="cover" type="file" accept="image/*" />
				<p class="hint">Leave empty to keep the current cover.</p>

				<div class="form-actions">
					<button class="pressable" type="submit" disabled={updateBusy || deleteBusy}>
						{updateBusy ? 'Saving…' : 'Save changes'}
					</button>
					<a class="pressable ghost" href="/library">Back to library</a>
				</div>
			</form>
		</section>

		<section class="danger-zone block" aria-labelledby="delete-heading">
			<div class="block-head">
				<p class="eyebrow">02</p>
				<h2 id="delete-heading">Delete track</h2>
				<p>Permanently remove this track and its files from your library.</p>
			</div>

			<form
				method="POST"
				action="?/delete"
				use:enhance={busyHandler('delete')}
				onsubmit={confirmDelete}
			>
				<button class="pressable ghost danger" type="submit" disabled={updateBusy || deleteBusy}>
					{deleteBusy ? 'Deleting…' : 'Delete track'}
				</button>
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
		font-size: clamp(2.5rem, 8vw, 4.5rem);
		line-height: 0.95;
		animation: rise 0.65s ease both;
		word-break: break-word;
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
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
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

	.banner.ok {
		color: var(--on-accent);
		background: var(--accent);
	}

	.current-files {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1.5rem;
		margin-top: 1.5rem;
		padding: 1.25rem;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, var(--ink) 3%, transparent);
	}

	.current-cover img {
		display: block;
		width: 10rem;
		height: 10rem;
		border: 1px solid var(--ink);
		object-fit: cover;
	}

	.file-detail {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin: 0.5rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.45;
	}

	.mono {
		color: var(--ink);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-weight: 700;
		word-break: break-all;
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
		color: var(--on-accent);
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

	.pressable.danger {
		background: transparent;
	}

	.danger-zone form {
		margin-top: 1.5rem;
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
		.current-files {
			grid-template-columns: 1fr;
		}

		.field-row {
			grid-template-columns: 1fr;
		}
	}
</style>
