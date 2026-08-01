<script>
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconMessage from '@tabler/icons-svelte-runes/icons/message';
	import IconTags from '@tabler/icons-svelte-runes/icons/tags';
	import IconUserPlus from '@tabler/icons-svelte-runes/icons/user-plus';

	import Avatar from '#lib/components/Avatar.svelte';

	/**
	 * @typedef {{ id: string, title: string, uploaderName: string, username: string | null, likeCount: number }} LikedTrack
	 * @typedef {{ username: string, name: string, image: string | null, trackCount: number }} Artist
	 * @typedef {{ id: string, body: string, createdAt: number, userName: string, userImage: string | null, trackId: string, trackTitle: string }} RecentComment
	 * @typedef {{ genre: string, count: number }} GenreCount
	 */

	/**
	 * @type {{
	 *   mostLiked: LikedTrack[],
	 *   newArtists: Artist[],
	 *   recentComments: RecentComment[],
	 *   genres: GenreCount[],
	 *   activeGenre?: string | null
	 * }}
	 */
	let { mostLiked, newArtists, recentComments, genres, activeGenre = null } = $props();

	/**
	 * @param {number} n
	 */
	function padRank(n) {
		return String(n).padStart(2, '0');
	}
</script>

<aside class="feed-sidebar" aria-label="Discover">
	<section class="panel" aria-labelledby="most-liked-heading">
		<header class="panel-head">
			<div class="panel-titles">
				<p class="eyebrow">Popular</p>
				<h2 id="most-liked-heading">Most Liked</h2>
			</div>
			<span class="panel-meta" aria-hidden="true">
				<IconHeart size={14} stroke={1.75} />
				{padRank(mostLiked.length)}
			</span>
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
			<div class="panel-titles">
				<p class="eyebrow">Fresh</p>
				<h2 id="new-artists-heading">New Artists</h2>
			</div>
			<span class="panel-meta" aria-hidden="true">
				<IconUserPlus size={14} stroke={1.75} />
				{padRank(newArtists.length)}
			</span>
		</header>
		{#if newArtists.length === 0}
			<p class="empty-line">No artists yet.</p>
		{:else}
			<ul class="item-list">
				{#each newArtists as artist (artist.username)}
					<li>
						<a class="item artist" href="/users/{artist.username}">
							<Avatar src={artist.image} name={artist.name} size="1.85rem" />
							<span class="item-copy">
								<span class="item-title">{artist.name}</span>
								<span class="item-meta">@{artist.username}</span>
							</span>
							<span class="item-stat tracks">{artist.trackCount}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="panel" aria-labelledby="recent-activity-heading">
		<header class="panel-head">
			<div class="panel-titles">
				<p class="eyebrow">Activity</p>
				<h2 id="recent-activity-heading">Recent Activity</h2>
			</div>
			<span class="panel-meta" aria-hidden="true">
				<IconMessage size={14} stroke={1.75} />
				{padRank(recentComments.length)}
			</span>
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
			<div class="panel-titles">
				<p class="eyebrow">Browse</p>
				<h2 id="genres-heading">By Genre</h2>
			</div>
			<span class="panel-meta" aria-hidden="true">
				<IconTags size={14} stroke={1.75} />
				{padRank(genres.length)}
			</span>
		</header>
		{#if genres.length === 0}
			<p class="empty-line">No genres yet.</p>
		{:else}
			<ul class="genre-list">
				{#each genres as entry (entry.genre)}
					<li>
						<a
							class={['genre-chip', activeGenre === entry.genre && 'active']}
							href="/feed?genre={encodeURIComponent(entry.genre)}"
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
			top: 1rem;
		}
	}

	.panel {
		padding: 0.85rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--ink);
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
		font-family: Georgia, 'Times New Roman', serif;
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
		border: 1px solid var(--ink);
		color: var(--ink);
		background: var(--paper);
		box-shadow: 2px 2px 0 color-mix(in srgb, var(--ink) 55%, transparent);
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
		box-shadow: 1px 1px 0 var(--ink);
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
</style>
