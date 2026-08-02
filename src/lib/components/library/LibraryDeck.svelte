<script>
	import IconPlayerPauseFilled from '@tabler/icons-svelte-runes/icons/player-pause-filled';
	import IconPlayerPlayFilled from '@tabler/icons-svelte-runes/icons/player-play-filled';

	import Waveform from '#lib/components/player/Waveform.svelte';
	import { player } from '#lib/player/player.svelte.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';

	/**
	 * @typedef {Object} DeckTrack
	 * @property {string} id
	 * @property {string} title
	 * @property {string | null} artist
	 * @property {string | null} genre
	 * @property {number | null} durationMs
	 * @property {boolean} hasCover
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number[] | null} waveform
	 * @property {boolean} likedByViewer
	 */

	/** @type {{ track: DeckTrack | null }} */
	let { track } = $props();

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
</script>

{#if track}
	<section class="deck" aria-label="Track deck">
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

			{#if track.hasCover}
				<img class="cover" src="/api/media/{track.id}/cover" alt="" width="44" height="44" />
			{:else}
				<span class="cover placeholder" aria-hidden="true"></span>
			{/if}

			<div class="titles">
				<span class="artist">{track.artist || track.uploaderName}</span>
				<a class="title" href="/tracks/{track.id}">{track.title}</a>
			</div>

			<div class="meta">
				{#if track.genre}
					<span class="genre"># {track.genre}</span>
				{/if}

				<span class="clock">
					<span class="elapsed">{formatDuration(displayTime * 1000)}</span>
					<span class="total">{formatDuration(track.durationMs)}</span>
				</span>
			</div>
		</div>

		{#key track.id}
			<Waveform
				peaks={track.waveform}
				durationMs={track.durationMs}
				currentTime={isActive ? player.currentTime : 0}
				height={72}
				label="Seek within {track.title}"
				onseek={handleSeek}
				onscrub={(seconds) => {
					scrubTrackId = track.id;
					scrubSecondsRaw = seconds;
				}}
			/>
		{/key}
	</section>
{:else}
	<section class="deck empty" aria-label="Track deck">
		<p>Select a track below to load its waveform here.</p>
	</section>
{/if}

<style>
	.deck {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 9.5rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.deck.empty {
		align-items: center;
		justify-content: center;
		border-style: dashed;
		border-color: color-mix(in srgb, var(--ink) 30%, transparent);
		box-shadow: none;
	}

	.deck.empty p {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
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

	.cover {
		display: block;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: 0.125rem;
		box-shadow: 2px 2px 0 var(--cover-shadow);
		object-fit: cover;
		flex-shrink: 0;
	}

	.cover.placeholder {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ink) 8%, transparent) 25%, transparent 25%),
			var(--paper);
		background-size: 10px 10px;
	}

	.titles {
		display: flex;
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

	.title:hover {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.meta {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		margin-left: auto;
		flex-shrink: 0;
	}

	.genre {
		padding: 0.2rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		font-size: 0.68rem;
		font-weight: 800;
		white-space: nowrap;
	}

	.clock {
		display: flex;
		gap: 0.35rem;
		align-items: baseline;
		font-size: 0.78rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.elapsed {
		color: var(--accent);
		filter: contrast(1.2);
	}

	.total {
		color: var(--muted);
	}

	.total::before {
		content: '/ ';
	}

	@media (max-width: 640px) {
		.genre {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.play-btn {
			width: var(--tap-min);
			height: var(--tap-min);
		}
	}
</style>
