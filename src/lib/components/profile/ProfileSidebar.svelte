<script>
	import IconChevronDown from '@tabler/icons-svelte-runes/icons/chevron-down';
	import IconChevronUp from '@tabler/icons-svelte-runes/icons/chevron-up';
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconMusic from '@tabler/icons-svelte-runes/icons/music';
	import IconRepeat from '@tabler/icons-svelte-runes/icons/repeat';
	import IconUserPlus from '@tabler/icons-svelte-runes/icons/user-plus';
	import IconUsers from '@tabler/icons-svelte-runes/icons/users';
	import { tick } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { MediaQuery } from 'svelte/reactivity';

	import Avatar from '#lib/components/Avatar.svelte';
	import FollowButton from '#lib/components/FollowButton.svelte';
	import SnapMarquee from '#lib/components/lists/SnapMarquee.svelte';
	import ArtistRow from '#lib/components/profile/ArtistRow.svelte';

	/**
	 * @typedef {import('#lib/components/profile/ArtistRow.svelte').Artist} Artist
	 * @typedef {{ id: string, body: string, createdAt: number, userName: string, userImage: string | null, trackId: string, trackTitle: string }} RecentComment
	 * @typedef {{ followerCount: number, followingCount: number, trackCount: number, likeCount: number, repostCount: number }} ProfileStats
	 */

	/**
	 * @type {{
	 *   username: string,
	 *   name: string,
	 *   stats: ProfileStats,
	 *   fansAlsoLike: Artist[],
	 *   followers: Artist[],
	 *   recentComments: RecentComment[],
	 *   signedIn?: boolean,
	 *   isOwner?: boolean,
	 *   isFollowing?: boolean,
	 *   hasReposts?: boolean,
	 *   showReposts?: boolean,
	 *   linkBase?: string,
	 *   showStats?: boolean,
	 *   showFansAlsoLike?: boolean,
	 *   showFollowers?: boolean,
	 *   showActivity?: boolean,
	 *   onrepoststoggle?: (next: boolean) => void
	 * }}
	 */
	let {
		username,
		name,
		stats,
		fansAlsoLike,
		followers,
		recentComments,
		signedIn = false,
		isOwner = false,
		isFollowing = false,
		hasReposts = false,
		showReposts = true,
		linkBase = '',
		showStats = true,
		showFansAlsoLike = true,
		showFollowers = true,
		showActivity = true,
		onrepoststoggle
	} = $props();

	/** Keeps the follower count in step with the button without a page reload. */
	let followerOverride = $state(/** @type {number | null} */ (null));
	const followerCount = $derived(followerOverride ?? stats.followerCount);

	const panels = $derived.by(() => {
		/** @type {{ key: string, label: string }[]} */
		const list = [];
		if (showStats) list.push({ key: 'stats', label: 'Stats' });
		if (showFansAlsoLike) list.push({ key: 'fans', label: 'Fans Also Like' });
		if (showFollowers) list.push({ key: 'followers', label: 'Followers' });
		if (showActivity) list.push({ key: 'activity', label: 'Last Comments' });
		return list;
	});

	let activePanel = $state(0);
	/** Mobile-only: panels start as a single-row strip. */
	let expanded = $state(false);
	const isMobile = new MediaQuery('(max-width: 960px)', false);
	const collapsed = $derived(isMobile.current && !expanded);

	/** @type {HTMLElement | null} */
	let panelRail = null;

	/** @param {string} value */
	function vtName(value) {
		return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
	}

	/**
	 * @param {HTMLElement} node
	 */
	function watchSnap(node) {
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

<aside class="profile-sidebar" class:collapsed aria-label="About {name}">
	<div class="rail-row">
		{#if panels.length > 1}
			<nav class="panel-pager" aria-label="Profile panels">
				{#each panels as panel, index (panel.key)}
					<button
						type="button"
						class="pager-dot"
						aria-label={panel.label}
						aria-current={activePanel === index ? 'true' : undefined}
						onclick={() => scrollToPanel(index)}
					>
						<span class="pager-dot-mark" aria-hidden="true"></span>
					</button>
				{/each}
			</nav>
		{/if}
		<div class="panel-rail" bind:this={panelRail} {@attach watchSnap}>
			{#if showStats}
				<section class="panel" aria-label="Stats" data-panel="stats">
					<SnapMarquee enabled={collapsed} resetKey="profile-stats">
						<ul class="stat-grid">
							<li class="stat accent" style:view-transition-name="profile-stat-followers">
								<IconUsers size={14} stroke={1.75} aria-hidden="true" />
								<span class="stat-value">{followerCount}</span>
								<span class="stat-label">Followers</span>
							</li>
							<li class="stat" style:view-transition-name="profile-stat-following">
								<IconUserPlus size={14} stroke={1.75} aria-hidden="true" />
								<span class="stat-value">{stats.followingCount}</span>
								<span class="stat-label">Following</span>
							</li>
							<li class="stat" style:view-transition-name="profile-stat-tracks">
								<IconMusic size={14} stroke={1.75} aria-hidden="true" />
								<span class="stat-value">{stats.trackCount}</span>
								<span class="stat-label">Tracks</span>
							</li>
							<li class="stat" style:view-transition-name="profile-stat-likes">
								<IconHeart size={14} stroke={1.75} aria-hidden="true" />
								<span class="stat-value">{stats.likeCount}</span>
								<span class="stat-label">Likes</span>
							</li>
						</ul>
					</SnapMarquee>

					{#if !collapsed && !isOwner}
						<div class="panel-action">
							<FollowButton
								{username}
								{name}
								following={isFollowing}
								{signedIn}
								onchange={(state) => (followerOverride = state.followerCount)}
							/>
						</div>
					{/if}

					{#if !collapsed && hasReposts}
						<button
							type="button"
							class="repost-toggle"
							aria-pressed={showReposts}
							onclick={() => onrepoststoggle?.(!showReposts)}
						>
							<IconRepeat size={14} stroke={1.75} aria-hidden="true" />
							<span>{showReposts ? 'Reposts on' : 'Reposts off'}</span>
							<span class="repost-count">{stats.repostCount}</span>
						</button>
					{/if}
				</section>
			{/if}

			{#if showFansAlsoLike}
				<section class="panel" aria-labelledby="fans-also-like-heading" data-panel="fans">
					<header class="panel-head">
						<p id="fans-also-like-heading" class="eyebrow">Fans Also Like</p>
					</header>
					{#if fansAlsoLike.length === 0}
						<p class="empty-line">Nothing to compare yet.</p>
					{:else}
						<SnapMarquee enabled={collapsed} resetKey="profile-fans">
							<ul class="row-list">
								{#each fansAlsoLike as artist (artist.username)}
									<li style:view-transition-name="profile-fan-{vtName(artist.username)}">
										<ArtistRow {artist} {signedIn} {linkBase} showFollow={!collapsed} />
									</li>
								{/each}
							</ul>
						</SnapMarquee>
					{/if}
				</section>
			{/if}

			{#if showFollowers}
				<section class="panel" aria-labelledby="followers-heading" data-panel="followers">
					<header class="panel-head">
						<p id="followers-heading" class="eyebrow">Followers ({followerCount})</p>
					</header>
					{#if followers.length === 0}
						<p class="empty-line">No followers yet.</p>
					{:else}
						<SnapMarquee enabled={collapsed} resetKey="profile-followers">
							<ul class="row-list">
								{#each followers as artist (artist.username)}
									<li style:view-transition-name="profile-follower-{vtName(artist.username)}">
										<ArtistRow {artist} {signedIn} {linkBase} showFollow={!collapsed} />
									</li>
								{/each}
							</ul>
						</SnapMarquee>
					{/if}
				</section>
			{/if}

			{#if showActivity}
				<section class="panel" aria-labelledby="profile-comments-heading" data-panel="activity">
					<header class="panel-head">
						<p id="profile-comments-heading" class="eyebrow">Last Comments</p>
					</header>
					{#if recentComments.length === 0}
						<p class="empty-line">No comments yet.</p>
					{:else}
						<SnapMarquee enabled={collapsed} resetKey="profile-activity">
							<ul class="item-list">
								{#each recentComments as comment (comment.id)}
									<li style:view-transition-name="profile-act-{vtName(comment.id)}">
										<a class="item" href="/tracks/{comment.trackId}">
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
			{/if}
		</div>

		{#if isMobile.current}
			<button
				type="button"
				class="expand-btn"
				aria-expanded={expanded}
				aria-label={expanded ? 'Collapse profile cards' : 'Expand profile cards'}
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
	.profile-sidebar {
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
		.profile-sidebar {
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

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.stat {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.1rem 0.35rem;
		align-items: center;
		padding: 0.45rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--paper) 94%, var(--ink));
	}

	.stat.accent {
		border-color: var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	.stat :global(svg) {
		display: block;
	}

	.stat-value {
		font-size: 1.05rem;
		font-weight: 900;
		letter-spacing: -0.02em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		line-height: 1;
		text-transform: uppercase;
	}

	.stat.accent .stat-label {
		color: color-mix(in srgb, var(--on-accent) 75%, transparent);
	}

	.panel-action {
		margin-top: 0.7rem;
	}

	.repost-toggle {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		justify-content: center;
		width: 100%;
		margin-top: 0.45rem;
		padding: 0.45rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		color: var(--muted);
		background: color-mix(in srgb, var(--paper) 94%, var(--ink));
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		line-height: 1;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease,
			border-color 120ms ease;
	}

	.repost-toggle:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	.repost-toggle[aria-pressed='true'] {
		border-color: var(--ink);
		color: var(--ink);
		background: color-mix(in srgb, var(--accent) 28%, var(--paper));
	}

	.repost-toggle :global(svg) {
		display: block;
	}

	.repost-count {
		padding: 0.1rem 0.25rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		font-variant-numeric: tabular-nums;
	}

	.row-list,
	.item-list {
		display: grid;
		gap: 0.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
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

	.activity-head {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		min-width: 0;
	}

	.item-topline {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
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
		flex-shrink: 1;
		color: var(--muted);
		font-size: 0.7rem;
		letter-spacing: 0.02em;
		line-height: 1.3;
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;
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

	@media (max-width: 960px) {
		.profile-sidebar {
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
			padding-left: 0.85rem;
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
			position: absolute;
			top: 0;
			bottom: 0;
			left: 0;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.12rem;
			width: 0.7rem;
		}

		.pager-dot {
			display: grid;
			flex: 0 0 auto;
			place-items: center;
			width: 0.7rem;
			height: 0.45rem;
			padding: 0;
			border: 0;
			border-radius: 0;
			background: transparent;
			cursor: pointer;
		}

		.pager-dot-mark {
			display: block;
			width: 0.32rem;
			height: 0.32rem;
			border: 1px solid var(--hard-border);
			background: color-mix(in srgb, var(--paper) 88%, var(--ink));
			box-shadow: 1px 1px 0 var(--hard-shadow);
			transition:
				background 120ms ease,
				border-color 120ms ease,
				box-shadow 120ms ease,
				transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1);
		}

		.pager-dot:hover .pager-dot-mark {
			background: color-mix(in srgb, var(--accent) 35%, var(--paper));
		}

		.pager-dot[aria-current='true'] .pager-dot-mark {
			border-color: var(--ink);
			background: var(--accent);
			box-shadow: inset 1px 1px 0 color-mix(in srgb, var(--ink) 35%, transparent);
			transform: translate(1px, 1px);
		}

		.pager-dot:focus-visible {
			outline: 2px solid var(--ink);
			outline-offset: 2px;
		}

		.profile-sidebar.collapsed .panel {
			display: flex;
			align-items: center;
			min-height: var(--header-chrome-height, 2.25rem);
			padding: 0.2rem 0.45rem;
			overflow: hidden;
			background: color-mix(in srgb, var(--paper) 92%, var(--ink));
			box-shadow: 3px 3px 0 var(--hard-shadow);
		}

		.profile-sidebar.collapsed .panel-head {
			display: none;
		}

		.profile-sidebar.collapsed .empty-line {
			padding: 0.15rem 0.25rem;
			font-size: 0.72rem;
			white-space: nowrap;
		}

		.profile-sidebar.collapsed .stat-grid {
			display: flex;
			flex-direction: row;
			gap: 0.3rem;
			align-items: center;
		}

		.profile-sidebar.collapsed .stat {
			flex: 0 0 auto;
			grid-template-columns: auto auto;
			gap: 0.15rem 0.3rem;
			padding: 0.2rem 0.4rem;
			scroll-snap-align: start;
		}

		.profile-sidebar.collapsed .stat-value {
			font-size: 0.85rem;
		}

		.profile-sidebar.collapsed .stat-label {
			grid-column: auto;
			font-size: 0.52rem;
		}

		.profile-sidebar.collapsed .row-list,
		.profile-sidebar.collapsed .item-list {
			display: flex;
			flex-direction: row;
			gap: 0.35rem;
			align-items: center;
		}

		.profile-sidebar.collapsed .row-list > li,
		.profile-sidebar.collapsed .item-list > li {
			flex: 0 0 auto;
			scroll-snap-align: start;
			min-width: 11rem;
		}

		.profile-sidebar.collapsed .item {
			flex-direction: row;
			align-items: center;
			gap: 0.4rem;
			max-width: 16rem;
			padding: 0.2rem 0.35rem;
		}

		.profile-sidebar.collapsed .item-body {
			display: block;
			overflow: hidden;
			max-width: 8rem;
			-webkit-line-clamp: unset;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.profile-sidebar.collapsed .item-title,
		.profile-sidebar.collapsed .item-meta {
			font-size: 0.72rem;
		}

		.profile-sidebar.collapsed .expand-btn {
			min-height: calc(var(--header-chrome-height, 2.25rem) + 5px);
		}
	}

	@media (pointer: coarse) {
		.repost-toggle {
			min-height: var(--tap-min);
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
