<script>
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';

	import Avatar from '#lib/components/Avatar.svelte';
	import FollowButton from '#lib/components/FollowButton.svelte';

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

	/**
	 * @param {number} n
	 */
	function padRank(n) {
		return String(n).padStart(2, '0');
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
</script>

<aside class="feed-sidebar" aria-label="Discover">
	<nav class="scope-strip" aria-label="Feed scope">
		<a
			class="scope-btn"
			href={feedHref({ genre: activeGenre })}
			aria-current={following ? undefined : 'page'}
		>
			All
		</a>
		<a
			class="scope-btn"
			href={feedHref({ genre: activeGenre, following: true })}
			aria-current={following ? 'page' : undefined}
		>
			Following
		</a>
	</nav>

	<section class="panel" aria-labelledby="most-liked-heading">
		<header class="panel-head">
			<p id="most-liked-heading" class="eyebrow">Popular</p>
		</header>
		{#if mostLiked.length === 0}
			<p class="empty-line">No likes yet.</p>
		{:else}
			<ol class="item-list">
				{#each mostLiked as item, index (item.id)}
					<li>
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
		{/if}
	</section>

	<section class="panel" aria-labelledby="new-artists-heading">
		<header class="panel-head">
			<p id="new-artists-heading" class="eyebrow">New Artists</p>
		</header>
		{#if newArtists.length === 0}
			<p class="empty-line">No artists yet.</p>
		{:else}
			<ul class="item-list">
				{#each newArtists as artist (artist.username)}
					<li class="artist-line">
						<a class="item artist" href="/users/{artist.username}">
							<Avatar src={artist.image} name={artist.name} size="1.85rem" />
							<span class="item-copy">
								<span class="item-title">{artist.name}</span>
								<span class="item-meta">@{artist.username}</span>
							</span>
							<span class="item-stat tracks">{artist.trackCount}</span>
						</a>
						{#if !artist.isViewer}
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
		{/if}
	</section>

	<section class="panel" aria-labelledby="recent-activity-heading">
		<header class="panel-head">
			<p id="recent-activity-heading" class="eyebrow">Activity</p>
		</header>
		{#if recentComments.length === 0}
			<p class="empty-line">No comments yet.</p>
		{:else}
			<ul class="item-list">
				{#each recentComments as comment (comment.id)}
					<li>
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
		{/if}
	</section>

	<section class="panel" aria-labelledby="genres-heading">
		<header class="panel-head">
			<p id="genres-heading" class="eyebrow">Browse</p>
		</header>
		{#if genres.length === 0}
			<p class="empty-line">No genres yet.</p>
		{:else}
			<ul class="genre-list">
				{#each genres as entry (entry.genre)}
					<li>
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
		{/if}
	</section>
</aside>

<style>
	.feed-sidebar {
		display: grid;
		gap: 1.15rem;
		align-content: start;
	}

	@media (min-width: 961px) {
		.feed-sidebar {
			position: sticky;
			top: calc(var(--site-header-height) + 1rem);
		}
	}

	.scope-strip {
		display: flex;
		width: 100%;
		border: 1px solid var(--hard-border);
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	.scope-btn {
		display: inline-flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		min-height: 2.25rem;
		padding: 0.4rem 1rem;
		border-right: 1px solid var(--hard-border);
		color: var(--ink);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		line-height: 1;
		text-decoration: none;
		text-transform: uppercase;
		transition:
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1),
			background 120ms ease,
			box-shadow 120ms ease,
			color 120ms ease;
	}

	.scope-btn:last-child {
		border-right: 0;
	}

	.scope-btn:hover {
		background: color-mix(in srgb, var(--accent) 35%, var(--paper));
	}

	.scope-btn[aria-current='page'] {
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 35%, transparent);
		transform: translate(1px, 1px);
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

	@media (pointer: coarse) {
		.scope-btn,
		.genre-chip {
			min-height: var(--tap-min);
		}
	}
</style>
