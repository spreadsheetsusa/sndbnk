<script>
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';

	import CoverArt from '#lib/components/CoverArt.svelte';
	import { trackPath } from '#lib/track-path.js';

	/**
	 * @type {{
	 *   facets: import('#lib/builder/stream-query.js').StreamFacets | null,
	 *   artist: string | null,
	 *   genre: string | null,
	 *   onartist: (name: string | null) => void,
	 *   ongenre: (name: string | null) => void
	 * }}
	 */
	let { facets, artist, genre, onartist, ongenre } = $props();

	const uid = $props.id();

	const panels = [
		{ key: 'liked', label: 'Most liked' },
		{ key: 'artists', label: 'Artists' },
		{ key: 'genres', label: 'Genres' }
	];

	let activePanel = $state(0);
	/** @type {HTMLElement | undefined} */
	let rail;

	/**
	 * @param {string | null | undefined} selected
	 * @param {string} name
	 */
	function pressed(selected, name) {
		return selected?.toLowerCase() === name.toLowerCase();
	}

	/**
	 * @param {number} index
	 */
	function scrollToPanel(index) {
		const panel = rail?.children[index];
		if (!rail || !(panel instanceof HTMLElement)) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const left =
			panel.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
		rail.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
		activePanel = index;
	}

	/** @type {import('svelte/attachments').Attachment} */
	const watchPanels = (node) => {
		rail = node;
		const panelEls = [...node.querySelectorAll(':scope > .panel')];
		const io = new IntersectionObserver(
			(entries) => {
				let best = -1;
				let bestRatio = 0;
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const index = panelEls.indexOf(/** @type {HTMLElement} */ (entry.target));
					if (index >= 0 && entry.intersectionRatio >= bestRatio) {
						best = index;
						bestRatio = entry.intersectionRatio;
					}
				}
				if (best >= 0) activePanel = best;
			},
			{ root: node, threshold: [0.5, 0.75, 1] }
		);
		for (const panel of panelEls) io.observe(panel);
		return () => {
			io.disconnect();
			if (rail === node) rail = undefined;
		};
	};
</script>

<aside class="stream-sidebar stream-interactive" aria-label="Stream">
	<div class="rail-row">
		<nav class="pager" aria-label="Stream panels">
			{#each panels as panel, index (panel.key)}
				<button
					type="button"
					class="pager-dot"
					aria-label={panel.label}
					aria-current={activePanel === index ? 'true' : undefined}
					onclick={() => scrollToPanel(index)}
				></button>
			{/each}
		</nav>
		<div class="rail" {@attach watchPanels}>
			<section class="panel" aria-labelledby="{uid}-liked" data-panel="liked">
				<header class="panel-head">
					<p id="{uid}-liked" class="eyebrow">Most liked</p>
				</header>
				{#if !facets}
					<p class="empty">Loading…</p>
				{:else if facets.mostLiked.length === 0}
					<p class="empty">No likes yet.</p>
				{:else}
					<ul class="liked-list">
						{#each facets.mostLiked as item (item.id)}
							<li>
								<a class="liked" href={trackPath(item)}>
									<span class="thumb">
										<CoverArt
											trackId={item.id}
											hasCover={item.hasCover}
											coverUrl={item.coverUrl}
											alt=""
											width={40}
											height={40}
										/>
									</span>
									<span class="liked-copy">
										<span class="liked-title">{item.title}</span>
										{#if item.artist}
											<span class="liked-artist">{item.artist}</span>
										{/if}
									</span>
									<span class="liked-stat">
										<IconHeart size={12} stroke={1.75} aria-hidden="true" />
										{item.likeCount}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="panel" aria-labelledby="{uid}-artists" data-panel="artists">
				<header class="panel-head">
					<p id="{uid}-artists" class="eyebrow">Artists</p>
				</header>
				{#if !facets}
					<p class="empty">Loading…</p>
				{:else}
					<div class="facet" role="group" aria-labelledby="{uid}-artists">
						<button
							type="button"
							class="all"
							aria-pressed={artist == null}
							onclick={() => onartist(null)}
						>
							All
						</button>
						{#if facets.artists.length === 0}
							<p class="empty">No artist names yet.</p>
						{:else}
							<ul class="name-list">
								{#each facets.artists as entry (entry.name.toLowerCase())}
									<li>
										<button
											type="button"
											class="name"
											aria-pressed={pressed(artist, entry.name)}
											onclick={() => onartist(pressed(artist, entry.name) ? null : entry.name)}
										>
											<span>{entry.name}</span>
											<span class="count">{entry.count}</span>
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</section>

			<section class="panel" aria-labelledby="{uid}-genres" data-panel="genres">
				<header class="panel-head">
					<p id="{uid}-genres" class="eyebrow">Genres</p>
				</header>
				{#if !facets}
					<p class="empty">Loading…</p>
				{:else}
					<div class="chips" role="group" aria-labelledby="{uid}-genres">
						<button
							type="button"
							class="chip"
							aria-pressed={genre == null}
							onclick={() => ongenre(null)}
						>
							All
						</button>
						{#each facets.genres as entry (entry.name.toLowerCase())}
							<button
								type="button"
								class="chip"
								aria-pressed={pressed(genre, entry.name)}
								onclick={() => ongenre(pressed(genre, entry.name) ? null : entry.name)}
							>
								<span>{entry.name}</span>
								<span class="count">{entry.count}</span>
							</button>
						{/each}
					</div>
					{#if facets.genres.length === 0}
						<p class="empty">No genres yet.</p>
					{/if}
				{/if}
			</section>
		</div>
	</div>
</aside>

<style>
	.stream-sidebar {
		min-width: 0;
	}

	.rail-row {
		display: grid;
		gap: 0.85rem;
		min-width: 0;
	}

	.rail {
		display: grid;
		gap: 0.85rem;
		min-width: 0;
	}

	.pager {
		display: none;
	}

	.panel {
		min-width: 0;
		padding: 0.85rem;
		border: 1px solid color-mix(in srgb, var(--hard-border) 55%, var(--paper));
		background: color-mix(in srgb, var(--paper) 94%, var(--ink));
		box-shadow: 4px 4px 0 color-mix(in srgb, var(--hard-shadow) 72%, transparent);
	}

	.panel-head {
		margin-bottom: 0.7rem;
		padding-bottom: 0.55rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
	}

	.panel-head .eyebrow {
		margin: 0;
	}

	.empty {
		margin: 0;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.liked-list,
	.name-list {
		display: grid;
		gap: 0.15rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.name-list {
		max-height: 16rem;
		overflow: auto;
	}

	.liked,
	.name,
	.all,
	.chip {
		font: inherit;
		cursor: pointer;
	}

	.liked {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		padding: 0.35rem 0.25rem;
		border: 1px solid transparent;
		color: inherit;
		text-decoration: none;
	}

	.liked:hover,
	.name:hover,
	.all:hover {
		border-color: color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}

	.thumb {
		display: grid;
		flex-shrink: 0;
		width: 2.25rem;
		height: 2.25rem;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.thumb :global(img),
	.thumb :global(.cover-placeholder) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.liked-copy {
		display: grid;
		gap: 0.08rem;
		min-width: 0;
		flex: 1;
	}

	.liked-title,
	.name span:first-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.liked-title {
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: -0.01em;
	}

	.liked-artist {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.7rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.liked-stat {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.2rem;
		padding: 0.12rem 0.28rem;
		color: var(--muted);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
	}

	.liked:hover .liked-stat {
		color: var(--on-accent);
		background: var(--accent);
	}

	.facet {
		display: grid;
		gap: 0.35rem;
	}

	.all,
	.name {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		padding: 0.38rem 0.45rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--ink);
		text-align: left;
	}

	.all[aria-pressed='true'],
	.name[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}

	.count {
		flex-shrink: 0;
		color: var(--muted);
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
	}

	.name[aria-pressed='true'] .count,
	.chip[aria-pressed='true'] .count {
		color: inherit;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		max-height: 16rem;
		overflow: auto;
	}

	.chip {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		min-height: 1.7rem;
		padding: 0.15rem 0.45rem;
		border: 1px solid var(--accent);
		border-radius: 0.125rem;
		background: color-mix(in srgb, var(--ink) 10%, var(--paper));
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		line-height: 1.2;
	}

	.chip:hover,
	.chip[aria-pressed='true'] {
		background: var(--accent);
		color: var(--on-accent);
	}

	@media (min-width: 961px) {
		.stream-sidebar {
			position: sticky;
			top: calc(var(--site-header-height, 5rem) + 1rem);
		}
	}

	@media (max-width: 960px) {
		.rail-row {
			position: relative;
			padding-left: 0.9rem;
		}

		.pager {
			position: absolute;
			top: 0;
			bottom: 0;
			left: 0;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.1rem;
			width: 0.75rem;
		}

		.pager-dot {
			display: grid;
			place-items: center;
			width: 0.75rem;
			height: 0.5rem;
			padding: 0;
			border: 0;
			background: transparent;
			cursor: pointer;
		}

		.pager-dot::after {
			width: 0.4rem;
			height: 0.4rem;
			border: 1px solid var(--hard-border);
			background: color-mix(in srgb, var(--paper) 88%, var(--ink));
			box-shadow: 1px 1px 0 var(--hard-shadow);
			content: '';
		}

		.pager-dot[aria-current='true']::after {
			border-color: var(--ink);
			background: var(--accent);
			box-shadow: inset 1px 1px 0 color-mix(in srgb, var(--ink) 35%, transparent);
		}

		.rail {
			display: flex;
			gap: 0.75rem;
			overflow-x: auto;
			overscroll-behavior-x: contain;
			scroll-snap-type: x mandatory;
			scrollbar-width: none;
		}

		.rail::-webkit-scrollbar {
			display: none;
		}

		.panel {
			flex: 0 0 100%;
			scroll-snap-align: start;
			scroll-snap-stop: always;
		}
	}
</style>
