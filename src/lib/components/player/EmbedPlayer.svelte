<script>
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import CoverArt from '#lib/components/CoverArt.svelte';
	import PlayPauseGlyph from '#lib/components/player/PlayPauseGlyph.svelte';
	import Waveform from '#lib/components/player/Waveform.svelte';
	import { EMBED_PLAYER_HEIGHT } from '#lib/embed-player.js';
	import { formatDuration } from '#lib/media/audio-metadata.js';
	import { player } from '#lib/player/player.svelte.js';
	import { toPlayerTrack } from '#lib/player/to-player-track.js';

	/**
	 * Compact framed player. Cover art is the play control.
	 *
	 * @type {{
	 *   track: {
	 *     id: string,
	 *     title: string,
	 *     artist?: string | null,
	 *     username?: string | null,
	 *     uploaderName: string,
	 *     durationMs?: number | null,
	 *     hasCover: boolean,
	 *     coverUrl?: string | null,
	 *     audioUrl?: string | null,
	 *     waveform?: number[] | null,
	 *     slug?: string | null
	 *   },
	 *   trackHref: string,
	 *   artistHref: string,
	 *   brandHref: string,
	 *   brandLabel: string,
	 *   showBrand?: boolean,
	 *   autoplay?: boolean
	 * }}
	 */
	let {
		track,
		trackHref,
		artistHref,
		brandHref,
		brandLabel,
		showBrand = true,
		autoplay = false
	} = $props();

	// Same-origin iframes share localStorage with the listener's tab.
	if (browser) player.isolate();

	/** @type {number | null} */
	let scrubSeconds = $state(null);

	const artistName = $derived(track.artist || track.uploaderName);
	const active = $derived(player.isCurrent(track.id));
	const playing = $derived(active && player.playing);
	const loading = $derived(active && player.loading);
	const displaySeconds = $derived(scrubSeconds ?? (active ? player.currentTime : 0));
	const progressPct = $derived.by(() => {
		const duration = track.durationMs ? track.durationMs / 1000 : player.duration;
		if (!duration) return 0;
		return (displaySeconds / duration) * 100;
	});
	const playLabel = $derived(`${playing ? 'Pause' : 'Play'} ${track.title}`);

	onMount(() => {
		if (!autoplay) return;
		player.play(toPlayerTrack(track));
	});

	function toggle() {
		player.toggle(toPlayerTrack(track));
	}

	/** @param {number} seconds */
	function seek(seconds) {
		if (player.isCurrent(track.id)) {
			player.seek(seconds);
			player.resume();
			return;
		}
		player.play(toPlayerTrack(track), seconds);
	}
</script>

<article class="widget" style:max-height="{EMBED_PLAYER_HEIGHT}px">
	<button
		type="button"
		class="cover-play"
		aria-label={playLabel}
		aria-busy={loading}
		onclick={toggle}
	>
		<CoverArt
			trackId={track.id}
			hasCover={track.hasCover}
			coverUrl={track.coverUrl}
			loading="eager"
			fetchpriority="high"
			alt=""
			wrapperClass="cover"
		/>
		<span class="mark">
			<PlayPauseGlyph {playing} {loading} size={18} />
		</span>
	</button>

	<div class="meta">
		<div class="titles">
			<a class="title" href={trackHref} target="_blank" rel="noopener noreferrer">{track.title}</a>
			<p class="by">
				<a href={artistHref} target="_blank" rel="noopener noreferrer">{artistName}</a>
				{#if showBrand}
					<a class="brand" href={brandHref} target="_blank" rel="noopener noreferrer"
						>{brandLabel}</a
					>
				{/if}
			</p>
		</div>
		<div class="wave">
			<Waveform
				peaks={track.waveform ?? null}
				durationMs={track.durationMs ?? null}
				currentTime={displaySeconds}
				{playing}
				height={48}
				label="Seek within {track.title}"
				onseek={seek}
				onscrub={(seconds) => (scrubSeconds = seconds)}
			/>
			{#if active || scrubSeconds != null}
				<span
					class="time current"
					style:left="min(max({progressPct}%, 1.2rem), calc(100% - 1.2rem))"
				>
					{formatDuration(displaySeconds * 1000)}
				</span>
			{/if}
			<span class="time total">{formatDuration(track.durationMs)}</span>
		</div>
	</div>
</article>

<style>
	.widget {
		box-sizing: border-box;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.7rem;
		align-items: stretch;
		height: 100%;
		padding: 0.45rem 0.6rem;
		background: var(--paper);
		color: var(--ink);
	}

	.cover-play {
		position: relative;
		box-sizing: border-box;
		display: block;
		justify-self: start;
		width: auto;
		height: 100%;
		aspect-ratio: 1;
		padding: 0;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.cover-play :global(.cover) {
		width: 100%;
		height: 100%;
	}

	.cover-play :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.mark {
		position: absolute;
		right: 0.3rem;
		bottom: 0.3rem;
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		background: color-mix(in srgb, var(--paper) 82%, transparent);
		color: var(--ink);
		pointer-events: none;
	}

	.meta {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 0.35rem;
		min-width: 0;
	}

	.titles {
		min-width: 0;
	}

	.title,
	.by a {
		color: inherit;
		text-decoration: none;
	}

	.title {
		display: block;
		overflow: hidden;
		font-size: 0.98rem;
		font-weight: 600;
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title:hover,
	.by a:hover {
		color: var(--accent);
	}

	.by {
		display: flex;
		gap: 0.55rem;
		align-items: baseline;
		margin: 0.1rem 0 0;
		min-width: 0;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.2;
	}

	.by a:first-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.brand {
		margin-left: auto;
		flex: none;
		color: var(--muted);
		font-family: var(--font-lcd);
		font-size: 0.95rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.wave {
		position: relative;
		min-width: 0;
		min-height: 0;
	}

	.time {
		position: absolute;
		top: 50%;
		z-index: 2;
		padding: 0.08rem 0.28rem;
		background: var(--inverse);
		color: var(--on-inverse);
		font-size: 0.66rem;
		font-variant-numeric: tabular-nums;
		font-weight: 800;
		line-height: 1.3;
		pointer-events: none;
		transform: translateY(-50%);
	}

	.time.current {
		color: var(--accent);
		transform: translate(-50%, -50%);
	}

	.time.total {
		right: 0;
		background: var(--accent);
		color: var(--on-accent);
	}

	.cover-play:focus-visible,
	.title:focus-visible,
	.by a:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}
</style>
