<script>
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconMusic from '@tabler/icons-svelte-runes/icons/music';
	import IconRepeat from '@tabler/icons-svelte-runes/icons/repeat';
	import IconUserPlus from '@tabler/icons-svelte-runes/icons/user-plus';
	import IconUsers from '@tabler/icons-svelte-runes/icons/users';

	import Avatar from '#lib/components/Avatar.svelte';
	import FollowButton from '#lib/components/FollowButton.svelte';
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
		onrepoststoggle
	} = $props();

	/** Keeps the follower count in step with the button without a page reload. */
	let followerOverride = $state(/** @type {number | null} */ (null));
	const followerCount = $derived(followerOverride ?? stats.followerCount);

	/** @param {number} n */
	function padCount(n) {
		return String(n).padStart(2, '0');
	}
</script>

<aside class="profile-sidebar" aria-label="About {name}">
	<section class="panel" aria-label="Stats">
		<ul class="stat-grid">
			<li class="stat accent">
				<IconUsers size={14} stroke={1.75} aria-hidden="true" />
				<span class="stat-value">{followerCount}</span>
				<span class="stat-label">Followers</span>
			</li>
			<li class="stat">
				<IconUserPlus size={14} stroke={1.75} aria-hidden="true" />
				<span class="stat-value">{stats.followingCount}</span>
				<span class="stat-label">Following</span>
			</li>
			<li class="stat">
				<IconMusic size={14} stroke={1.75} aria-hidden="true" />
				<span class="stat-value">{stats.trackCount}</span>
				<span class="stat-label">Tracks</span>
			</li>
			<li class="stat">
				<IconHeart size={14} stroke={1.75} aria-hidden="true" />
				<span class="stat-value">{stats.likeCount}</span>
				<span class="stat-label">Likes</span>
			</li>
		</ul>

		{#if !isOwner}
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

		{#if hasReposts}
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

	<section class="panel" aria-labelledby="fans-also-like-heading">
		<header class="panel-head">
			<div class="panel-titles">
				<p class="eyebrow">Discover</p>
				<h2 id="fans-also-like-heading">Fans Also Like</h2>
			</div>
		</header>
		{#if fansAlsoLike.length === 0}
			<p class="empty-line">Nothing to compare yet.</p>
		{:else}
			<ul class="row-list">
				{#each fansAlsoLike as artist (artist.username)}
					<li><ArtistRow {artist} {signedIn} {linkBase} /></li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="panel" aria-labelledby="followers-heading">
		<header class="panel-head">
			<div class="panel-titles">
				<p class="eyebrow">Audience</p>
				<h2 id="followers-heading">
					{followerCount}
					{followerCount === 1 ? 'Follower' : 'Followers'}
				</h2>
			</div>
			<span class="panel-meta" aria-hidden="true">
				<IconUsers size={14} stroke={1.75} />
				{padCount(followers.length)}
			</span>
		</header>
		{#if followers.length === 0}
			<p class="empty-line">No followers yet.</p>
		{:else}
			<ul class="row-list">
				{#each followers as artist (artist.username)}
					<li><ArtistRow {artist} {signedIn} {linkBase} /></li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="panel" aria-labelledby="profile-comments-heading">
		<header class="panel-head">
			<div class="panel-titles">
				<p class="eyebrow">Activity</p>
				<h2 id="profile-comments-heading">Last Comments</h2>
			</div>
		</header>
		{#if recentComments.length === 0}
			<p class="empty-line">No comments yet.</p>
		{:else}
			<ul class="item-list">
				{#each recentComments as comment (comment.id)}
					<li>
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
		{/if}
	</section>
</aside>

<style>
	.profile-sidebar {
		display: grid;
		gap: 1.15rem;
		align-content: start;
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
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		padding-bottom: 0.65rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.panel-titles {
		min-width: 0;
	}

	.panel-titles .eyebrow {
		margin: 0 0 0.35rem;
	}

	.panel-titles h2 {
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 1.2rem;
		font-weight: 400;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	.panel-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
		padding: 0.28rem 0.4rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		color: var(--muted);
		background: color-mix(in srgb, var(--paper) 92%, var(--ink));
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.panel-meta :global(svg) {
		display: block;
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

	@media (pointer: coarse) {
		.repost-toggle {
			min-height: var(--tap-min);
		}
	}
</style>
