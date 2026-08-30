<script>
	import CoverArt from '#lib/components/CoverArt.svelte';
	import PlayPauseGlyph from '#lib/components/player/PlayPauseGlyph.svelte';
	import Waveform from '#lib/components/player/Waveform.svelte';
	import { parseGenres } from '#lib/genres.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { player } from '#lib/player/player.svelte.js';
	import { toPlayerTrack } from '#lib/player/to-player-track.js';
	import { trackPath } from '#lib/track-path.js';

	/**
	 * @typedef {Object} HeroTrack
	 * @property {string} id
	 * @property {string} [slug]
	 * @property {string} title
	 * @property {string | null} artist
	 * @property {string | null} genre
	 * @property {number | null} durationMs
	 * @property {boolean} hasCover
	 * @property {string | null} [coverUrl]
	 * @property {string | null} [audioUrl]
	 * @property {string | null} username
	 * @property {string} uploaderName
	 * @property {number[] | null} waveform
	 * @property {boolean} likedByViewer
	 * @property {number} [playCount]
	 */

	/** @type {{ track: HeroTrack | null }} */
	let { track: showcaseTrack } = $props();

	/** Position previewed by an in-flight waveform scrub. @type {number | null} */
	let scrubSeconds = $state(null);

	/** Prefer the loaded player track so the splash follows now-playing. */
	const track = $derived(player.current ?? showcaseTrack);
	const isActive = $derived(track != null && player.isCurrent(track.id));
	const isPlaying = $derived(isActive && player.playing);
	const isLoading = $derived(isActive && player.loading);
	const displayTime = $derived(scrubSeconds ?? (isActive ? player.currentTime : 0));
	const durationSec = $derived((track?.durationMs ?? 0) / 1000);
	const progressPct = $derived(
		durationSec > 0 ? Math.min((displayTime / durationSec) * 100, 100) : 0
	);
	const artistLabel = $derived(track ? track.artist || track.uploaderName : '');
	const genreLabel = $derived(
		parseGenres(/** @type {HeroTrack | null} */ (track)?.genre)[0] || 'SNDBNK'
	);
	const cardLabel = $derived(
		track ? `${isActive ? 'Now playing' : 'Now featuring'} ${track.title} by ${artistLabel}` : ''
	);

	/** @returns {import('#lib/player/player.svelte.js').PlayerTrack | null} */
	function asPlayerTrack() {
		return track ? toPlayerTrack(track) : null;
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
	<div class="sound-card live" class:playing={isPlaying} aria-label={cardLabel}>
		<CoverArt
			trackId={track.id}
			hasCover={track.hasCover}
			coverUrl={track.coverUrl}
			class="cover-bleed"
			loading="eager"
			placeholder={false}
		/>

		<div class="card-topline">
			<a href="/feed">From the feed</a>
			<span>{genreLabel}</span>
		</div>

		<div class="stage">
			<CoverArt
				trackId={track.id}
				hasCover={track.hasCover}
				coverUrl={track.coverUrl}
				class="cover"
				loading="eager"
				width="420"
				height="420"
			/>

			<button
				type="button"
				class="play-btn pressable"
				aria-label={isLoading
					? `Loading ${track.title}`
					: isPlaying
						? `Pause ${track.title}`
						: `Play ${track.title}`}
				aria-busy={isLoading}
				onclick={togglePlay}
			>
				<PlayPauseGlyph playing={isPlaying} loading={isLoading} size={28} />
			</button>
		</div>

		<div class="wave">
			<Waveform
				peaks={track.waveform}
				durationMs={track.durationMs}
				currentTime={isActive ? player.currentTime : 0}
				height={96}
				label="Seek within {track.title}"
				onseek={handleSeek}
				onscrub={(seconds) => (scrubSeconds = seconds)}
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

		<div class="card-footer">
			<span class="card-artist">{artistLabel}</span>
			<a class="card-note" href={trackPath(track)}>{track.title}</a>
		</div>
	</div>
{:else}
	<div class="sound-card" aria-label="Abstract audio waveform">
		<div class="card-topline">
			<span>SNDBNK / 001</span>
			<span>Signal in motion</span>
		</div>
		<svg viewBox="0 0 800 320" role="img" aria-labelledby="wave-title wave-description">
			<title id="wave-title">Audio waveform</title>
			<desc id="wave-description">A bright waveform moving across a dark field.</desc>
			<path
				d="M0 160 L20 160 L32 138 L44 183 L58 100 L72 218 L87 150 L103 170 L118 45 L132 275 L148 124 L162 196 L177 82 L192 245 L208 135 L224 175 L240 17 L255 302 L270 111 L286 208 L300 68 L316 259 L332 143 L348 178 L364 93 L380 232 L396 151 L412 168 L428 55 L444 269 L460 119 L476 204 L492 78 L508 251 L524 141 L540 181 L556 103 L572 222 L588 146 L604 174 L620 39 L636 281 L652 128 L668 192 L684 91 L700 237 L716 148 L732 170 L746 118 L760 202 L774 153 L800 160"
			/>
		</svg>
		<div class="card-footer">
			<span>00:00</span>
			<span class="card-note">Play it forward</span>
			<span>03:42</span>
		</div>
	</div>
{/if}

<style>
	.sound-card {
		/* Inverse-friendly ink/paper so Waveform bars read on the dark field. */
		--ink: var(--on-inverse);
		--paper: var(--inverse);

		position: relative;
		isolation: isolate;
		min-height: clamp(28rem, 55vw, 44rem);
		padding: clamp(1.25rem, 3vw, 2.5rem);
		overflow: hidden;
		color: var(--on-inverse);
		background: var(--inverse);
		box-shadow: clamp(0.75rem, 2vw, 1.5rem) clamp(0.75rem, 2vw, 1.5rem) 0
			color-mix(in srgb, var(--accent) 60%, black);
	}

	.sound-card.live {
		display: grid;
		grid-template-rows: auto 1fr auto auto;
		gap: clamp(1rem, 2.5vw, 1.5rem);
	}

	.sound-card :global(img.cover-bleed) {
		position: absolute;
		z-index: -1;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.5;
		filter: blur(14px) saturate(1.15);
		transform: scale(1.08);
		pointer-events: none;
	}

	.card-topline,
	.card-footer {
		position: relative;
		z-index: 1;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.card-topline > * {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-topline a {
		color: inherit;
		text-decoration: none;
	}

	.sound-card:not(.live) svg {
		position: absolute;
		z-index: 1;
		top: 50%;
		left: 50%;
		width: 115%;
		transform: translate(-50%, -50%);
	}

	.sound-card:not(.live) path {
		fill: none;
		stroke: var(--accent);
		stroke-linecap: square;
		stroke-linejoin: bevel;
		stroke-width: 7;
		vector-effect: non-scaling-stroke;
	}

	.sound-card:not(.live) .card-footer {
		position: absolute;
		right: clamp(1.25rem, 3vw, 2.5rem);
		bottom: clamp(1.25rem, 3vw, 2.5rem);
		left: clamp(1.25rem, 3vw, 2.5rem);
		align-items: center;
		justify-content: space-between;
	}

	.stage {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		min-height: 0;
		align-self: center;
	}

	.stage :global(img.cover),
	.stage :global(span.cover.placeholder) {
		display: block;
		width: min(100%, 24rem);
		aspect-ratio: 1;
		border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
		object-fit: cover;
	}

	.stage :global(span.cover.placeholder) {
		background:
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--on-inverse) 12%, transparent) 25%,
				transparent 25%
			),
			color-mix(in srgb, var(--on-inverse) 6%, transparent);
		background-size: 14px 14px;
	}

	.play-btn {
		position: absolute;
		display: inline-flex;
		width: 4.25rem;
		height: 4.25rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--ink);
		border-radius: 50%;
		color: var(--on-accent);
		background: var(--accent);
		cursor: pointer;
		box-shadow: 4px 4px 0 color-mix(in srgb, var(--inverse) 55%, black);
	}

	.play-btn :global(svg) {
		display: block;
	}

	.sound-card.playing .play-btn {
		box-shadow: 4px 4px 0 var(--accent);
	}

	.wave {
		position: relative;
		z-index: 1;
		min-width: 0;
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
		letter-spacing: 0;
		text-transform: none;
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

	.sound-card.live .card-footer {
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
	}

	.card-artist {
		max-width: 100%;
		overflow: hidden;
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		line-height: 1.2;
		text-align: center;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.card-note {
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		color: var(--accent);
		font-family: var(--font-editorial);
		font-size: clamp(1.1rem, 2.1vw, 2rem);
		font-style: italic;
		font-weight: 400;
		letter-spacing: -0.03em;
		line-height: 1.15;
		text-align: center;
		text-decoration: none;
		text-overflow: ellipsis;
		text-transform: none;
		white-space: nowrap;
	}

	a.card-note:hover {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	@media (max-width: 960px) {
		.sound-card {
			min-height: clamp(16rem, 115vw, 42rem);
		}
	}

	@media (max-width: 640px) {
		.sound-card {
			min-height: clamp(16rem, 85vw, 30rem);
			box-shadow: 0.65rem 0.65rem 0 color-mix(in srgb, var(--accent) 60%, black);
		}

		.stage :global(img.cover),
		.stage :global(span.cover.placeholder) {
			width: min(100%, 15rem);
		}

		.play-btn {
			width: var(--tap-min);
			height: var(--tap-min);
		}
	}
</style>
