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
	import InlineMilkdrop from '#lib/components/player/InlineMilkdrop.svelte';
	import VizDockSlot from '#lib/components/player/VizDockSlot.svelte';
	import { visualizer } from '#lib/player/visualizer.svelte.js';
	import { trackPath } from '#lib/track-path.js';

	/**
	 * @typedef {{ id: string, title: string, slug?: string | null, uploaderName: string, uploaderImage: string | null, username: string | null, likeCount: number }} LikedTrack
	 * @typedef {{ username: string, name: string, image: string | null, isViewer?: boolean, followedByViewer?: boolean }} Artist
	 * @typedef {{ id: string, body: string, createdAt: number, userName: string, userImage: string | null, username: string | null, trackId: string, trackTitle: string, trackSlug?: string | null, trackUsername?: string | null }} RecentComment
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
	 *   q?: string | null,
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
		q = null,
		signedIn = false
	} = $props();

	const BASE_PANELS = /** @type {const} */ ([
		{ key: 'popular', label: 'Popular' },
		{ key: 'artists', label: 'New Artists' },
		{ key: 'activity', label: 'Activity' },
		{ key: 'browse', label: 'Browse' }
	]);

	const panels = $derived(
		visualizer.showInline ? [{ key: 'viz', label: 'Milkdrop' }, ...BASE_PANELS] : [...BASE_PANELS]
	);

	let activePanel = $state(0);
	/** Mobile-only: panels start as a single-row strip. */
	let expanded = $state(false);
	const isMobile = new MediaQuery('(max-width: 960px)', false);
	const collapsed = $derived(isMobile.current && !expanded);

	/** @type {HTMLElement | null} */
	let panelRail = null;

	/** Re-bind snap observer when the viz panel mounts/unmounts. */
	const snapAttach = $derived.by(() => {
		const panelCount = panels.length;
		/**
		 * @param {HTMLElement} node
		 */
		return (node) => {
			void panelCount;
			panelRail = node;
			const panelEls = [...node.querySelectorAll(':scope > .panel')];
			const io = new IntersectionObserver(
				(entries) => {
					let best = -1;
					let bestRatio = 0;
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						const i = panelEls.indexOf(/** @type {HTMLElement} */ (entry.target));
						if (i >= 0 && entry.intersectionRatio >= bestRatio) {
							best = i;
							bestRatio = entry.intersectionRatio;
						}
					}
					if (best >= 0) activePanel = best;
				},
				{ root: node, threshold: [0.5, 0.75, 1] }
			);
			for (const p of panelEls) io.observe(p);
			return () => io.disconnect();
		};
	});

	/** @param {string} value */
	function vtName(value) {
		return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
	}

	/** @param {RecentComment} comment */
	function commentHref(comment) {
		return trackPath(
			{ username: comment.trackUsername, slug: comment.trackSlug, id: comment.trackId },
			`#comment-${comment.id}`
		);
	}

	/**
	 * @param {{ genre?: string | null, following?: boolean, q?: string | null }} [opts]
	 */
	function feedHref({ genre = null, following: scopeFollowing = false, q: query = null } = {}) {
		const params = new URLSearchParams();
		if (scopeFollowing) params.set('following', '1');
		if (genre) params.set('genre', genre);
		if (query) params.set('q', query);
		const qs = params.toString();
		return qs ? `/feed?${qs}` : '/feed';
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
		<nav class="panel-pager" aria-label="Discover panels">
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
		<div class="panel-rail" bind:this={panelRail} {@attach snapAttach}>
			{#if !collapsed}
				<VizDockSlot dockKey="feed" />
			{/if}
			{#if visualizer.showInline}
				<InlineMilkdrop variant="panel" />
			{/if}

			<section class="panel" aria-labelledby="most-liked-heading" data-panel={BASE_PANELS[0].key}>
				<header class="panel-head">
					<p id="most-liked-heading" class="eyebrow">Popular</p>
				</header>
				{#if mostLiked.length === 0}
					<p class="empty-line">No likes yet.</p>
				{:else}
					<SnapMarquee enabled={collapsed} resetKey="feed-popular">
						<ul class="item-list">
							{#each mostLiked as item (item.id)}
								<li style:view-transition-name="feed-pop-{vtName(item.id)}">
									<a class="item avatar-row" href={trackPath(item)}>
										<Avatar src={item.uploaderImage} name={item.uploaderName} size="1.85rem" />
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
						</ul>
					</SnapMarquee>
				{/if}
			</section>

			<section class="panel" aria-labelledby="new-artists-heading" data-panel={BASE_PANELS[1].key}>
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
									<a class="item avatar-row" href="/users/{artist.username}">
										<Avatar src={artist.image} name={artist.name} size="1.85rem" />
										<span class="item-copy">
											<span class="item-title">{artist.name}</span>
											<span class="item-meta">@{artist.username}</span>
										</span>
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

			<section
				class="panel"
				aria-labelledby="recent-activity-heading"
				data-panel={BASE_PANELS[2].key}
			>
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
									<div class="item activity">
										<span class="activity-head">
											{#if comment.username}
												<a class="activity-user" href="/users/{comment.username}">
													<Avatar src={comment.userImage} name={comment.userName} size="1.5rem" />
													<span class="item-title">{comment.userName}</span>
												</a>
											{:else}
												<span class="activity-user">
													<Avatar src={comment.userImage} name={comment.userName} size="1.5rem" />
													<span class="item-title">{comment.userName}</span>
												</span>
											{/if}
											<span class="item-meta">
												on
												<a class="activity-track" href={commentHref(comment)}
													>{comment.trackTitle}</a
												>
											</span>
										</span>
										<a class="item-body" href={commentHref(comment)}>“{comment.body}”</a>
									</div>
								</li>
							{/each}
						</ul>
					</SnapMarquee>
				{/if}
			</section>

			<section class="panel" aria-labelledby="genres-heading" data-panel={BASE_PANELS[3].key}>
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
										href={feedHref({ genre: entry.genre, following, q })}
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

	/* Subtle depth ramp: top softest → bottom darkest (works in light + dark). */
	.panel-rail > :global(.panel:nth-last-child(4 of .panel)) {
		border-color: color-mix(in srgb, var(--hard-border) 48%, var(--paper));
		background: color-mix(in srgb, var(--paper) 99%, black);
		box-shadow: 5px 5px 0 color-mix(in srgb, var(--hard-shadow) 42%, var(--paper));
	}

	.panel-rail > :global(.panel:nth-last-child(3 of .panel)) {
		border-color: color-mix(in srgb, var(--hard-border) 66%, var(--paper));
		background: color-mix(in srgb, var(--paper) 97%, black);
		box-shadow: 5px 5px 0 color-mix(in srgb, var(--hard-shadow) 58%, var(--paper));
	}

	.panel-rail > :global(.panel:nth-last-child(2 of .panel)) {
		border-color: color-mix(in srgb, var(--hard-border) 84%, var(--paper));
		background: color-mix(in srgb, var(--paper) 94%, black);
		box-shadow: 5px 5px 0 color-mix(in srgb, var(--hard-shadow) 76%, var(--paper));
	}

	.panel-rail > :global(.panel:nth-last-child(1 of .panel)) {
		border-color: color-mix(in srgb, var(--hard-border) 90%, black);
		background: color-mix(in srgb, var(--paper) 91%, black);
		box-shadow: 5px 5px 0 color-mix(in srgb, var(--hard-shadow) 88%, black);
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

	.item-copy {
		display: grid;
		gap: 0.12rem;
		min-width: 0;
		flex: 1;
	}

	.item-copy .item-meta {
		text-align: left;
	}

	.item.activity {
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
		border: 0;
		padding-inline: 0.15rem;
		transition: none;
	}

	.item.activity:hover {
		border-color: transparent;
		background: transparent;
	}

	.item.activity:active {
		transform: none;
	}

	.activity-head {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		min-width: 0;
	}

	.activity-user {
		display: inline-flex;
		gap: 0.45rem;
		align-items: center;
		min-width: 0;
		flex: 1;
		color: inherit;
		text-decoration: none;
	}

	.activity-user:hover .item-title {
		text-decoration: underline;
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
		flex-shrink: 1;
		color: var(--muted);
		font-size: 0.7rem;
		letter-spacing: 0.02em;
		line-height: 1.3;
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.activity-track {
		color: inherit;
		text-decoration: none;
	}

	.activity-track:hover {
		color: var(--ink);
		text-decoration: underline;
	}

	.item-body {
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		color: var(--ink);
		font-size: 0.76rem;
		line-height: 1.4;
		text-decoration: none;
	}

	.item-body:hover,
	.item-body:focus-visible {
		color: var(--ink);
		text-decoration: none;
		opacity: 0.78;
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
			position: relative;
			display: flex;
			gap: 0.45rem;
			align-items: stretch;
		}

		.rail-row:has(.panel-pager) {
			/* Room for the absolutely positioned pager on the left. */
			padding-left: 0.9rem;
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

		.panel,
		.panel-rail > :global(section.panel) {
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
			overflow: hidden;
		}

		.pager-dot {
			display: grid;
			flex: 0 0 auto;
			place-items: center;
			width: 0.75rem;
			height: 0.5rem;
			padding: 0;
			border: 0;
			border-radius: 0;
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

		.feed-sidebar.collapsed .panel,
		.feed-sidebar.collapsed .panel-rail > :global(section.panel) {
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

		.feed-sidebar.collapsed .panel-rail > :global(section.panel[data-panel='viz'] .stage) {
			display: none;
		}

		.feed-sidebar.collapsed
			.panel-rail
			> :global(section.panel[data-panel='viz'] .collapsed-label) {
			display: block;
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
