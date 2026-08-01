<script>
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconUsers from '@tabler/icons-svelte-runes/icons/users';

	import Avatar from '#lib/components/Avatar.svelte';
	import FollowButton from '#lib/components/FollowButton.svelte';

	/**
	 * @typedef {Object} Artist
	 * @property {string} username
	 * @property {string} name
	 * @property {string | null} image
	 * @property {number} followerCount
	 * @property {number} likeCount
	 * @property {boolean} followedByViewer
	 * @property {boolean} [isViewer]
	 */

	/**
	 * `linkBase` is the apex origin on tenant hosts, where `/users/*` does not resolve.
	 * @type {{ artist: Artist, signedIn?: boolean, showFollow?: boolean, linkBase?: string }}
	 */
	let { artist, signedIn = false, showFollow = true, linkBase = '' } = $props();
</script>

<div class="artist-row">
	<a class="artist-link" href="{linkBase}/users/{artist.username}">
		<Avatar src={artist.image} name={artist.name} size="2.1rem" />
		<span class="copy">
			<span class="name">{artist.name}</span>
			<span class="meta">
				<span class="stat">
					<IconUsers size={11} stroke={1.75} aria-hidden="true" />
					{artist.followerCount}
				</span>
				<span class="stat">
					<IconHeart size={11} stroke={1.75} aria-hidden="true" />
					{artist.likeCount}
				</span>
			</span>
		</span>
	</a>

	{#if showFollow && !artist.isViewer}
		<FollowButton
			username={artist.username}
			name={artist.name}
			following={artist.followedByViewer}
			{signedIn}
			size="sm"
		/>
	{/if}
</div>

<style>
	.artist-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		padding: 0.4rem;
		border: 1px solid transparent;
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}

	.artist-row:hover {
		border-color: color-mix(in srgb, var(--ink) 22%, transparent);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}

	.artist-link {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		min-width: 0;
		flex: 1;
		color: inherit;
		text-decoration: none;
	}

	.copy {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.name {
		overflow: hidden;
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: -0.01em;
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		color: var(--muted);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.stat {
		display: inline-flex;
		gap: 0.2rem;
		align-items: center;
	}

	.stat :global(svg) {
		display: block;
	}
</style>
