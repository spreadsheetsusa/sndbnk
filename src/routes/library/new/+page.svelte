<script>
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { extractAudioMetadata, formatDuration } from '#lib/media/audio-metadata.js';

	let { data, form } = $props();

	let busy = $state(false);
	let parsing = $state(false);
	/** @type {HTMLInputElement | undefined} */
	let coverInput = $state();
	/** @type {string | null} */
	let coverPreviewUrl = $state(null);
	/** @type {string | null} */
	let parseWarning = $state(null);
	/** @type {string[]} */
	let autofilledKeys = $state([]);
	/** @type {File | null} */
	let selectedAudio = $state(null);

	/**
	 * @returns {{
	 *   title: string;
	 *   description: string;
	 *   artist: string;
	 *   album: string;
	 *   genre: string;
	 *   year: string;
	 *   trackNumber: string;
	 *   bpm: string;
	 *   isrc: string;
	 *   comment: string;
	 * }}
	 */
	function emptyFields() {
		return {
			title: '',
			description: '',
			artist: '',
			album: '',
			genre: '',
			year: '',
			trackNumber: '',
			bpm: '',
			isrc: '',
			comment: ''
		};
	}

	/**
	 * @returns {{
	 *   durationMs: string;
	 *   bitrate: string;
	 *   sampleRate: string;
	 *   channels: string;
	 *   codec: string;
	 * }}
	 */
	function emptyTechnical() {
		return {
			durationMs: '',
			bitrate: '',
			sampleRate: '',
			channels: '',
			codec: ''
		};
	}

	/**
	 * @param {Record<string, unknown>} source
	 */
	function pickFormFields(source) {
		return {
			title: String(source.title ?? ''),
			description: String(source.description ?? ''),
			artist: String(source.artist ?? ''),
			album: String(source.album ?? ''),
			genre: String(source.genre ?? ''),
			year: String(source.year ?? ''),
			trackNumber: String(source.trackNumber ?? ''),
			bpm: String(source.bpm ?? ''),
			isrc: String(source.isrc ?? ''),
			comment: String(source.comment ?? '')
		};
	}

	let fields = $state(untrack(() => (form?.message ? pickFormFields(form) : emptyFields())));
	let technical = $state(emptyTechnical());
	const touched = new SvelteSet();

	const fieldSummary = $derived(
		autofilledKeys.filter((k) => k !== 'cover').length > 0
			? autofilledKeys.filter((k) => k !== 'cover').join(', ')
			: null
	);

	const techSummary = $derived.by(() => {
		if (!selectedAudio && !technical.durationMs) return null;
		/** @type {string[]} */
		const parts = [];
		if (technical.durationMs) {
			parts.push(formatDuration(Number(technical.durationMs)));
		}
		if (technical.codec) parts.push(technical.codec);
		if (technical.bitrate) {
			const kbps = Math.round(Number(technical.bitrate) / 1000);
			if (Number.isFinite(kbps) && kbps > 0) parts.push(`${kbps} kbps`);
		}
		if (technical.sampleRate) {
			const khz = Number(technical.sampleRate) / 1000;
			if (Number.isFinite(khz) && khz > 0) parts.push(`${khz} kHz`);
		}
		if (technical.channels) {
			const ch = Number(technical.channels);
			parts.push(ch === 1 ? 'mono' : ch === 2 ? 'stereo' : `${ch} ch`);
		}
		if (selectedAudio?.size) {
			parts.push(formatBytes(selectedAudio.size));
		}
		return parts.length ? parts.join(' · ') : null;
	});

	/**
	 * @param {number} bytes
	 */
	function formatBytes(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	/**
	 * @param {string} key
	 */
	function markTouched(key) {
		touched.add(key);
	}

	/**
	 * @param {File | null} file
	 */
	function setCoverFile(file) {
		if (coverPreviewUrl) {
			URL.revokeObjectURL(coverPreviewUrl);
			coverPreviewUrl = null;
		}

		if (!coverInput) return;

		if (!file) {
			coverInput.value = '';
			return;
		}

		const dt = new DataTransfer();
		dt.items.add(file);
		coverInput.files = dt.files;
		coverPreviewUrl = URL.createObjectURL(file);
	}

	function clearCover() {
		setCoverFile(null);
		autofilledKeys = autofilledKeys.filter((k) => k !== 'cover');
	}

	function clearAutofilled() {
		const next = { ...fields };
		for (const key of autofilledKeys) {
			if (key === 'cover') continue;
			if (key in next && !touched.has(key)) {
				// @ts-expect-error dynamic key
				next[key] = '';
			}
		}
		fields = next;
		technical = emptyTechnical();
		if (autofilledKeys.includes('cover') && !touched.has('cover')) {
			setCoverFile(null);
		}
		autofilledKeys = [];
		parseWarning = null;
	}

	/**
	 * @param {Event} event
	 */
	async function onAudioChange(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const file = input.files?.[0] ?? null;
		selectedAudio = file;
		parseWarning = null;
		autofilledKeys = [];
		technical = emptyTechnical();

		if (!file) return;

		parsing = true;
		try {
			const result = await extractAudioMetadata(file);
			parseWarning = result.warning;

			const next = { ...fields };
			/** @type {string[]} */
			const filled = [];
			for (const [key, value] of Object.entries(result.fields)) {
				if (value == null || value === '') continue;
				if (touched.has(key)) continue;
				// @ts-expect-error dynamic key
				next[key] = value;
				filled.push(key);
			}
			fields = next;

			technical = {
				durationMs: result.technical.durationMs ?? '',
				bitrate: result.technical.bitrate ?? '',
				sampleRate: result.technical.sampleRate ?? '',
				channels: result.technical.channels ?? '',
				codec: result.technical.codec ?? ''
			};

			if (result.cover && !touched.has('cover')) {
				setCoverFile(result.cover);
				filled.push('cover');
			}

			autofilledKeys = filled;
		} finally {
			parsing = false;
		}
	}

	/**
	 * @param {Event} event
	 */
	function onCoverChange(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const file = input.files?.[0] ?? null;
		markTouched('cover');
		if (coverPreviewUrl) {
			URL.revokeObjectURL(coverPreviewUrl);
			coverPreviewUrl = null;
		}
		if (file) {
			coverPreviewUrl = URL.createObjectURL(file);
		}
	}

	function handleSubmit() {
		busy = true;

		return async ({ result, update }) => {
			try {
				await update({ reset: false });
				if (result.type === 'failure' && result.data) {
					fields = { ...emptyFields(), ...pickFormFields(result.data) };
					touched.clear();
				}
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
	<SiteHeader />

	<main>
		<header class="page-head">
			<p class="eyebrow eyebrow-chip accent-text">Library</p>
			<h1 class="display-face">Upload track</h1>
			<p class="intro">Attach audio first — we fill metadata from the file when available.</p>
		</header>

		<section class="block" aria-labelledby="upload-heading">
			<div class="block-head">
				<p class="eyebrow">01</p>
				<h2 id="upload-heading">Audio file</h2>
				<p>Required. Tags and cover art are read in your browser before upload.</p>
			</div>

			{#if form?.message && !busy}
				<div class="banner error" role="alert">{form.message}</div>
			{/if}

			<form method="POST" enctype="multipart/form-data" use:enhance={handleSubmit} aria-busy={busy}>
				<label for="audio">Audio file</label>
				<input
					id="audio"
					name="audio"
					type="file"
					accept="audio/*"
					required
					onchange={onAudioChange}
				/>
				<p class="hint">Supported: mp3, wav, flac, aac, ogg, m4a (max 100MB).</p>

				{#if parsing}
					<p class="status" aria-live="polite">Reading file…</p>
				{:else if techSummary || fieldSummary || parseWarning}
					<div class="meta-panel" aria-live="polite">
						{#if techSummary}
							<p class="summary">{techSummary}</p>
						{/if}
						{#if fieldSummary}
							<p class="summary muted">Autofilled: {fieldSummary}</p>
						{/if}
						{#if parseWarning}
							<p class="summary warn">{parseWarning}</p>
						{/if}
						{#if autofilledKeys.length}
							<button class="text-btn" type="button" onclick={clearAutofilled}>
								Clear autofilled values
							</button>
						{/if}
					</div>
				{/if}

				<input type="hidden" name="durationMs" value={technical.durationMs} />
				<input type="hidden" name="bitrate" value={technical.bitrate} />
				<input type="hidden" name="sampleRate" value={technical.sampleRate} />
				<input type="hidden" name="channels" value={technical.channels} />
				<input type="hidden" name="codec" value={technical.codec} />

				<div class="block-head nested">
					<p class="eyebrow">02</p>
					<h2>Metadata</h2>
					<p>Edit anything before uploading. Manual edits are kept when you pick another file.</p>
				</div>

				<label for="title">Title</label>
				<input
					id="title"
					name="title"
					type="text"
					bind:value={fields.title}
					oninput={() => markTouched('title')}
					required
				/>

				<label for="description">Description</label>
				<textarea
					id="description"
					name="description"
					rows="4"
					bind:value={fields.description}
					oninput={() => markTouched('description')}></textarea>

				<label for="artist">Artist</label>
				<input
					id="artist"
					name="artist"
					type="text"
					bind:value={fields.artist}
					oninput={() => markTouched('artist')}
				/>

				<label for="album">Album</label>
				<input
					id="album"
					name="album"
					type="text"
					bind:value={fields.album}
					oninput={() => markTouched('album')}
				/>

				<label for="genre">Genre</label>
				<input
					id="genre"
					name="genre"
					type="text"
					bind:value={fields.genre}
					oninput={() => markTouched('genre')}
				/>

				<div class="field-row">
					<div>
						<label for="year">Year</label>
						<input
							id="year"
							name="year"
							type="text"
							inputmode="numeric"
							bind:value={fields.year}
							oninput={() => markTouched('year')}
						/>
					</div>
					<div>
						<label for="trackNumber">Track number</label>
						<input
							id="trackNumber"
							name="trackNumber"
							type="text"
							inputmode="numeric"
							bind:value={fields.trackNumber}
							oninput={() => markTouched('trackNumber')}
						/>
					</div>
					<div>
						<label for="bpm">BPM</label>
						<input
							id="bpm"
							name="bpm"
							type="text"
							inputmode="numeric"
							bind:value={fields.bpm}
							oninput={() => markTouched('bpm')}
						/>
					</div>
				</div>

				<label for="isrc">ISRC</label>
				<input
					id="isrc"
					name="isrc"
					type="text"
					bind:value={fields.isrc}
					oninput={() => markTouched('isrc')}
					autocapitalize="none"
				/>

				<label for="comment">Comment</label>
				<textarea
					id="comment"
					name="comment"
					rows="3"
					bind:value={fields.comment}
					oninput={() => markTouched('comment')}></textarea>

				<div class="block-head nested">
					<p class="eyebrow">03</p>
					<h2>Cover image</h2>
					<p>Optional. Embedded art from the audio file is attached automatically when present.</p>
				</div>

				<label for="cover">Cover image</label>
				<input
					id="cover"
					name="cover"
					type="file"
					accept="image/*"
					bind:this={coverInput}
					onchange={onCoverChange}
				/>
				<p class="hint">jpg, png, or webp · max 5MB.</p>

				{#if coverPreviewUrl}
					<div class="cover-preview">
						<img src={coverPreviewUrl} alt="Cover preview" width="160" height="160" />
						<button class="text-btn" type="button" onclick={clearCover}>Remove cover</button>
					</div>
				{/if}

				<div class="form-actions">
					<button class="pressable" type="submit" disabled={busy || parsing}>
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
		margin-bottom: 2.5rem;
	}

	.page-head > .eyebrow {
		margin: 0 0 0.35rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.4rem, 6vw, 3.75rem);
		line-height: 0.95;
		animation: rise 0.65s ease both;
	}

	.intro {
		max-width: 34rem;
		margin: 0.4rem 0 0;
		color: var(--muted);
		line-height: 1.4;
		animation: rise 0.75s ease 0.05s both;
	}

	.block {
		margin-top: 0;
		padding-top: clamp(1.75rem, 4vw, 2.25rem);
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.8s ease both;
	}

	.block-head h2 {
		margin: 0.35rem 0 0.5rem;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 400;
		letter-spacing: -0.03em;
	}

	.block-head p:last-child {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
	}

	.block-head.nested {
		margin: 1.75rem 0 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
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

	.status {
		margin: 0 0 1.15rem;
		font-size: 0.82rem;
		font-weight: 700;
	}

	.meta-panel {
		display: grid;
		gap: 0.35rem;
		margin: 0 0 1.25rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, var(--ink) 3%, transparent);
	}

	.summary {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.45;
	}

	.summary.muted {
		color: var(--muted);
		font-weight: 600;
	}

	.summary.warn {
		color: var(--ink);
		font-weight: 700;
	}

	.text-btn {
		width: fit-content;
		margin-top: 0.25rem;
		padding: 0;
		border: 0;
		color: var(--ink);
		background: transparent;
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: underline;
		text-underline-offset: 0.2rem;
		cursor: pointer;
	}

	.cover-preview {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
		margin: 0 0 1.25rem;
	}

	.cover-preview img {
		display: block;
		width: 10rem;
		height: 10rem;
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: 0.125rem;
		box-shadow: 3px 3px 0 var(--hard-shadow);
		object-fit: cover;
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
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
	}

	.pressable:disabled {
		opacity: 0.55;
		box-shadow: 2px 2px 0 var(--hard-shadow);
		cursor: not-allowed;
	}

	.pressable.ghost {
		border-color: var(--hard-border);
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
