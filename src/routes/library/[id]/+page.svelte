<script>
	import { enhance } from '$app/forms';
	import { afterNavigate } from '$app/navigation';
	import { untrack } from 'svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { extractAudioMetadata, formatDuration } from '#lib/media/audio-metadata.js';

	let { data, form } = $props();

	let updateBusy = $state(false);
	let deleteBusy = $state(false);
	let embedBusy = $state(false);
	let parsing = $state(false);
	/** @type {HTMLInputElement | undefined} */
	let coverInput = $state();
	/** @type {File | null} */
	let pendingCover = $state(null);
	/** @type {string | null} */
	let coverPreviewUrl = $state(null);
	/** @type {string | null} */
	let parseWarning = $state(null);
	/** @type {string[]} */
	let autofilledKeys = $state([]);
	/** @type {string | null} */
	let techSummary = $state(null);

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
	function fieldsFromTrack() {
		return {
			title: String(data.track.title ?? ''),
			description: String(data.track.description ?? ''),
			artist: String(data.track.artist ?? ''),
			album: String(data.track.album ?? ''),
			genre: String(data.track.genre ?? ''),
			year: String(data.track.year ?? ''),
			trackNumber: String(data.track.trackNumber ?? ''),
			bpm: String(data.track.bpm ?? ''),
			isrc: String(data.track.isrc ?? ''),
			comment: String(data.track.comment ?? '')
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
	function technicalFromTrack() {
		return {
			durationMs:
				data.track.durationMs != null && data.track.durationMs !== ''
					? String(data.track.durationMs)
					: '',
			bitrate:
				data.track.bitrate != null && data.track.bitrate !== '' ? String(data.track.bitrate) : '',
			sampleRate:
				data.track.sampleRate != null && data.track.sampleRate !== ''
					? String(data.track.sampleRate)
					: '',
			channels:
				data.track.channels != null && data.track.channels !== ''
					? String(data.track.channels)
					: '',
			codec: String(data.track.codec ?? '')
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

	let fields = $state(untrack(() => (form?.message ? pickFormFields(form) : fieldsFromTrack())));
	let technical = $state(untrack(() => technicalFromTrack()));

	function resetParseUi() {
		parseWarning = null;
		autofilledKeys = [];
		pendingCover = null;
		techSummary = null;
		if (coverPreviewUrl) {
			URL.revokeObjectURL(coverPreviewUrl);
			coverPreviewUrl = null;
		}
	}

	afterNavigate(() => {
		fields = form?.message ? pickFormFields(form) : fieldsFromTrack();
		technical = technicalFromTrack();
		resetParseUi();
	});

	const formattedBytes = $derived(formatBytes(data.track.audioBytes));
	const storedDuration = $derived(
		data.track.durationMs != null && data.track.durationMs !== ''
			? formatDuration(Number(data.track.durationMs))
			: null
	);

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
	 * @param {typeof technical} tech
	 * @param {number | null} [fileBytes]
	 */
	function buildTechSummary(tech, fileBytes = null) {
		/** @type {string[]} */
		const parts = [];
		if (tech.durationMs) parts.push(formatDuration(Number(tech.durationMs)));
		if (tech.codec) parts.push(tech.codec);
		if (tech.bitrate) {
			const kbps = Math.round(Number(tech.bitrate) / 1000);
			if (Number.isFinite(kbps) && kbps > 0) parts.push(`${kbps} kbps`);
		}
		if (tech.sampleRate) {
			const khz = Number(tech.sampleRate) / 1000;
			if (Number.isFinite(khz) && khz > 0) parts.push(`${khz} kHz`);
		}
		if (tech.channels) {
			const ch = Number(tech.channels);
			parts.push(ch === 1 ? 'mono' : ch === 2 ? 'stereo' : `${ch} ch`);
		}
		if (fileBytes) parts.push(formatBytes(fileBytes));
		return parts.length ? parts.join(' · ') : null;
	}

	/**
	 * @param {File} file
	 */
	function setCoverFile(file) {
		if (!coverInput) return;
		const dt = new DataTransfer();
		dt.items.add(file);
		coverInput.files = dt.files;
		if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
		coverPreviewUrl = URL.createObjectURL(file);
		pendingCover = null;
	}

	function useExtractedCover() {
		if (pendingCover) setCoverFile(pendingCover);
	}

	/**
	 * @param {Event} event
	 */
	async function onAudioChange(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const file = input.files?.[0] ?? null;
		parseWarning = null;
		autofilledKeys = [];
		pendingCover = null;
		techSummary = null;

		if (!file) {
			technical = technicalFromTrack();
			return;
		}

		parsing = true;
		try {
			const result = await extractAudioMetadata(file);
			parseWarning = result.warning;

			const next = { ...fields };
			/** @type {string[]} */
			const filled = [];
			for (const [key, value] of Object.entries(result.fields)) {
				if (value == null || value === '') continue;
				// @ts-expect-error dynamic key
				const current = next[key];
				if (typeof current === 'string' && current.trim() !== '') continue;
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
			techSummary = buildTechSummary(technical, file.size);

			if (result.cover) {
				pendingCover = result.cover;
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
		if (coverPreviewUrl) {
			URL.revokeObjectURL(coverPreviewUrl);
			coverPreviewUrl = null;
		}
		if (file) {
			coverPreviewUrl = URL.createObjectURL(file);
			pendingCover = null;
		}
	}

	/**
	 * @param {'update' | 'delete' | 'embed'} which
	 */
	function busyHandler(which) {
		return () => {
			if (which === 'update') updateBusy = true;
			if (which === 'delete') deleteBusy = true;
			if (which === 'embed') embedBusy = true;

			return async ({ result, update }) => {
				try {
					await update({ reset: false });
					if (which === 'update') {
						if (result.type === 'failure' && result.data) {
							fields = { ...fieldsFromTrack(), ...pickFormFields(result.data) };
						} else if (result.type === 'success') {
							fields = fieldsFromTrack();
							technical = technicalFromTrack();
							resetParseUi();
						}
					}
				} finally {
					if (which === 'update') updateBusy = false;
					if (which === 'delete') deleteBusy = false;
					if (which === 'embed') embedBusy = false;
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
	<SiteHeader />

	<main>
		<p class="eyebrow accent-text">Library</p>
		<h1 class="display-face">{data.track.title}</h1>
		<p class="intro">
			Edit metadata or replace files. Stored via <strong>{data.track.storageAdapter}</strong>.
			{#if storedDuration}
				<span class="duration"> · {storedDuration}</span>
			{/if}
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
						<span>
							{data.track.audioMime} · {formattedBytes}
							{#if storedDuration}
								· {storedDuration}
							{/if}
						</span>
						{#if data.track.codec || data.track.bitrate || data.track.sampleRate}
							<span>
								{[
									data.track.codec,
									data.track.bitrate
										? `${Math.round(Number(data.track.bitrate) / 1000)} kbps`
										: null,
									data.track.sampleRate ? `${Number(data.track.sampleRate) / 1000} kHz` : null
								]
									.filter(Boolean)
									.join(' · ')}
							</span>
						{/if}
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
				<input id="title" name="title" type="text" bind:value={fields.title} required />

				<label for="description">Description</label>
				<textarea id="description" name="description" rows="4" bind:value={fields.description}
				></textarea>

				<label for="artist">Artist</label>
				<input id="artist" name="artist" type="text" bind:value={fields.artist} />

				<label for="album">Album</label>
				<input id="album" name="album" type="text" bind:value={fields.album} />

				<label for="genre">Genre</label>
				<input id="genre" name="genre" type="text" bind:value={fields.genre} />

				<div class="field-row">
					<div>
						<label for="year">Year</label>
						<input id="year" name="year" type="text" inputmode="numeric" bind:value={fields.year} />
					</div>
					<div>
						<label for="trackNumber">Track number</label>
						<input
							id="trackNumber"
							name="trackNumber"
							type="text"
							inputmode="numeric"
							bind:value={fields.trackNumber}
						/>
					</div>
					<div>
						<label for="bpm">BPM</label>
						<input id="bpm" name="bpm" type="text" inputmode="numeric" bind:value={fields.bpm} />
					</div>
				</div>

				<label for="isrc">ISRC</label>
				<input id="isrc" name="isrc" type="text" bind:value={fields.isrc} autocapitalize="none" />

				<label for="comment">Comment</label>
				<textarea id="comment" name="comment" rows="3" bind:value={fields.comment}></textarea>

				<label for="audio">Replace audio</label>
				<input id="audio" name="audio" type="file" accept="audio/*" onchange={onAudioChange} />
				<p class="hint">
					Leave empty to keep the current file. Empty metadata fields can be filled from tags.
				</p>

				{#if parsing}
					<p class="status" aria-live="polite">Reading file…</p>
				{:else if techSummary || autofilledKeys.length || parseWarning || pendingCover}
					<div class="meta-panel" aria-live="polite">
						{#if techSummary}
							<p class="summary">{techSummary}</p>
						{/if}
						{#if autofilledKeys.length}
							<p class="summary muted">Filled empty fields: {autofilledKeys.join(', ')}</p>
						{/if}
						{#if parseWarning}
							<p class="summary warn">{parseWarning}</p>
						{/if}
						{#if pendingCover}
							<button class="text-btn" type="button" onclick={useExtractedCover}>
								Use embedded cover art
							</button>
						{/if}
					</div>
				{/if}

				<input type="hidden" name="durationMs" value={technical.durationMs} />
				<input type="hidden" name="bitrate" value={technical.bitrate} />
				<input type="hidden" name="sampleRate" value={technical.sampleRate} />
				<input type="hidden" name="channels" value={technical.channels} />
				<input type="hidden" name="codec" value={technical.codec} />

				<label for="cover">Replace cover</label>
				<input
					id="cover"
					name="cover"
					type="file"
					accept="image/*"
					bind:this={coverInput}
					onchange={onCoverChange}
				/>
				<p class="hint">Leave empty to keep the current cover.</p>

				{#if coverPreviewUrl}
					<div class="cover-preview">
						<img src={coverPreviewUrl} alt="Cover preview" width="160" height="160" />
					</div>
				{/if}

				<div class="form-actions">
					<button
						class="pressable"
						type="submit"
						disabled={updateBusy || deleteBusy || embedBusy || parsing}
					>
						{updateBusy ? 'Saving…' : 'Save changes'}
					</button>
					<a class="pressable ghost" href="/library">Back to library</a>
				</div>
			</form>
		</section>

		<section class="block" aria-labelledby="embed-heading">
			<div class="block-head">
				<p class="eyebrow">02</p>
				<h2 id="embed-heading">Sync tags to file</h2>
				<p>
					Writes the metadata above into the audio file's own tags, but only where the file has no
					value yet. Tags already in the file are left untouched.
				</p>
			</div>

			{#if form?.embedError && !embedBusy}
				<div class="banner error" role="alert">{form.embedError}</div>
			{/if}
			{#if form?.embedded && !embedBusy}
				<div class="banner ok" role="status">{form.embedded}</div>
			{/if}

			<form method="POST" action="?/embedTags" use:enhance={busyHandler('embed')}>
				<div class="form-actions">
					<button
						class="pressable ghost"
						type="submit"
						disabled={updateBusy || deleteBusy || embedBusy}
					>
						{embedBusy ? 'Writing tags…' : 'Write tags to file'}
					</button>
				</div>
			</form>
		</section>

		<section class="danger-zone block" aria-labelledby="delete-heading">
			<div class="block-head">
				<p class="eyebrow">03</p>
				<h2 id="delete-heading">Delete track</h2>
				<p>Permanently remove this track and its files from your library.</p>
			</div>

			<form
				method="POST"
				action="?/delete"
				use:enhance={busyHandler('delete')}
				onsubmit={confirmDelete}
			>
				<button
					class="pressable ghost danger"
					type="submit"
					disabled={updateBusy || deleteBusy || embedBusy}
				>
					{deleteBusy ? 'Deleting…' : 'Delete track'}
				</button>
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
		padding-top: clamp(1.25rem, 4vw, 2.5rem);
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

	.duration {
		font-variant-numeric: tabular-nums;
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
		margin: 0 0 1.25rem;
	}

	.cover-preview img {
		display: block;
		width: 10rem;
		height: 10rem;
		border: 1px solid var(--ink);
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

	/* Transparent buttons sit on --paper, so they need --ink rather than the
	   --on-accent colour that only reads against the accent fill. */
	.pressable.ghost,
	.pressable.danger {
		color: var(--ink);
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
