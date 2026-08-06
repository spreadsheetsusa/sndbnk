<script>
	import { enhance } from '$app/forms';
	import { tick, untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade, slide } from 'svelte/transition';
	import IconCamera from '@tabler/icons-svelte-runes/icons/camera';
	import IconPencil from '@tabler/icons-svelte-runes/icons/pencil';
	import IconPlus from '@tabler/icons-svelte-runes/icons/plus';
	import IconPlayerPauseFilled from '@tabler/icons-svelte-runes/icons/player-pause-filled';
	import IconPlayerPlayFilled from '@tabler/icons-svelte-runes/icons/player-play-filled';
	import IconX from '@tabler/icons-svelte-runes/icons/x';

	import CoverArt from '#lib/components/CoverArt.svelte';
	import InlineMilkdrop from '#lib/components/player/InlineMilkdrop.svelte';
	import Waveform from '#lib/components/player/Waveform.svelte';
	import { MAX_GENRES, normalizeGenreField, parseGenres } from '#lib/genres.js';
	import {
		DEFAULT_TRACK_MEDIA_TYPE,
		TRACK_MEDIA_TYPE_OPTIONS
	} from '#lib/media/track-media-type.js';
	import { formatBytes, formatDuration } from '#lib/media/audio-metadata.js';
	import { player } from '#lib/player/player.svelte.js';
	import { visualizer } from '#lib/player/visualizer.svelte.js';

	/**
	 * @typedef {Object} DeckTrack
	 * @property {string} id
	 * @property {string} title
	 * @property {string | null} artist
	 * @property {string | null} genre
	 * @property {string} [description]
	 * @property {string} [album]
	 * @property {string} [mediaType]
	 * @property {string} [year]
	 * @property {string} [trackNumber]
	 * @property {string} [bpm]
	 * @property {string} [isrc]
	 * @property {string} [comment]
	 * @property {number | null} durationMs
	 * @property {number} [audioBytes]
	 * @property {boolean} hasCover
	 * @property {boolean} [published]
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number[] | null} waveform
	 * @property {boolean} likedByViewer
	 * @property {number | null} [bitrate]
	 * @property {number | null} [sampleRate]
	 * @property {number | null} [channels]
	 * @property {string | null} [codec]
	 * @property {string | null} [encoder]
	 * @property {string | null} [tagTypes]
	 * @property {number | null} [trackGainDb]
	 * @property {string | null} [container]
	 */

	/**
	 * @typedef {{
	 *   message?: string,
	 *   success?: string,
	 *   trackId?: string,
	 *   title?: string,
	 *   description?: string,
	 *   artist?: string,
	 *   album?: string,
	 *   genre?: string,
	 *   mediaType?: string,
	 *   year?: string,
	 *   trackNumber?: string,
	 *   bpm?: string,
	 *   isrc?: string,
	 *   comment?: string,
	 *   hasCover?: boolean,
	 *   tagsWritten?: string[],
	 *   tagsMessage?: string
	 * }} EditForm
	 */

	/**
	 * @type {{
	 *   track: DeckTrack | null,
	 *   visualizerBackdrop?: boolean,
	 *   editing?: boolean,
	 *   form?: EditForm | null,
	 *   onedit?: () => void,
	 *   oncancel?: () => void,
	 *   onupdated?: (patch: Record<string, unknown>) => void,
	 *   onpublished?: (published: boolean) => void
	 * }}
	 */
	let {
		track,
		visualizerBackdrop = false,
		editing = false,
		form = null,
		onedit,
		oncancel,
		onupdated,
		onpublished
	} = $props();

	const showViz = $derived(visualizerBackdrop && visualizer.showInline);
	/** Shared with CSS `--deck-expand-ms` / viz-spacer so viz + edit feel like one system. */
	const expandMs = $derived(prefersReducedMotion.current ? 0 : 320);
	const vizDuration = $derived(expandMs);
	const flipDuration = $derived(prefersReducedMotion.current ? 0 : 180);
	const panelFadeMs = $derived(prefersReducedMotion.current ? 0 : 200);

	/** Slot stays open for the CSS height tween; form unmounts after collapse. */
	let editSlotOpen = $state(false);
	let editFormMounted = $state(false);

	$effect(() => {
		if (editing) {
			editFormMounted = true;
			const frame = requestAnimationFrame(() => {
				editSlotOpen = true;
			});
			return () => cancelAnimationFrame(frame);
		}
		editSlotOpen = false;
		if (expandMs === 0) {
			editFormMounted = false;
			return;
		}
		// Fallback if grid-template-rows does not emit transitionend.
		const timer = setTimeout(() => {
			if (!editSlotOpen) editFormMounted = false;
		}, expandMs + 40);
		return () => clearTimeout(timer);
	});

	/** @param {TransitionEvent} event */
	function onEditSlotTransitionEnd(event) {
		if (event.target !== event.currentTarget) return;
		if (event.propertyName !== 'grid-template-rows') return;
		if (!editSlotOpen) editFormMounted = false;
	}

	/** @type {string[]} */
	let editGenres = $state([]);
	let draftOpen = $state(false);
	let draftValue = $state('');
	/** @type {HTMLInputElement | null} */
	let draftInput = $state(null);
	/** @type {HTMLInputElement | null} */
	let coverInput = $state(null);
	/** @type {string | null} */
	let coverPreviewUrl = $state(null);
	let busy = $state(false);
	let publishBusy = $state(false);
	let writeTags = $state(false);
	/** @type {boolean | null} */
	let publishOverride = $state(null);
	const published = $derived(publishOverride ?? track?.published ?? false);

	let fields = $state({
		title: '',
		description: '',
		artist: '',
		album: '',
		mediaType: DEFAULT_TRACK_MEDIA_TYPE,
		year: '',
		trackNumber: '',
		bpm: '',
		isrc: '',
		comment: ''
	});

	/** Keep chrome edit UI (genres/cover) mounted through the close tween. */
	const editUi = $derived(editing || editFormMounted || editSlotOpen);

	/** Seed local form state when edit mode opens for a track. */
	let seededKey = $state(/** @type {string | null} */ (null));
	const seedKey = $derived(editing && track ? track.id : null);

	$effect(() => {
		const key = seedKey;
		if (!key || !track) {
			if (!editFormMounted) {
				seededKey = null;
				clearCoverPreview();
				draftOpen = false;
				draftValue = '';
			}
			return;
		}
		if (seededKey === key) return;
		seededKey = key;

		const echo = form?.trackId === track.id ? form : null;
		fields = {
			title: echo?.title ?? track.title ?? '',
			description: echo?.description ?? track.description ?? '',
			artist: echo?.artist ?? track.artist ?? '',
			album: echo?.album ?? track.album ?? '',
			mediaType: echo?.mediaType ?? track.mediaType ?? DEFAULT_TRACK_MEDIA_TYPE,
			year: echo?.year ?? track.year ?? '',
			trackNumber: echo?.trackNumber ?? track.trackNumber ?? '',
			bpm: echo?.bpm ?? track.bpm ?? '',
			isrc: echo?.isrc ?? track.isrc ?? '',
			comment: echo?.comment ?? track.comment ?? ''
		};
		editGenres = parseGenres(echo?.genre ?? track.genre);
		draftOpen = false;
		draftValue = '';
		publishOverride = null;
		writeTags = false;
		clearCoverPreview();
	});

	const displayGenres = $derived(editUi ? editGenres : parseGenres(track?.genre));
	const genreFieldValue = $derived(normalizeGenreField(editGenres.join(', ')) ?? '');
	const canAddGenre = $derived(editGenres.length < MAX_GENRES && !draftOpen);

	/** Compact file inspector rows; omit anything missing. */
	const fileMetaRows = $derived.by(() => {
		if (!track) return [];
		/** @type {{ key: string, label: string, value: string }[]} */
		const rows = [];
		if (track.durationMs != null && Number.isFinite(track.durationMs)) {
			rows.push({ key: 'duration', label: 'Duration', value: formatDuration(track.durationMs) });
		}
		if (track.audioBytes != null && Number.isFinite(track.audioBytes)) {
			rows.push({ key: 'size', label: 'Size', value: formatBytes(track.audioBytes) });
		}
		if (track.bitrate != null && Number.isFinite(track.bitrate) && track.bitrate > 0) {
			const kbps = Math.round(track.bitrate / 1000);
			if (kbps > 0) rows.push({ key: 'bitrate', label: 'Bit rate', value: `${kbps} kbps` });
		}
		if (track.sampleRate != null && Number.isFinite(track.sampleRate) && track.sampleRate > 0) {
			const khz = track.sampleRate / 1000;
			const label = Number.isInteger(khz) ? String(khz) : khz.toFixed(1).replace(/\.0$/, '');
			rows.push({ key: 'sampleRate', label: 'Sample rate', value: `${label} kHz` });
		}
		if (track.channels != null && Number.isFinite(track.channels) && track.channels > 0) {
			const ch = track.channels;
			rows.push({
				key: 'channels',
				label: 'Channels',
				value: ch === 1 ? 'mono' : ch === 2 ? 'stereo' : `${ch} ch`
			});
		}
		if (track.trackGainDb != null && Number.isFinite(track.trackGainDb)) {
			const n = track.trackGainDb;
			const sign = n > 0 ? '+' : '';
			rows.push({ key: 'volume', label: 'Volume', value: `${sign}${n.toFixed(2)} dB` });
		}
		if (track.tagTypes) {
			rows.push({ key: 'tagTypes', label: 'ID3 tag', value: track.tagTypes });
		}
		if (track.encoder) {
			rows.push({ key: 'encoder', label: 'Encoded with', value: track.encoder });
		}
		if (track.codec) {
			rows.push({ key: 'format', label: 'Format', value: track.codec });
		}
		return rows;
	});

	/**
	 * Single keyed list so FLIP can run across +, draft, and genre badges.
	 * @returns {Array<{ key: string, kind: 'add' | 'draft' | 'genre', label?: string, index?: number }>}
	 */
	const editChips = $derived.by(() => {
		/** @type {Array<{ key: string, kind: 'add' | 'draft' | 'genre', label?: string, index?: number }>} */
		const chips = [];
		if (canAddGenre) chips.push({ key: '__add', kind: 'add' });
		if (draftOpen) chips.push({ key: '__draft', kind: 'draft' });
		editGenres.forEach((label, index) => {
			chips.push({ key: label, kind: 'genre', label, index });
		});
		return chips;
	});

	/** Track the scrub belongs to; ignored once the deck selection moves on. */
	let scrubTrackId = $state(/** @type {string | null} */ (null));
	/** Position previewed by an in-flight waveform scrub. @type {number | null} */
	let scrubSecondsRaw = $state(null);
	const scrubSeconds = $derived(
		track != null && scrubTrackId === track.id ? scrubSecondsRaw : null
	);

	const isActive = $derived(track != null && player.isCurrent(track.id));
	const isPlaying = $derived(isActive && player.playing);
	const displayTime = $derived(scrubSeconds ?? (isActive ? player.currentTime : 0));
	const durationSec = $derived((track?.durationMs ?? 0) / 1000);
	const progressPct = $derived(
		durationSec > 0 ? Math.min((displayTime / durationSec) * 100, 100) : 0
	);

	/** Edit-mode continuous waveform zoom (px per second); null until measured. */
	const ZOOM_MAX = 512;
	/** @type {HTMLDivElement | null} */
	let waveRowEl = $state.raw(null);
	let zoomPx = $state(1);

	const zoomMin = $derived.by(() => {
		const width = waveRowEl?.clientWidth ?? 0;
		if (width <= 0 || durationSec <= 0) return 1;
		return Math.max(1, Math.floor(width / durationSec));
	});

	$effect(() => {
		void track?.id;
		void editing;
		// Fit width only — do not re-run on resize or the user's zoom is wiped.
		zoomPx = untrack(() => zoomMin);
	});

	// Keep the thumb above the live fit floor if the deck grows.
	$effect(() => {
		const min = zoomMin;
		if (zoomPx < min) zoomPx = min;
	});

	/** @param {Event} event */
	function onZoomInput(event) {
		zoomPx = Number(/** @type {HTMLInputElement} */ (event.currentTarget).value);
	}

	/** @returns {import('#lib/player/player.svelte.js').PlayerTrack | null} */
	function asPlayerTrack() {
		if (!track) return null;
		return {
			id: track.id,
			title: track.title,
			artist: track.artist,
			username: track.username,
			uploaderName: track.uploaderName,
			durationMs: track.durationMs,
			bitrate: track.bitrate ?? null,
			sampleRate: track.sampleRate ?? null,
			channels: track.channels ?? null,
			codec: track.codec ?? null,
			hasCover: track.hasCover,
			waveform: track.waveform,
			likedByViewer: track.likedByViewer
		};
	}

	function togglePlay() {
		const loaded = asPlayerTrack();
		if (loaded) player.toggle(loaded);
	}

	/** @param {number} seconds */
	function handleSeek(seconds) {
		if (isActive) {
			player.seek(seconds);
			player.resume();
			return;
		}
		const loaded = asPlayerTrack();
		if (loaded) player.play(loaded, seconds);
	}

	function clearCoverPreview() {
		if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
		coverPreviewUrl = null;
		if (coverInput) coverInput.value = '';
	}

	function openCoverPicker() {
		coverInput?.click();
	}

	function onCoverChange() {
		const file = coverInput?.files?.[0];
		if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
		coverPreviewUrl = file ? URL.createObjectURL(file) : null;
	}

	async function startDraft() {
		if (!canAddGenre) return;
		draftOpen = true;
		draftValue = '';
		await tick();
		draftInput?.focus();
	}

	function cancelDraft() {
		draftOpen = false;
		draftValue = '';
	}

	/** @param {string} raw */
	function commitDraft(raw) {
		const label = raw.replace(/,/g, '').trim();
		if (!label) {
			cancelDraft();
			return;
		}
		const key = label.toLowerCase();
		if (editGenres.some((g) => g.toLowerCase() === key)) {
			cancelDraft();
			return;
		}
		if (editGenres.length >= MAX_GENRES) {
			cancelDraft();
			return;
		}
		editGenres = [...editGenres, label];
		cancelDraft();
	}

	/** @param {KeyboardEvent} event */
	function onDraftKeydown(event) {
		if (event.key === 'Escape') {
			event.preventDefault();
			cancelDraft();
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			commitDraft(draftValue);
			return;
		}
		if (event.key === ',') {
			event.preventDefault();
			commitDraft(draftValue);
		}
	}

	/** @param {Event} event */
	function onDraftInput(event) {
		const el = /** @type {HTMLInputElement} */ (event.currentTarget);
		const value = el.value;
		if (value.includes(',')) {
			commitDraft(value);
			return;
		}
		draftValue = value;
	}

	/** @param {number} index */
	function removeGenre(index) {
		editGenres = editGenres.filter((_, i) => i !== index);
	}

	async function togglePublished() {
		if (!track || publishBusy) return;
		publishBusy = true;
		try {
			const res = await fetch(`/api/tracks/${track.id}/publish`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ published: !published })
			});
			if (res.ok) {
				const data = await res.json();
				publishOverride = data.published;
				onpublished?.(data.published);
			}
		} finally {
			publishBusy = false;
		}
	}

	function handleCancel() {
		clearCoverPreview();
		draftOpen = false;
		draftValue = '';
		oncancel?.();
	}

	function handleSubmit() {
		busy = true;
		return async ({ result, update }) => {
			try {
				await update({ reset: false });
				if (result.type === 'success' && result.data) {
					const data = /** @type {EditForm} */ (result.data);
					const tagsMessage =
						data.tagsMessage ??
						(data.tagsWritten?.length ? `Wrote tags: ${data.tagsWritten.join(', ')}.` : null);
					onupdated?.({
						id: data.trackId,
						title: data.title,
						description: data.description,
						artist: data.artist,
						album: data.album,
						genre: data.genre,
						mediaType: data.mediaType,
						year: data.year,
						trackNumber: data.trackNumber,
						bpm: data.bpm,
						isrc: data.isrc,
						comment: data.comment,
						hasCover: data.hasCover ?? (Boolean(coverPreviewUrl) || (track?.hasCover ?? false)),
						tagsMessage
					});
					clearCoverPreview();
					writeTags = false;
				}
			} finally {
				busy = false;
			}
		};
	}
</script>

<section
	class="deck"
	class:empty={!track}
	class:viz-on={showViz}
	class:editing={editUi}
	aria-label="Track deck"
>
	{#if visualizerBackdrop}
		{#if showViz}
			<div class="deck-viz" transition:fade={{ duration: vizDuration, easing: cubicOut }}>
				<InlineMilkdrop variant="backdrop" />
			</div>
		{/if}
		<div class="viz-spacer" class:open={showViz} aria-hidden="true"></div>
	{/if}

	<div class="deck-chrome">
		{#if track}
			<div class="deck-body">
				<div class="cover-wrap" class:editable={editUi}>
					{#if coverPreviewUrl}
						<img
							class="cover preview"
							src={coverPreviewUrl}
							alt="Cover preview"
							width="222"
							height="222"
						/>
					{:else}
						<CoverArt
							trackId={track.id}
							hasCover={track.hasCover}
							class="cover"
							loading="eager"
							width="222"
							height="222"
						/>
					{/if}
					{#if editUi}
						<button
							type="button"
							class="cover-camera"
							aria-label="Change cover art"
							onclick={openCoverPicker}
						>
							<IconCamera size={18} stroke={1.75} aria-hidden="true" />
						</button>
					{/if}
				</div>

				<div class="deck-main">
					<div class="deck-head">
						<button
							type="button"
							class="play-btn"
							aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
							onclick={togglePlay}
						>
							{#if isPlaying}
								<IconPlayerPauseFilled size={20} aria-hidden="true" />
							{:else}
								<IconPlayerPlayFilled size={20} aria-hidden="true" />
							{/if}
						</button>

						<div class="titles">
							{#if editUi}
								<input
									class="artist"
									form="deck-edit-form"
									name="artist"
									type="text"
									aria-label="Artist"
									placeholder={track.uploaderName}
									bind:value={fields.artist}
								/>
								<input
									class="title"
									form="deck-edit-form"
									name="title"
									type="text"
									required
									aria-label="Title"
									bind:value={fields.title}
								/>
							{:else}
								<span class="artist">{track.artist || track.uploaderName}</span>
								<a class="title" href="/tracks/{track.id}">{track.title}</a>
							{/if}
						</div>

						<div class="meta" class:editing={editUi}>
							{#if editUi}
								{#each editChips as chip (chip.key)}
									<span class="chip-slot" animate:flip={{ duration: flipDuration }}>
										{#if chip.kind === 'add'}
											<button
												type="button"
												class="genre add"
												aria-label="Add genre"
												onclick={startDraft}
											>
												<IconPlus size={12} stroke={2.25} aria-hidden="true" />
											</button>
										{:else if chip.kind === 'draft'}
											<label class="genre draft">
												<span class="hash" aria-hidden="true">#</span>
												<input
													bind:this={draftInput}
													class="genre-input"
													type="text"
													aria-label="New genre"
													placeholder="genre"
													value={draftValue}
													oninput={onDraftInput}
													onkeydown={onDraftKeydown}
													onblur={() => {
														if (draftValue.trim()) commitDraft(draftValue);
														else cancelDraft();
													}}
												/>
											</label>
										{:else}
											<span class="genre editable">
												# {chip.label}
												<button
													type="button"
													class="genre-x"
													aria-label="Remove {chip.label}"
													onclick={() => removeGenre(chip.index ?? 0)}
												>
													<IconX size={11} stroke={2.25} aria-hidden="true" />
												</button>
											</span>
										{/if}
									</span>
								{/each}
								<button
									type="button"
									class="cancel-btn"
									aria-label="Cancel editing"
									disabled={busy}
									onclick={handleCancel}
								>
									<IconX size={13} stroke={2} aria-hidden="true" />
								</button>
							{:else}
								{#each displayGenres as g (g)}
									<span class="genre"># {g}</span>
								{/each}
								<button
									type="button"
									class="edit-btn"
									aria-label="Edit {track.title}"
									onclick={() => onedit?.()}
								>
									<IconPencil size={13} stroke={2} aria-hidden="true" />
								</button>
							{/if}
						</div>
					</div>

					<div class="wave-stack" bind:this={waveRowEl}>
						{#key `${track.id}:${editing}`}
							<div class="wave-row">
								<Waveform
									peaks={track.waveform}
									durationMs={track.durationMs}
									currentTime={isActive ? player.currentTime : 0}
									playing={isPlaying}
									height={72}
									label="Seek within {track.title}"
									variant={editing ? 'wave' : 'bars'}
									minPxPerSec={editing ? zoomPx : null}
									onseek={handleSeek}
									onscrub={(seconds) => {
										scrubTrackId = track.id;
										scrubSecondsRaw = seconds;
									}}
								/>
								{#if isActive || scrubSeconds != null}
									<span
										class="time-chip current"
										style:left="min(max({progressPct}%, 1.2rem), calc(100% - 1.2rem))"
									>
										{formatDuration(displayTime * 1000)}
									</span>
								{/if}
								<span class="time-chip total">{formatDuration(track.durationMs)}</span>
							</div>
						{/key}
					</div>

					{#if editing}
						<div
							class="wave-zoom-bar"
							transition:slide={{ duration: prefersReducedMotion.current ? 0 : 200 }}
						>
							<label class="zoom-label">
								<span class="zoom-text">Zoom</span>
								<input
									class="zoom-range"
									type="range"
									min={zoomMin}
									max={Math.max(zoomMin, ZOOM_MAX)}
									step="1"
									value={zoomPx}
									aria-label="Waveform zoom"
									oninput={onZoomInput}
								/>
							</label>
						</div>
					{/if}
				</div>
			</div>

			<!-- Grid 0fr→1fr expands downward under the player; keeps deck-body pinned. -->
			<div class="edit-slot" class:open={editSlotOpen} ontransitionend={onEditSlotTransitionEnd}>
				<div class="edit-slot-inner">
					{#if editFormMounted}
						<form
							id="deck-edit-form"
							class="edit-console"
							method="POST"
							action="?/update"
							enctype="multipart/form-data"
							use:enhance={handleSubmit}
							aria-busy={busy}
							aria-label="Edit track"
							in:fade={{
								duration: panelFadeMs,
								easing: cubicOut,
								delay: prefersReducedMotion.current ? 0 : 60
							}}
						>
							<input type="hidden" name="trackId" value={track.id} />
							<input type="hidden" name="genre" value={genreFieldValue} />
							<input
								bind:this={coverInput}
								class="sr-file"
								name="cover"
								type="file"
								accept="image/*"
								onchange={onCoverChange}
							/>

							<div class="edit-main">
								{#if form?.message && form.trackId === track.id && !busy}
									<div class="banner error" role="alert">{form.message}</div>
								{/if}
								{#if form?.success && form.trackId === track.id && !busy}
									<div class="banner ok" role="status">{form.success}</div>
								{/if}

								<div class="fields">
									<div class="grid-2">
										<div class="field">
											<label for="deck-album">Album</label>
											<input id="deck-album" name="album" type="text" bind:value={fields.album} />
										</div>
										<div class="field">
											<label for="deck-mediaType">Type</label>
											<select id="deck-mediaType" name="mediaType" bind:value={fields.mediaType}>
												{#each TRACK_MEDIA_TYPE_OPTIONS as option (option.value)}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>
										</div>
									</div>

									<div class="grid-4">
										<div class="field">
											<label for="deck-year">Year</label>
											<input
												id="deck-year"
												name="year"
												type="text"
												inputmode="numeric"
												bind:value={fields.year}
											/>
										</div>
										<div class="field">
											<label for="deck-trackNumber">Track #</label>
											<input
												id="deck-trackNumber"
												name="trackNumber"
												type="text"
												inputmode="numeric"
												bind:value={fields.trackNumber}
											/>
										</div>
										<div class="field">
											<label for="deck-bpm">BPM</label>
											<input
												id="deck-bpm"
												name="bpm"
												type="text"
												inputmode="numeric"
												bind:value={fields.bpm}
											/>
										</div>
										<div class="field">
											<label for="deck-isrc">ISRC</label>
											<input
												id="deck-isrc"
												name="isrc"
												type="text"
												autocapitalize="none"
												bind:value={fields.isrc}
											/>
										</div>
									</div>

									<div class="grid-2">
										<div class="field">
											<label for="deck-description">Description</label>
											<textarea
												id="deck-description"
												name="description"
												rows="2"
												bind:value={fields.description}></textarea>
										</div>
										<div class="field">
											<label for="deck-comment">Comment</label>
											<textarea
												id="deck-comment"
												name="comment"
												rows="2"
												bind:value={fields.comment}></textarea>
										</div>
									</div>
								</div>

								{#if fileMetaRows.length > 0}
									<dl class="file-meta" aria-label="File metadata">
										{#each fileMetaRows as row (row.key)}
											<div class="meta-row">
												<dt>{row.label}</dt>
												<dd>{row.value}</dd>
											</div>
										{/each}
									</dl>
								{/if}

								<div class="console-foot">
									<div class="foot-meta">
										<div class="publish-field">
											<span class="publish-label">Published</span>
											<button
												type="button"
												class="publish-switch"
												role="switch"
												aria-checked={published}
												aria-label={published
													? `Unpublish ${track.title}`
													: `Publish ${track.title}`}
												title={published
													? 'Visible on your public profile'
													: 'Hidden from your public profile'}
												disabled={publishBusy || busy}
												onclick={togglePublished}
											>
												<span class="knob"></span>
											</button>
										</div>
										<label class="write-tags">
											<input
												type="checkbox"
												name="writeTags"
												value="1"
												bind:checked={writeTags}
												disabled={busy}
											/>
											<span>Write tags to file</span>
										</label>
									</div>
									<div class="form-actions">
										<button
											class="pressable ghost"
											type="button"
											disabled={busy}
											onclick={handleCancel}
										>
											Cancel
										</button>
										<button class="pressable" type="submit" disabled={busy}>
											{busy ? 'Saving…' : 'Save'}
										</button>
									</div>
								</div>
							</div>
						</form>
					{/if}
				</div>
			</div>
		{:else}
			<p class="empty-copy">Select a track below to load its waveform here.</p>
		{/if}
	</div>
</section>

<style>
	.deck {
		/* flex-start: viz spacer pushes chrome down; edit form grows chrome downward
		   so the player row stays pinned (flex-end left a gap above the chrome). */
		/* Compact cover matches deck-head + gap + waveform; edit expands to sidebar width. */
		--deck-main-gap: 0.75rem;
		--deck-wave-height: 72px;
		--deck-cover-size-edit: calc(15rem - 18px);
		--deck-cover-size: calc(2.6rem + var(--deck-main-gap) + var(--deck-wave-height) + 10px);
		--deck-expand-ms: 320ms;
		--deck-expand-ease: cubic-bezier(0.33, 1, 0.68, 1);
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		min-width: 0;
		min-height: 10.5rem;
		overflow: hidden;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.deck.editing {
		--deck-cover-size: var(--deck-cover-size-edit);
	}

	.deck.viz-on {
		/* Expanded headroom shows the canvas; chrome sits on paper under the spacer. */
		background: #000;
	}

	.deck.empty:not(.viz-on) {
		border-style: dashed;
		border-color: color-mix(in srgb, var(--ink) 30%, transparent);
		box-shadow: none;
	}

	.deck-viz {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.viz-spacer {
		flex: 0 0 auto;
		height: 0;
		transition: height var(--deck-expand-ms) var(--deck-expand-ease);
		pointer-events: none;
	}

	.viz-spacer.open {
		height: 11.5rem;
	}

	.deck-chrome {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0.9rem 1rem;
		background: var(--paper);
	}

	.deck.viz-on .deck-chrome {
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background: color-mix(in srgb, var(--paper) 92%, transparent);
		backdrop-filter: blur(8px);
	}

	.deck.empty .deck-chrome {
		flex: 1 1 auto;
		align-items: center;
		justify-content: center;
		min-height: 10.5rem;
	}

	.edit-slot {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows var(--deck-expand-ms) var(--deck-expand-ease);
	}

	.edit-slot.open {
		grid-template-rows: 1fr;
	}

	.edit-slot-inner {
		min-height: 0;
		overflow: hidden;
	}

	.empty-copy {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.deck-body {
		display: flex;
		gap: 0.9rem;
		align-items: stretch;
		min-width: 0;
	}

	.cover-wrap {
		position: relative;
		flex-shrink: 0;
		align-self: start;
		width: var(--deck-cover-size);
		height: var(--deck-cover-size);
		overflow: hidden;
		border-radius: 0.125rem;
		transition:
			width var(--deck-expand-ms) var(--deck-expand-ease),
			height var(--deck-expand-ms) var(--deck-expand-ease);
	}

	.cover-wrap :global(img.cover),
	.cover-wrap :global(span.cover.placeholder),
	.cover-wrap img.preview {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: 0.125rem;
		object-fit: cover;
	}

	.cover-wrap :global(span.cover.placeholder) {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 14px 14px;
	}

	.cover-camera {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0.125rem;
		color: var(--on-inverse);
		background: color-mix(in srgb, var(--inverse) 48%, transparent);
		opacity: 0;
		cursor: pointer;
		transition: opacity 160ms ease;
	}

	.cover-wrap.editable:hover .cover-camera,
	.cover-wrap.editable:focus-within .cover-camera,
	.cover-camera:focus-visible {
		opacity: 1;
	}

	.cover-camera:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.sr-file {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.deck-main {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: var(--deck-main-gap);
		min-width: 0;
	}

	.deck-head {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.play-btn {
		display: inline-flex;
		width: 2.6rem;
		height: 2.6rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--ink);
		border-radius: 50%;
		color: var(--on-accent);
		background: var(--accent);
		cursor: pointer;
		flex-shrink: 0;
	}

	.play-btn :global(svg) {
		display: block;
	}

	.titles {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-width: 0;
		line-height: 1.25;
	}

	.artist {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title {
		overflow: hidden;
		color: var(--ink);
		font-size: 1rem;
		font-weight: 800;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	input.artist,
	input.title {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		outline: none;
	}

	input.artist::placeholder {
		color: var(--muted);
		opacity: 1;
	}

	input.artist:focus-visible,
	input.title:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	a.title:hover {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		align-items: center;
		justify-content: flex-end;
		margin-left: auto;
		flex-shrink: 1;
		min-width: 0;
	}

	.chip-slot {
		display: inline-flex;
		min-width: 0;
	}

	.genre {
		display: inline-flex;
		gap: 0.2rem;
		align-items: center;
		min-height: 1.7rem;
		padding: 0.2rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		border-radius: 9999px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		font-size: 0.68rem;
		font-weight: 800;
		white-space: nowrap;
		transition:
			padding 180ms ease,
			gap 180ms ease;
	}

	.edit-btn {
		display: inline-grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		flex-shrink: 0;
		padding: 0;
		border: 1px solid var(--ink);
		border-radius: 50%;
		color: var(--on-accent);
		background: var(--accent);
		cursor: pointer;
	}

	.edit-btn :global(svg) {
		display: block;
	}

	.edit-btn:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.cancel-btn {
		display: inline-grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		flex-shrink: 0;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		border-radius: 50%;
		color: var(--ink);
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		cursor: pointer;
	}

	.cancel-btn :global(svg) {
		display: block;
	}

	.cancel-btn:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.cancel-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.genre.editable {
		padding-right: 0.3rem;
		gap: 0.3rem;
	}

	.genre.add {
		justify-content: center;
		width: 1.7rem;
		height: 1.7rem;
		padding: 0;
		cursor: pointer;
		font: inherit;
	}

	.genre.draft {
		min-width: 5.5rem;
		padding: 0.15rem 0.55rem;
		cursor: text;
	}

	.genre .hash {
		opacity: 0.7;
	}

	.genre-input {
		width: 4.5rem;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
		color: inherit;
		background: transparent;
		font: inherit;
		font-weight: 800;
		outline: none;
	}

	.genre-x {
		display: inline-grid;
		place-items: center;
		width: 1.15rem;
		height: 1.15rem;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 9999px;
		color: inherit;
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		cursor: pointer;
	}

	.genre-x:hover {
		background: color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.wave-stack,
	.wave-row {
		position: relative;
		min-width: 0;
		max-width: 100%;
	}

	.wave-zoom-bar {
		display: flex;
		align-items: center;
		min-width: 0;
		margin: 0.35rem 0 0.15rem 16px;
		padding: 0.2rem 0;
	}

	.zoom-label {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		min-width: 0;
		max-width: 16rem;
		width: 100%;
		color: var(--muted);
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.zoom-text {
		flex: none;
	}

	.zoom-range {
		flex: 1;
		min-width: 0;
		height: 0.55rem;
		margin: 0;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--field-border));
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--accent) 10%, var(--field-surface));
		appearance: none;
		cursor: pointer;
	}

	.zoom-range::-webkit-slider-thumb {
		width: 0.7rem;
		height: 0.7rem;
		border: 1px solid var(--ink);
		border-radius: 0.125rem;
		background: var(--accent);
		appearance: none;
		cursor: grab;
	}

	.zoom-range::-moz-range-thumb {
		width: 0.7rem;
		height: 0.7rem;
		border: 1px solid var(--ink);
		border-radius: 0.125rem;
		background: var(--accent);
		cursor: grab;
	}

	.zoom-range:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.time-chip {
		position: absolute;
		top: 50%;
		z-index: 2;
		padding: 0.1rem 0.3rem;
		background: var(--inverse);
		color: var(--on-inverse);
		font-size: 0.66rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1.3;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.time-chip.current {
		transform: translate(-50%, -50%);
		color: var(--accent);
	}

	.time-chip.total {
		right: 0;
		background: var(--accent);
		color: var(--on-accent);
	}

	.edit-console {
		/* Align fields with deck-main (cover column + gap). */
		display: block;
		padding: 0.75rem 0 0 calc(var(--deck-cover-size) + 0.9rem);
	}

	.file-meta {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.3rem 0.75rem;
		min-width: 0;
		margin: 0;
		padding: 0;
	}

	.meta-row {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		min-width: 0;
	}

	.meta-row dt {
		margin: 0;
		overflow: hidden;
		color: color-mix(in srgb, var(--ink) 40%, transparent);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta-row dd {
		margin: 0;
		overflow: hidden;
		color: color-mix(in srgb, var(--ink) 70%, transparent);
		font-size: 0.68rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.edit-main {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.banner {
		margin: 0;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--ink);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.banner.error {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}

	.banner.ok {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
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

	.field label {
		margin: 0;
		color: color-mix(in srgb, var(--ink) 40%, transparent);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.field input,
	.field select,
	.field textarea {
		width: 100%;
		margin: 0;
		padding: 0 0.65rem;
		border: 1px solid color-mix(in srgb, var(--ink) 12%, var(--paper));
		border-radius: 0.125rem;
		color: var(--ink);
		background: transparent;
		outline: none;
		font: inherit;
	}

	.field input,
	.field select {
		height: 2.2rem;
	}

	.field textarea {
		padding: 0.45rem 0.65rem;
		line-height: 1.4;
		resize: vertical;
		min-height: 2.6rem;
	}

	.field input:focus,
	.field select:focus,
	.field textarea:focus {
		box-shadow: 3px 3px 0 var(--accent);
	}

	.console-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: center;
		justify-content: space-between;
	}

	.foot-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1.1rem;
		align-items: center;
		min-width: 0;
	}

	.write-tags {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		min-width: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		cursor: pointer;
		user-select: none;
	}

	.write-tags input {
		width: 0.95rem;
		height: 0.95rem;
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.write-tags:has(input:disabled) {
		opacity: 0.55;
		cursor: default;
	}

	.publish-field {
		display: inline-flex;
		gap: 0.55rem;
		align-items: center;
		min-width: 0;
	}

	.publish-label {
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.publish-switch {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
		box-sizing: border-box;
		width: 2.2rem;
		height: 1.1rem;
		align-items: center;
		padding: 1px;
		appearance: none;
		-webkit-appearance: none;
		border: 1px solid
			color-mix(in srgb, var(--accent) 18%, color-mix(in srgb, var(--ink) 28%, transparent));
		border-radius: 0.125rem;
		background: color-mix(
			in srgb,
			var(--accent) 6%,
			color-mix(in srgb, var(--ink) 8%, var(--paper))
		);
		box-shadow: inset 0 1px 2px color-mix(in srgb, var(--ink) 20%, transparent);
		cursor: pointer;
	}

	.publish-switch[aria-checked='true'] {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--ink));
		background: var(--accent);
		box-shadow:
			inset 0 1px 2px color-mix(in srgb, var(--ink) 32%, transparent),
			inset 0 -1px 0 color-mix(in srgb, var(--on-accent) 16%, transparent);
	}

	.publish-switch:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.publish-switch:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.publish-switch .knob {
		flex-shrink: 0;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--ink) 42%, var(--paper));
		box-shadow: 0 1px 1px color-mix(in srgb, var(--ink) 28%, transparent);
		transition: transform 120ms ease;
	}

	.publish-switch[aria-checked='true'] .knob {
		background: var(--on-accent);
		box-shadow: 0 1px 1px color-mix(in srgb, var(--ink) 35%, transparent);
		transform: translateX(1.05rem);
	}

	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		align-items: center;
		margin-left: auto;
	}

	.pressable {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		justify-content: center;
		width: fit-content;
		min-height: 2.35rem;
		padding: 0 0.95rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 4px 4px 0 var(--hard-shadow);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.pressable.ghost {
		color: var(--ink);
		background: transparent;
		box-shadow: none;
	}

	.pressable:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	@media (max-width: 720px) {
		.grid-4 {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.file-meta {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.meta:not(.editing) .genre {
			display: none;
		}

		.deck,
		.deck.editing {
			--deck-cover-size: 2.6rem;
		}

		.deck-body {
			flex-wrap: wrap;
			gap: 0.55rem;
			align-items: center;
		}

		.deck-main,
		.deck-head {
			display: contents;
		}

		.play-btn {
			order: 0;
		}

		.cover-wrap {
			order: 1;
		}

		.titles {
			order: 2;
		}

		.meta {
			order: 3;
		}

		.wave-stack {
			order: 4;
			flex: 1 1 100%;
		}

		.wave-zoom-bar {
			order: 4;
			flex: 1 1 100%;
			margin-left: 0;
		}

		.edit-console {
			padding-left: 0;
		}

		.cover-camera {
			opacity: 1;
			background: color-mix(in srgb, var(--inverse) 35%, transparent);
		}

		.grid-2 {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) and (pointer: coarse) {
		.deck,
		.deck.editing {
			--deck-cover-size: var(--tap-min);
		}
	}

	@media (pointer: coarse) {
		.play-btn {
			width: var(--tap-min);
			height: var(--tap-min);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.deck {
			--deck-expand-ms: 0ms;
		}

		.viz-spacer,
		.edit-slot,
		.genre,
		.cover-wrap,
		.cover-camera {
			transition: none;
		}
	}
</style>
