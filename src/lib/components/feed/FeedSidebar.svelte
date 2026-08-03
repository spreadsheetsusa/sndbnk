<script>
	import IconChevronDown from '@tabler/icons-svelte-runes/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte-runes/icons/chevron-up';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import { tick } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { MediaQuery } from 'svelte/reactivity';

	import Avatar from '#lib/components/Avatar.svelte';
	import FollowButton from '#lib/components/FollowButton.svelte';
	import SnapMarquee from '#lib/components/lists/SnapMarquee.svelte';

	/**
	 * @typedef {{ id: string, title: string, uploaderName: string, username: string | null, likeCount: number }} LikedTrack
	 * @typedef {{ username: string, name: string, image: string | null, trackCount: number, isViewer?: boolean, followedByViewer?: boolean }} Artist
	 * @typedef {{ id: string, body: string, createdAt: number, userName: string, userImage: string | null, trackId: string, trackTitle: string }} RecentComment
	 * @typedef {{ genre: string, count: number }} GenreCount
	 */

	/**
	 * @type {{
	 *   mostLiked: LikedTrack[],
	 *   newArtists: Artist[],
	 *   recentComments: RecentComment[],
	 *   genres: GenreCount[],
	 *   activeGenre?: string | null,
	 *   following?: boolean,
	 *   signedIn?: boolean
	 * }}
	 */
	let {
		mostLiked,
		newArtists,
		recentComments,
		genres,
		activeGenre = null,
		following = false,
		signedIn = false
	} = $props();

	const PANELS = /** @type {const} */ ([
		{ key: 'popular', label: 'Popular' },
		{ key: 'artists', label: 'New Artists' },
		{ key: 'activity', label: 'Activity' },
		{ key: 'browse', label: 'Browse' }
	]);

	let activePanel = $state(0);
	/** Mobile-only: panels start as a single-row strip. */
	let expanded = $state(false);
	const isMobile = new MediaQuery('(max-width: 960px)', false);
	const collapsed = $derived(isMobile.current && !expanded);

	/** @type {HTMLElement | null} */
	let panelRail = null;

	/**
	 * @param {number} n
	 */
	function padRank(n) {
		return String(n).padStart(2, '0');
	}

	/** @param {string} value */
	function vtName(value) {
		return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
	}

	/**
	 * @param {{ genre?: string | null, following?: boolean }} [opts]
	 */
	function feedHref({ genre = null, following: scopeFollowing = false } = {}) {
		const params = new URLSearchParams();
		if (scopeFollowing) params.set('following', '1');
		if (genre) params.set('genre', genre);
		const qs = params.toString();
		return qs ? `/feed?${qs}` : '/feed';
	}

	/**
	 * @param {HTMLElement} node
	 */
	function watchSnap(node) {
		const panels = [...node.querySelectorAll(':scope > .panel')];
		const io = new IntersectionObserver(
			(entries) => {
				let best = -1;
				let bestRatio = 0;
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const i = panels.indexOf(/** @type {HTMLElement} */ (entry.target));
					if (i >= 0 && entry.intersectionRatio >= bestRatio) {
						best = i;
						bestRatio = entry.intersectionRatio;
					}
				}
				if (best >= 0) activePanel = best;
			},
			{ root: node, threshold: [0.5, 0.75, 1] }
		);
		for (const p of panels) io.observe(p);
		return () => io.disconnect();
	}

	/**
	 * @param {number} index
	 */
	function scrollToPanel(index) {
		const rail = panelRail;
		const panel = rail?.children[index];
		if (!rail || !(panel instanceof HTMLElement)) return;
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const left =
			panel.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
		rail.scrollTo({
			left,
			behavior: reduceMotion ? 'auto' : 'smooth'
		});
		activePanel = index;
	}

	async function toggleExpanded() {
		const apply = () => {
			expanded = !expanded;
		};
		if (
			prefersReducedMotion.current ||
			typeof document === 'undefined' ||
			typeof document.startViewTransition !== 'function'
		) {
			apply();
			return;
		}
		document.startViewTransition(async () => {
			apply();
			await tick();
		});
	}
</script>

<aside class="feed-sidebar" class:collapsed aria-label="Discover">
	<div class="rail-row">
		<div class="panel-rail" bind:this={panelRail} {@attach watchSnap}>
			<section class="panel" aria-labelledby="most-liked-heading" data-panel={PANELS[0].key}>
				<header class="panel-head">
					<p id="most-liked-heading" class="eyebrow">Popular</p>
				</header>
				{#if mostLiked.length === 0}
					<p class="empty-line">No likes yet.</p>
				{:else}
					<SnapMarquee enabled={collapsed} resetKey="feed-popular">
						<ol class="item-list">
							{#each mostLiked as item, index (item.id)}
								<li style:view-transition-name="feed-pop-{vtName(item.id)}">
									<a class="item" href="/tracks/{item.id}">
										<span class="rank">{padRank(index + 1)}</span>
										<span class="item-copy">
											<span class="item-title">{item.title}</span>
											<span class="item-meta">{item.uploaderName}</span>
										</span>
										<span class="item-stat">
											<IconHeart size={12} stroke={1.75} aria-hidden="true" />
											{item.likeCount}
										</span>
									</a>
								</li>
							{/each}
						</ol>
					</SnapMarquee>
				{/if}
			</section>

			<section class="panel" aria-labelledby="new-artists-heading" data-panel={PANELS[1].key}>
				<header class="panel-head">
					<p id="new-artists-heading" class="eyebrow">New Artists</p>
				</header>
				{#if newArtists.length === 0}
					<p class="empty-line">No artists yet.</p>
				{:else}
					<SnapMarquee enabled={collapsed} resetKey="feed-artists">
						<ul class="item-list">
							{#each newArtists as artist (artist.username)}
								<li
									class="artist-line"
									style:view-transition-name="feed-art-{vtName(artist.username)}"
								>
									<a class="item artist" href="/users/{artist.username}">
										<Avatar src={artist.image} name={artist.name} size="1.85rem" />
										<span class="item-copy">
											<span class="item-title">{artist.name}</span>
											<span class="item-meta">@{artist.username}</span>
										</span>
										<span class="item-stat tracks">{artist.trackCount}</span>
									</a>
									{#if !collapsed && !artist.isViewer}
										<FollowButton
											username={artist.username}
											name={artist.name}
											following={Boolean(artist.followedByViewer)}
											{signedIn}
											size="sm"
										/>
									{/if}
								</li>
							{/each}
						</ul>
					</SnapMarquee>
				{/if}
			</section>

			<section class="panel" aria-labelledby="recent-activity-heading" data-panel={PANELS[2].key}>
				<header class="panel-head">
					<p id="recent-activity-heading" class="eyebrow">Activity</p>
				</header>
				{#if recentComments.length === 0}
					<p class="empty-line">No comments yet.</p>
				{:else}
					<SnapMarquee enabled={collapsed} resetKey="feed-activity">
						<ul class="item-list">
							{#each recentComments as comment (comment.id)}
								<li style:view-transition-name="feed-act-{vtName(comment.id)}">
									<a class="item activity" href="/tracks/{comment.trackId}">
										<span class="activity-head">
											<Avatar src={comment.userImage} name={comment.userName} size="1.5rem" />
											<span class="item-topline">
												<span class="item-title">{comment.userName}</span>
												<span class="item-meta">on {comment.trackTitle}</span>
											</span>
										</span>
										<span class="item-body">“{comment.body}”</span>
									</a>
								</li>
							{/each}
						</ul>
					</SnapMarquee>
				{/if}
			</section>

			<section class="panel" aria-labelledby="genres-heading" data-panel={PANELS[3].key}>
				<header class="panel-head">
					<p id="genres-heading" class="eyebrow">Browse</p>
				</header>
				{#if genres.length === 0}
					<p class="empty-line">No genres yet.</p>
				{:else}
					<SnapMarquee enabled={collapsed} resetKey="feed-browse">
						<ul class="genre-list">
							{#each genres as entry (entry.genre)}
								<li style:view-transition-name="feed-genre-{vtName(entry.genre)}">
									<a
										class={['genre-chip', activeGenre === entry.genre && 'active']}
										href={feedHref({ genre: entry.genre, following })}
										aria-current={activeGenre === entry.genre ? 'page' : undefined}
									>
										<span class="genre-label">{entry.genre}</span>
										<span class="genre-count">{entry.count}</span>
									</a>
								</li>
							{/each}
						</ul>
					</SnapMarquee>
				{/if}
			</section>
		</div>

		{#if isMobile.current}
			<button
				type="button"
				class="expand-btn"
				aria-expanded={expanded}
				aria-label={expanded ? 'Collapse discover cards' : 'Expand discover cards'}
				onclick={toggleExpanded}
			>
				{#if expanded}
					<IconChevronUp size={18} stroke={1.75} aria-hidden="true" />
				{:else}
					<IconChevronDown size={18} stroke={1.75} aria-hidden="true" />
				{/if}
			</button>
		{/if}
	</div>

	<nav class="panel-pager" aria-label="Discover panels">
		{#each PANELS as panel, index (panel.key)}
			<button
				type="button"
				class="pager-dot"
				aria-label={panel.label}
				aria-current={activePanel === index ? 'true' : undefined}
				onclick={() => scrollToPanel(index)}
			></button>
		{/each}
	</nav>
</aside>

<style>
	.feed-sidebar {
		display: grid;
		gap: 1.15rem;
		align-content: start;
	}

	.rail-row {
		display: grid;
		gap: 1.15rem;
		min-width: 0;
	}

	.panel-rail {
		display: grid;
		gap: 1.15rem;
		min-width: 0;
	}

	.expand-btn {
		display: none;
	}

	.panel-pager {
		display: none;
	}

	@media (min-width: 961px) {
		.feed-sidebar {
			position: sticky;
			top: calc(var(--site-header-height) + 1rem);
		}
	}

	.panel {
		padding: 0.85rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.panel-head {
		margin-bottom: 0.75rem;
		padding-bottom: 0.65rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.panel-head .eyebrow {
		margin: 0;
	}

	.empty-line {
		margin: 0;
		padding: 0.35rem 0.15rem;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.item-list {
		display: grid;
		gap: 0.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.55rem;
		min-width: 0;
		padding: 0.45rem 0.4rem;
		border: 1px solid transparent;
		color: inherit;
		text-decoration: none;
		transition:
			background 120ms ease,
			border-color 120ms ease,
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1);
	}

	.item:hover {
		border-color: color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}

	.item:active {
		transform: translate(1px, 1px);
	}

	.artist-line {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		min-width: 0;
	}

	.artist-line .item {
		min-width: 0;
		flex: 1;
	}

	.rank {
		flex-shrink: 0;
		width: 1.35rem;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.item-copy {
		display: grid;
		gap: 0.12rem;
		min-width: 0;
		flex: 1;
	}

	.item-topline {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
	}

	.item.activity {
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
	}

	.activity-head {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		min-width: 0;
	}

	.activity-head .item-topline {
		flex: 1;
	}

	.item-title {
		overflow: hidden;
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: -0.01em;
		line-height: 1.25;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-meta {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.7rem;
		letter-spacing: 0.02em;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-topline .item-meta {
		flex-shrink: 1;
		text-align: right;
	}

	.item-body {
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		color: var(--ink);
		font-size: 0.76rem;
		line-height: 1.4;
	}

	.item-stat {
		display: inline-flex;
		align-items: center;
		gap: 0.22rem;
		flex-shrink: 0;
		padding: 0.2rem 0.35rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		color: var(--muted);
		background: color-mix(in srgb, var(--paper) 94%, var(--ink));
		font-size: 0.64rem;
		font-weight: 900;
		letter-spacing: 0.04em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.item-stat :global(svg) {
		display: block;
	}

	.item-stat.tracks::after {
		content: ' TRK';
		letter-spacing: 0.08em;
	}

	.item:hover .item-stat {
		border-color: var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	.genre-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.genre-chip {
		display: inline-flex;
		gap: 0.45rem;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		padding: 0.38rem 0.5rem;
		border: 1px solid var(--hard-border);
		color: var(--ink);
		background: var(--paper);
		box-shadow: 2px 2px 0 var(--hard-shadow);
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		line-height: 1;
		text-decoration: none;
		text-transform: uppercase;
		transition:
			background 120ms ease,
			color 120ms ease,
			box-shadow 120ms cubic-bezier(0.2, 0.8, 0.4, 1),
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1);
	}

	.genre-chip:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	.genre-chip:active {
		box-shadow: 1px 1px 0 var(--hard-shadow);
		transform: translate(1px, 1px);
	}

	.genre-chip.active,
	.genre-chip[aria-current='page'] {
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 35%, transparent);
		transform: translate(1px, 1px);
	}

	.genre-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.genre-count {
		opacity: 0.75;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.genre-chip.active .genre-count,
	.genre-chip[aria-current='page'] .genre-count,
	.genre-chip:hover .genre-count {
		opacity: 1;
	}

	@media (max-width: 960px) {
		.feed-sidebar {
			gap: 0.45rem;
		}

		.rail-row {
			display: flex;
			gap: 0.45rem;
			align-items: stretch;
		}

		.panel-rail {
			display: flex;
			flex: 1;
			gap: 0.75rem;
			min-width: 0;
			overflow-x: auto;
			overscroll-behavior-x: contain;
			scroll-snap-type: x mandatory;
			scrollbar-width: none;
			-ms-overflow-style: none;
			padding-bottom: 5px;
		}

		.panel-rail::-webkit-scrollbar {
			display: none;
		}

		.panel {
			flex: 0 0 100%;
			min-width: 0;
			scroll-snap-align: start;
			scroll-snap-stop: always;
			transition: padding 180ms ease;
		}

		.expand-btn {
			display: inline-flex;
			flex-shrink: 0;
			align-items: center;
			justify-content: center;
			align-self: stretch;
			width: var(--header-chrome-height, 2.25rem);
			min-height: var(--header-chrome-height, 2.25rem);
			padding: 0;
			border: 1px solid var(--hard-border);
			color: var(--ink);
			background: color-mix(in srgb, var(--paper) 88%, var(--ink));
			box-shadow: 3px 3px 0 var(--hard-shadow);
			cursor: pointer;
			transition:
				transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1),
				background 120ms ease,
				box-shadow 120ms ease;
		}

		.expand-btn:hover {
			background: color-mix(in srgb, var(--accent) 35%, var(--paper));
		}

		.expand-btn:active,
		.expand-btn[aria-expanded='true'] {
			box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 35%, transparent);
			transform: translate(1px, 1px);
		}

		.expand-btn :global(svg) {
			display: block;
		}

		.panel-pager {
			display: flex;
			justify-content: center;
			gap: 0.15rem;
		}

		.pager-dot {
			display: grid;
			place-items: center;
			width: 1.75rem;
			height: 1.75rem;
			padding: 0;
			border: 0;
			border-radius: 0;
			background: transparent;
			cursor: pointer;
		}

		.pager-dot::after {
			width: 0.55rem;
			height: 0.55rem;
			border: 1px solid var(--hard-border);
			background: color-mix(in srgb, var(--paper) 88%, var(--ink));
			box-shadow: 1px 1px 0 var(--hard-shadow);
			content: '';
			transition:
				background 120ms ease,
				border-color 120ms ease,
				box-shadow 120ms ease,
				transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1);
		}

		.pager-dot:hover::after {
			background: color-mix(in srgb, var(--accent) 35%, var(--paper));
		}

		.pager-dot[aria-current='true']::after {
			border-color: var(--ink);
			background: var(--accent);
			box-shadow: inset 1px 1px 0 color-mix(in srgb, var(--ink) 35%, transparent);
			transform: translate(1px, 1px);
		}

		.pager-dot:focus-visible {
			outline: 2px solid var(--ink);
			outline-offset: 2px;
		}

		.feed-sidebar.collapsed .panel {
			display: flex;
			align-items: center;
			min-height: var(--header-chrome-height, 2.25rem);
			padding: 0.2rem 0.45rem;
			overflow: hidden;
			background: color-mix(in srgb, var(--paper) 92%, var(--ink));
			box-shadow: 3px 3px 0 var(--hard-shadow);
		}

		.feed-sidebar.collapsed .panel-head {
			display: none;
		}

		.feed-sidebar.collapsed .empty-line {
			padding: 0.15rem 0.25rem;
			font-size: 0.72rem;
			white-space: nowrap;
		}

		.feed-sidebar.collapsed .item-list {
			display: flex;
			flex-direction: row;
			gap: 0.35rem;
			align-items: center;
		}

		.feed-sidebar.collapsed .item-list > li,
		.feed-sidebar.collapsed .artist-line {
			flex: 0 0 auto;
			scroll-snap-align: start;
		}

		.feed-sidebar.collapsed .item {
			gap: 0.35rem;
			padding: 0.2rem 0.35rem;
		}

		.feed-sidebar.collapsed .item-copy {
			display: flex;
			gap: 0.35rem;
			align-items: baseline;
		}

		.feed-sidebar.collapsed .item.activity {
			flex-direction: row;
			align-items: center;
			gap: 0.4rem;
			max-width: 16rem;
		}

		.feed-sidebar.collapsed .item-body {
			display: block;
			overflow: hidden;
			max-width: 8rem;
			-webkit-line-clamp: unset;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.feed-sidebar.collapsed .item-title,
		.feed-sidebar.collapsed .item-meta {
			font-size: 0.72rem;
		}

		.feed-sidebar.collapsed .rank {
			width: 1.1rem;
			font-size: 0.62rem;
		}

		.feed-sidebar.collapsed .item-stat {
			padding: 0.12rem 0.28rem;
			font-size: 0.58rem;
		}

		.feed-sidebar.collapsed .genre-list {
			flex-wrap: nowrap;
			gap: 0.3rem;
		}

		.feed-sidebar.collapsed .genre-chip {
			flex-shrink: 0;
			padding: 0.28rem 0.4rem;
			font-size: 0.6rem;
			box-shadow: 1px 1px 0 var(--hard-shadow);
		}

		.feed-sidebar.collapsed .expand-btn {
			min-height: calc(var(--header-chrome-height, 2.25rem) + 5px);
		}
	}

	@media (pointer: coarse) {
		.genre-chip {
			min-height: var(--tap-min);
		}

		.feed-sidebar.collapsed .genre-chip {
			min-height: 0;
		}

		.expand-btn {
			width: var(--tap-min);
			min-height: var(--tap-min);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel-rail {
			scroll-behavior: auto;
		}

		.panel {
			transition: none;
		}
	}
</style>
