<script>
	import IconDisc from '@tabler/icons-svelte-runes/icons/disc';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconMessage from '@tabler/icons-svelte-runes/icons/message';
	import IconMicrophone2 from '@tabler/icons-svelte-runes/icons/microphone-2';
	import IconTag from '@tabler/icons-svelte-runes/icons/tag';
	import IconUsers from '@tabler/icons-svelte-runes/icons/users';
	import IconWaveSine from '@tabler/icons-svelte-runes/icons/wave-sine';
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';

	/**
	 * @type {{
	 *   stats: {
	 *     trackCount: number,
	 *     artistCount: number,
	 *     totalDurationMs: number,
	 *     likeCount: number,
	 *     commentCount: number,
	 *     topArtist: { name: string, username: string | null, likeCount: number } | null,
	 *     topGenre: { genre: string, count: number } | null
	 *   }
	 * }}
	 */
	let { stats } = $props();

	const COUNT_UP_MS = 750;
	const HOUR_MS = 3_600_000;
	const numberFormat = new Intl.NumberFormat();

	/**
	 * 0 → 1 ramp that every figure is multiplied by, so the strip tallies itself up.
	 * Server-rendered markup starts at the real numbers, so no-JS readers see them.
	 */
	let progress = $state(browser ? 0 : 1);

	/** @param {number} value */
	const tally = (value) => numberFormat.format(Math.round(value * progress));

	const runtime = $derived.by(() => {
		const hours = stats.totalDurationMs / HOUR_MS;
		if (hours >= 1) {
			const shown = (hours * progress).toFixed(hours >= 10 ? 0 : 1);
			return { value: shown, unit: 'Hrs of sound' };
		}
		return { value: tally(stats.totalDurationMs / 60_000), unit: 'Min of sound' };
	});

	onMount(() => {
		if (prefersReducedMotion.current) {
			progress = 1;
			return;
		}

		let frame = 0;
		const started = performance.now();
		const tick = () => {
			const elapsed = Math.min((performance.now() - started) / COUNT_UP_MS, 1);
			progress = 1 - (1 - elapsed) ** 3;
			if (elapsed < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(frame);
	});
</script>

<ul class="stat-strip" aria-label="SNDBNK by the numbers">
	<li class="stat accent">
		<span class="stat-icon" aria-hidden="true"><IconDisc size={16} stroke={1.75} /></span>
		<span class="stat-value display-face">{tally(stats.trackCount)}</span>
		<span class="stat-label">Tracks banked</span>
	</li>

	<li class="stat">
		<span class="stat-icon" aria-hidden="true"><IconUsers size={16} stroke={1.75} /></span>
		<span class="stat-value display-face">{tally(stats.artistCount)}</span>
		<span class="stat-label">Artists in the bank</span>
	</li>

	<li class="stat">
		<span class="stat-icon" aria-hidden="true"><IconWaveSine size={16} stroke={1.75} /></span>
		<span class="stat-value display-face">{runtime.value}</span>
		<span class="stat-label">{runtime.unit}</span>
	</li>

	<li class="stat">
		<span class="stat-icon" aria-hidden="true"><IconHeart size={16} stroke={1.75} /></span>
		<span class="stat-value display-face">{tally(stats.likeCount)}</span>
		<span class="stat-label">Hearts thrown</span>
	</li>

	<li class="stat">
		<span class="stat-icon" aria-hidden="true"><IconMessage size={16} stroke={1.75} /></span>
		<span class="stat-value display-face">{tally(stats.commentCount)}</span>
		<span class="stat-label">Notes left</span>
	</li>

	{#if stats.topArtist}
		<li class="stat wide">
			<span class="stat-icon" aria-hidden="true"><IconMicrophone2 size={16} stroke={1.75} /></span>
			{#if stats.topArtist.username}
				<a class="stat-value name" href="/users/{stats.topArtist.username}">
					{stats.topArtist.name}
				</a>
			{:else}
				<span class="stat-value name">{stats.topArtist.name}</span>
			{/if}
			<span class="stat-label">Most loved artist</span>
		</li>
	{/if}

	{#if stats.topGenre}
		<li class="stat wide">
			<span class="stat-icon" aria-hidden="true"><IconTag size={16} stroke={1.75} /></span>
			<a class="stat-value name" href="/feed?genre={encodeURIComponent(stats.topGenre.genre)}">
				{stats.topGenre.genre}
			</a>
			<span class="stat-label">Loudest genre</span>
		</li>
	{/if}
</ul>

<style>
	.stat-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.stat {
		position: relative;
		display: grid;
		flex: 1 1 0;
		grid-template-columns: auto 1fr;
		gap: 0 0.5rem;
		align-items: center;
		min-width: 8.5rem;
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 4px 4px 0 var(--hard-shadow);
	}

	.stat.wide {
		flex: 1.35 1 0;
		min-width: 11rem;
	}

	.stat.accent {
		color: var(--on-accent);
		border-color: var(--ink);
		background: var(--accent);
	}

	.stat-icon {
		display: inline-flex;
		grid-row: span 2;
		color: currentcolor;
		opacity: 0.7;
	}

	.stat-icon :global(svg) {
		display: block;
	}

	.stat-value {
		font-size: clamp(1.35rem, 2.2vw, 1.85rem);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.stat-value.name {
		overflow: hidden;
		min-width: 0;
		color: inherit;
		font-size: 1rem;
		font-weight: 800;
		letter-spacing: -0.01em;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	a.stat-value.name:hover {
		text-decoration: underline;
		text-underline-offset: 0.25rem;
	}

	.stat-label {
		margin-top: 0.3rem;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		line-height: 1;
		text-transform: uppercase;
		opacity: 0.75;
	}

	@media (max-width: 560px) {
		.stat {
			min-width: 0;
			flex: 1 1 8rem;
		}
	}
</style>
