<script>
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import IconPhoto from '@tabler/icons-svelte-runes/icons/photo';
	import IconUpload from '@tabler/icons-svelte-runes/icons/upload';
	import IconX from '@tabler/icons-svelte-runes/icons/x';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import HostedQuotaMeter from '#lib/components/library/HostedQuotaMeter.svelte';
	import { AUDIO_FILE_ACCEPT } from '#lib/media/audio-accept.js';
	import { extractAudioMetadata, formatDuration } from '#lib/media/audio-metadata.js';
	import {
		DEFAULT_TRACK_MEDIA_TYPE,
		TRACK_MEDIA_TYPE_OPTIONS
	} from '#lib/media/track-media-type.js';

	let { data, form } = $props();

	let busy = $state(false);
	let parsing = $state(false);
	let dragging = $state(false);
	/** @type {FileList | undefined} */
	let audioFiles = $state();
	/** @type {FileList | undefined} */
	let coverFiles = $state();
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
	 *   mediaType: string;
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
			mediaType: DEFAULT_TRACK_MEDIA_TYPE,
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
			mediaType: String(source.mediaType ?? DEFAULT_TRACK_MEDIA_TYPE),
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

	const consoleStatus = $derived.by(() => {
		if (busy) return 'UPLOADING';
		if (parsing) return 'READING';
		if (selectedAudio) return 'READY';
		return 'IDLE';
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

		if (!file) {
			coverFiles = new DataTransfer().files;
			return;
		}

		const dt = new DataTransfer();
		dt.items.add(file);
		coverFiles = dt.files;
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
	 * @param {File | null} file
	 */
	async function applyAudioFile(file) {
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
	 * @param {File | null} file
	 */
	function setAudioFile(file) {
		if (!file) {
			audioFiles = new DataTransfer().files;
			void applyAudioFile(null);
			return;
		}
		const dt = new DataTransfer();
		dt.items.add(file);
		audioFiles = dt.files;
		void applyAudioFile(file);
	}

	/**
	 * @param {Event} event
	 */
	function onAudioChange(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		void applyAudioFile(input.files?.[0] ?? null);
	}

	/**
	 * @param {DragEvent} event
	 */
	function onDragEnter(event) {
		event.preventDefault();
		dragging = true;
	}

	/**
	 * @param {DragEvent} event
	 */
	function onDragOver(event) {
		event.preventDefault();
		dragging = true;
	}

	/**
	 * @param {DragEvent} event
	 */
	function onDragLeave(event) {
		event.preventDefault();
		const current = /** @type {HTMLElement} */ (event.currentTarget);
		const related = /** @type {Node | null} */ (event.relatedTarget);
		if (related && current.contains(related)) return;
		dragging = false;
	}

	/**
	 * @param {DragEvent} event
	 */
	function onDrop(event) {
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files?.[0] ?? null;
		if (!file) return;
		if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(file.name)) {
			return;
		}
		setAudioFile(file);
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
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="library-page">
	<SiteHeader />

	<main>
		<header class="page-head">
			<div class="page-head-copy">
				<p class="eyebrow eyebrow-chip accent-text">Library</p>
				<h1 class="display-face">Upload</h1>
			</div>
			<div class="page-head-actions">
				<HostedQuotaMeter
					localBytes={data.usage.localBytes}
					maxLocalBytes={data.usage.maxLocalBytes}
					planLabel={data.usage.planLabel}
				/>
			</div>
		</header>

		{#if form?.message && !busy}
			<div class="banner error" role="alert">{form.message}</div>
		{/if}

		<form
			class="console"
			class:ready={!!selectedAudio}
			method="POST"
			enctype="multipart/form-data"
			use:enhance={handleSubmit}
			aria-busy={busy}
			aria-label="Upload track"
		>
			<div class="console-chrome">
				<div class="chrome-leds" aria-hidden="true">
					<span class="led" class:on={consoleStatus === 'IDLE'}></span>
					<span class="led accent" class:on={consoleStatus === 'READING'}></span>
					<span
						class="led hot"
						class:on={consoleStatus === 'READY' || consoleStatus === 'UPLOADING'}
					></span>
				</div>
				<p class="chrome-title">
					<span class="chrome-mark">LOAD</span>
					<span class="chrome-sub">track into library</span>
				</p>
				<p class="chrome-status" aria-live="polite" data-status={consoleStatus}>{consoleStatus}</p>
			</div>

			<div class="console-body">
				<aside class="media-rail">
					<div class="load-bay" class:dragging class:loaded={!!selectedAudio}>
						<input
							id="audio"
							class="sr-file"
							name="audio"
							type="file"
							accept={AUDIO_FILE_ACCEPT}
							required
							bind:files={audioFiles}
							onchange={onAudioChange}
						/>
						<label
							for="audio"
							class="load-target"
							ondragenter={onDragEnter}
							ondragover={onDragOver}
							ondragleave={onDragLeave}
							ondrop={onDrop}
						>
							<span class="load-icon" aria-hidden="true">
								<IconUpload size={22} stroke={1.75} />
							</span>
							{#if selectedAudio}
								<span class="load-file">{selectedAudio.name}</span>
								<span class="load-hint">Tap to swap file</span>
							{:else}
								<span class="load-file">Drop audio or browse</span>
								<span class="load-hint">mp3 · wav · flac · aac · ogg · m4a · max 500MB</span>
							{/if}
						</label>
					</div>

					<div class="signal-row">
						<div class="lcd" aria-live="polite">
							<div class="eq" aria-hidden="true">
								<span style="--h: 28%"></span>
								<span style="--h: 55%"></span>
								<span style="--h: 40%"></span>
								<span style="--h: 72%"></span>
								<span style="--h: 48%"></span>
								<span style="--h: 63%"></span>
								<span style="--h: 35%"></span>
							</div>
							{#if parsing}
								<p class="lcd-line blink">READING TAGS…</p>
							{:else if techSummary}
								<p class="lcd-line">{techSummary}</p>
								{#if fieldSummary}
									<p class="lcd-line dim">AUTOFILL {fieldSummary}</p>
								{/if}
								{#if parseWarning}
									<p class="lcd-line warn">{parseWarning}</p>
								{/if}
								{#if autofilledKeys.length}
									<button class="text-btn" type="button" onclick={clearAutofilled}>
										Clear autofill
									</button>
								{/if}
							{:else}
								<p class="lcd-line dim">NO SIGNAL</p>
								<p class="lcd-line dim">attach audio to fill tags</p>
							{/if}
						</div>

						<div class="cover-bay">
							<label for="cover" class="cover-target">
								{#if coverPreviewUrl}
									<img src={coverPreviewUrl} alt="Cover preview" width="120" height="120" />
								{:else}
									<span class="cover-empty">
										<IconPhoto size={18} stroke={1.5} aria-hidden="true" />
										<span>Cover</span>
									</span>
								{/if}
							</label>
							<input
								id="cover"
								class="sr-file"
								name="cover"
								type="file"
								accept="image/*"
								bind:files={coverFiles}
								onchange={onCoverChange}
							/>
							{#if coverPreviewUrl}
								<button
									class="cover-clear"
									type="button"
									onclick={clearCover}
									aria-label="Remove cover"
								>
									<IconX size={14} stroke={2} aria-hidden="true" />
								</button>
							{/if}
						</div>
					</div>
				</aside>

				<div class="fields">
					<div class="field-block">
						<p class="section-label"><span>01</span> Metadata</p>
						<div class="grid-2">
							<div class="field">
								<label for="title">Title</label>
								<input
									id="title"
									name="title"
									type="text"
									bind:value={fields.title}
									oninput={() => markTouched('title')}
									required
									placeholder="Track title"
								/>
							</div>
							<div class="field">
								<label for="artist">Artist</label>
								<input
									id="artist"
									name="artist"
									type="text"
									bind:value={fields.artist}
									oninput={() => markTouched('artist')}
									placeholder="Artist name"
								/>
							</div>
							<div class="field">
								<label for="album">Album</label>
								<input
									id="album"
									name="album"
									type="text"
									bind:value={fields.album}
									oninput={() => markTouched('album')}
								/>
							</div>
							<div class="field">
								<label for="genre">Genre</label>
								<input
									id="genre"
									name="genre"
									type="text"
									bind:value={fields.genre}
									oninput={() => markTouched('genre')}
								/>
							</div>
							<div class="field">
								<label for="mediaType">Type</label>
								<select
									id="mediaType"
									name="mediaType"
									bind:value={fields.mediaType}
									onchange={() => markTouched('mediaType')}
								>
									{#each TRACK_MEDIA_TYPE_OPTIONS as option (option.value)}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="grid-4">
							<div class="field">
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
							<div class="field">
								<label for="trackNumber">Track #</label>
								<input
									id="trackNumber"
									name="trackNumber"
									type="text"
									inputmode="numeric"
									bind:value={fields.trackNumber}
									oninput={() => markTouched('trackNumber')}
								/>
							</div>
							<div class="field">
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
							<div class="field">
								<label for="isrc">ISRC</label>
								<input
									id="isrc"
									name="isrc"
									type="text"
									bind:value={fields.isrc}
									oninput={() => markTouched('isrc')}
									autocapitalize="none"
								/>
							</div>
						</div>
					</div>

					<div class="field-block">
						<p class="section-label"><span>02</span> Notes</p>
						<div class="grid-2">
							<div class="field">
								<label for="description">Description</label>
								<textarea
									id="description"
									name="description"
									rows="2"
									bind:value={fields.description}
									oninput={() => markTouched('description')}
									placeholder="Optional liner notes"></textarea>
							</div>
							<div class="field">
								<label for="comment">Comment</label>
								<textarea
									id="comment"
									name="comment"
									rows="2"
									bind:value={fields.comment}
									oninput={() => markTouched('comment')}></textarea>
							</div>
						</div>
					</div>
				</div>
			</div>

			<input type="hidden" name="durationMs" value={technical.durationMs} />
			<input type="hidden" name="bitrate" value={technical.bitrate} />
			<input type="hidden" name="sampleRate" value={technical.sampleRate} />
			<input type="hidden" name="channels" value={technical.channels} />
			<input type="hidden" name="codec" value={technical.codec} />

			<div class="console-foot">
				<p class="foot-hint">
					{#if selectedAudio}
						Tags stay when you swap files — manual edits win.
					{:else}
						Attach audio first — we fill metadata from the file when available.
					{/if}
				</p>
				<div class="form-actions">
					<a class="pressable ghost" href="/library">Cancel</a>
					<button class="pressable" type="submit" disabled={busy || parsing || !selectedAudio}>
						<IconUpload size={15} stroke={2} aria-hidden="true" />
						{busy ? 'Uploading…' : 'Upload track'}
					</button>
				</div>
			</div>
		</form>
	</main>
</div>

<style>
	.library-page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 3rem;
	}

	main {
		width: min(100%, var(--site-content-max));
		margin: 0 auto;
		padding-top: clamp(0.5rem, 1.5vw, 0.9rem);
	}

	.page-head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1.25rem;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.85rem;
	}

	.page-head-copy {
		min-width: 0;
		flex: 1 1 12rem;
	}

	.page-head-actions {
		display: flex;
		flex-shrink: 0;
		align-items: flex-end;
		margin-left: auto;
	}

	.page-head-copy > .eyebrow {
		margin: 0 0 0.25rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.85rem, 4.5vw, 2.6rem);
		line-height: 0.95;
		animation: rise 0.55s ease both;
	}

	.banner {
		margin: 0 0 0.85rem;
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--ink);
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.35;
		animation: rise 0.5s ease both;
	}

	.banner.error {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.console {
		display: grid;
		border: 1px solid var(--hard-border);
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--ink) 4%, transparent) 0%,
				transparent 2.25rem
			),
			var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		animation: rise 0.65s ease 0.04s both;
	}

	.console.ready {
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--accent) 10%, transparent) 0%,
				transparent 2.5rem
			),
			var(--paper);
	}

	.console-chrome {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.5rem 0.8rem;
		border-bottom: 1px solid var(--ink);
		background: var(--inverse);
		color: var(--on-inverse);
	}

	.chrome-leds {
		display: flex;
		gap: 0.3rem;
	}

	.led {
		width: 0.45rem;
		height: 0.45rem;
		border: 1px solid color-mix(in srgb, var(--on-inverse) 35%, transparent);
		background: color-mix(in srgb, var(--on-inverse) 12%, transparent);
		opacity: 0.4;
	}

	.led.on {
		opacity: 1;
		background: color-mix(in srgb, var(--on-inverse) 55%, transparent);
		border-color: var(--on-inverse);
	}

	.led.accent.on {
		background: var(--accent);
		border-color: var(--accent);
		box-shadow: 0 0 0.45rem color-mix(in srgb, var(--accent) 70%, transparent);
	}

	.led.hot.on {
		background: var(--accent);
		border-color: var(--accent);
		box-shadow: 0 0 0.5rem color-mix(in srgb, var(--accent) 85%, transparent);
		animation: pulse-led 1.1s ease-in-out infinite;
	}

	.chrome-title {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.7rem;
		align-items: baseline;
		margin: 0;
		min-width: 0;
	}

	.chrome-mark {
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		color: var(--accent);
	}

	.chrome-sub {
		color: color-mix(in srgb, var(--on-inverse) 62%, transparent);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.chrome-status {
		margin: 0;
		padding: 0.15rem 0.45rem;
		border: 1px solid color-mix(in srgb, var(--on-inverse) 28%, transparent);
		color: color-mix(in srgb, var(--on-inverse) 70%, transparent);
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		line-height: 1.2;
	}

	.chrome-status[data-status='READY'],
	.chrome-status[data-status='UPLOADING'] {
		border-color: var(--accent);
		color: var(--on-accent);
		background: var(--accent);
	}

	.chrome-status[data-status='READING'] {
		border-color: var(--accent);
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.console-body {
		display: grid;
		grid-template-columns: minmax(12rem, 16.5rem) minmax(0, 1fr);
		gap: 1rem 1.15rem;
		padding: 0.95rem;
	}

	.media-rail {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		min-width: 0;
	}

	.load-bay {
		position: relative;
		min-height: 6.75rem;
		border: 1px dashed color-mix(in srgb, var(--ink) 32%, transparent);
		background: color-mix(in srgb, var(--ink) 3%, transparent);
		transition:
			border-color 0.15s ease,
			background 0.15s ease,
			box-shadow 0.15s ease;
	}

	.load-bay.loaded {
		border-style: solid;
		border-color: var(--hard-border);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}

	.load-bay.dragging {
		border-style: solid;
		border-color: var(--ink);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	.sr-file {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
		white-space: nowrap;
	}

	.load-target {
		display: grid;
		gap: 0.3rem;
		justify-items: center;
		align-content: center;
		min-height: 6.75rem;
		padding: 0.85rem 0.75rem;
		text-align: center;
		cursor: pointer;
	}

	.load-icon {
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		margin-bottom: 0.15rem;
		border: 1px solid var(--ink);
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	.load-file {
		max-width: 100%;
		overflow: hidden;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.load-hint {
		color: var(--muted);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		line-height: 1.35;
		text-transform: uppercase;
	}

	.signal-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5.75rem;
		gap: 0.55rem;
		align-items: stretch;
	}

	.lcd {
		position: relative;
		display: grid;
		gap: 0.18rem;
		align-content: start;
		min-height: 5.75rem;
		padding: 0.5rem 0.6rem 0.5rem 0.55rem;
		overflow: hidden;
		border: 1px solid var(--ink);
		background: var(--inverse);
		color: var(--on-inverse);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.eq {
		position: absolute;
		right: 0.45rem;
		bottom: 0.4rem;
		display: flex;
		gap: 0.14rem;
		align-items: flex-end;
		height: 1.35rem;
		opacity: 0.55;
		pointer-events: none;
	}

	.eq span {
		display: block;
		width: 0.22rem;
		height: var(--h);
		background: var(--accent);
		transform-origin: bottom;
		animation: eq-bounce 1.1s ease-in-out infinite;
	}

	.eq span:nth-child(2) {
		animation-delay: 0.08s;
	}
	.eq span:nth-child(3) {
		animation-delay: 0.16s;
	}
	.eq span:nth-child(4) {
		animation-delay: 0.04s;
	}
	.eq span:nth-child(5) {
		animation-delay: 0.22s;
	}
	.eq span:nth-child(6) {
		animation-delay: 0.12s;
	}
	.eq span:nth-child(7) {
		animation-delay: 0.18s;
	}

	.console:not(.ready) .eq {
		opacity: 0.22;
		animation: none;
	}

	.console:not(.ready) .eq span {
		animation: none;
		height: 18%;
	}

	.lcd-line {
		margin: 0;
		overflow: hidden;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.66rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lcd-line.dim {
		color: color-mix(in srgb, var(--on-inverse) 55%, transparent);
	}

	.lcd-line.warn {
		color: var(--accent);
		white-space: normal;
	}

	.lcd-line.blink {
		animation: blink 1s steps(2, end) infinite;
	}

	.lcd .text-btn {
		color: var(--accent);
		text-decoration-color: color-mix(in srgb, var(--accent) 55%, transparent);
	}

	.cover-bay {
		position: relative;
		width: 5.75rem;
		height: 5.75rem;
		border: 1px solid var(--hard-border);
		background: color-mix(in srgb, var(--ink) 4%, transparent);
		box-shadow: 3px 3px 0 var(--cover-shadow);
	}

	.cover-target {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}

	.cover-target img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-empty {
		display: grid;
		gap: 0.35rem;
		justify-items: center;
		color: var(--muted);
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.cover-clear {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		cursor: pointer;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
		min-width: 0;
	}

	.field-block {
		display: grid;
		gap: 0.55rem;
	}

	.section-label {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.section-label span {
		display: inline-grid;
		place-items: center;
		min-width: 1.4rem;
		padding: 0.08rem 0.3rem;
		border: 1px solid var(--ink);
		background: var(--accent);
		color: var(--on-accent);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
	}

	.grid-2,
	.grid-4 {
		display: grid;
		gap: 0.55rem 0.7rem;
	}

	.grid-2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.grid-4 {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.field {
		display: grid;
		gap: 0.28rem;
		min-width: 0;
	}

	label {
		margin: 0;
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	input,
	select,
	textarea {
		width: 100%;
		margin: 0;
		padding: 0 0.65rem;
		border: 1px solid var(--field-border);
		border-radius: 0.125rem;
		color: var(--ink);
		background: var(--field-surface);
		outline: none;
		font: inherit;
	}

	input,
	select {
		height: 2.35rem;
	}

	textarea {
		padding: 0.5rem 0.65rem;
		line-height: 1.4;
		resize: vertical;
		min-height: 2.85rem;
	}

	input:focus,
	select:focus,
	textarea:focus {
		box-shadow: 3px 3px 0 var(--accent);
	}

	.text-btn {
		width: fit-content;
		margin-top: 0.15rem;
		padding: 0;
		border: 0;
		color: inherit;
		background: transparent;
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: underline;
		text-underline-offset: 0.18rem;
		cursor: pointer;
	}

	.console-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 0.9rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		background: color-mix(in srgb, var(--ink) 3.5%, transparent);
	}

	.foot-hint {
		margin: 0;
		max-width: 28rem;
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.35;
	}

	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-left: auto;
	}

	.pressable {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		justify-content: center;
		width: fit-content;
		min-height: 2.5rem;
		padding: 0 0.95rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 4px 4px 0 var(--hard-shadow);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
	}

	.pressable:disabled {
		opacity: 0.5;
		box-shadow: 2px 2px 0 var(--hard-shadow);
		cursor: not-allowed;
	}

	.pressable.ghost {
		border-color: var(--hard-border);
		color: var(--ink);
		background: transparent;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.45rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse-led {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}

	@keyframes blink {
		50% {
			opacity: 0.35;
		}
	}

	@keyframes eq-bounce {
		0%,
		100% {
			transform: scaleY(0.55);
		}
		50% {
			transform: scaleY(1);
		}
	}

	@media (max-width: 860px) {
		.console-body {
			grid-template-columns: 1fr;
		}

		.grid-4 {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		main {
			padding-top: 0.35rem;
		}

		.page-head {
			margin-bottom: 0.75rem;
		}

		.console-chrome {
			grid-template-columns: auto 1fr;
			gap: 0.45rem 0.65rem;
		}

		.chrome-status {
			grid-column: 1 / -1;
			justify-self: start;
		}

		.signal-row {
			grid-template-columns: minmax(0, 1fr) 5.25rem;
		}

		.cover-bay,
		.lcd {
			height: 5.25rem;
			min-height: 5.25rem;
		}

		.cover-bay {
			width: 5.25rem;
		}

		.grid-2,
		.grid-4 {
			grid-template-columns: 1fr;
		}

		.console-foot {
			align-items: stretch;
		}

		.form-actions {
			width: 100%;
			margin-left: 0;
		}

		.form-actions .pressable {
			flex: 1 1 auto;
		}

		.foot-hint {
			display: none;
		}
	}

	@media (pointer: coarse) {
		input {
			height: var(--tap-min);
		}

		.pressable {
			min-height: var(--tap-min);
		}

		.load-target {
			min-height: 7.5rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.eq span,
		.led.hot.on,
		.lcd-line.blink {
			animation: none;
		}
	}
</style>
