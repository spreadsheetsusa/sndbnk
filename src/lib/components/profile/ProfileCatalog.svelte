<script>
	import IconMapPin from '@tabler/icons-svelte-runes/icons/map-pin';
	import IconPencil from '@tabler/icons-svelte-runes/icons/pencil';
	import Avatar from '#lib/components/Avatar.svelte';
	import ProfileLinkIcon from '#lib/components/ProfileLinkIcon.svelte';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import PlaylistCard from '#lib/components/player/PlaylistCard.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';
	import ProfileSidebar from '#lib/components/profile/ProfileSidebar.svelte';

	/**
	 * @typedef {{
	 *   tab: 'tracks' | 'likes' | 'history',
	 *   profile: {
	 *     userId?: string,
	 *     username: string,
	 *     name: string,
	 *     plan: string,
	 *     bio: string | null,
	 *     bioHtml: string | null,
	 *     location: string | null,
	 *     avatarUrl: string | null,
	 *     customDomain: string | null,
	 *     customDomainStatus: string
	 *   },
	 *   links: Array<{ id: string, label: string, url: string }>,
	 *   stats: import('#lib/components/profile/ProfileSidebar.svelte').ProfileStats,
	 *   sidebar: {
	 *     fansAlsoLike: import('#lib/components/profile/ArtistRow.svelte').Artist[],
	 *     followers: import('#lib/components/profile/ArtistRow.svelte').Artist[],
	 *     recentComments: import('#lib/components/profile/ProfileSidebar.svelte').RecentComment[]
	 *   },
	 *   sidebarVisibility: {
	 *     enabled: boolean,
	 *     stats: boolean,
	 *     fansAlsoLike: boolean,
	 *     followers: boolean,
	 *     activity: boolean
	 *   } | null,
	 *   viaTenantHost: boolean,
	 *   siteOrigin: string,
	 *   viewer: {
	 *     id: string,
	 *     name: string,
	 *     image: string | null,
	 *     isOwner: boolean,
	 *     isFollowing: boolean
	 *   } | null
	 * }} ProfileCatalogData
	 */

	/**
	 * @type {{
	 *   data: ProfileCatalogData,
	 *   list: import('#lib/lists/track-list.svelte.js').TrackList,
	 *   showHero?: boolean,
	 *   showTabs?: boolean,
	 *   showSidebar?: boolean,
	 *   sameHostResources?: boolean
	 * }}
	 */
	let {
		data,
		list,
		showHero = true,
		showTabs = true,
		showSidebar = true,
		sameHostResources = false
	} = $props();

	const uid = $props.id();
	const profileNameId = `${uid}-profile-name`;
	const tracksHeadingId = `${uid}-tracks-heading`;
	let showReposts = $state(true);
	const hasReposts = $derived(
		data.tab === 'tracks' && list.items.some((track) => track.repostedAt)
	);
	const items = $derived(
		data.tab === 'tracks' && !showReposts
			? list.items.filter((track) => !track.repostedAt)
			: list.items
	);
	const profileLinkBase = $derived(data.viaTenantHost ? data.siteOrigin : '');
	const resourceLinkBase = $derived(sameHostResources ? '' : profileLinkBase);

	const tabs = $derived.by(() => {
		/** @type {Array<{ id: 'tracks' | 'likes' | 'history', label: string }>} */
		const base = [
			{ id: 'tracks', label: 'Tracks' },
			{ id: 'likes', label: 'Likes' }
		];
		if (data.viewer?.isOwner) base.push({ id: 'history', label: 'Listening History' });
		return base;
	});

	const emptyCopy = $derived(
		data.tab === 'likes'
			? 'No likes yet.'
			: data.tab === 'history'
				? 'Nothing in listening history yet.'
				: 'No tracks have been uploaded yet.'
	);

	const headingCopy = $derived(
		data.tab === 'likes'
			? `Likes by ${data.profile.name}`
			: data.tab === 'history'
				? 'Your listening history'
				: `Tracks and playlists by ${data.profile.name}`
	);

	/**
	 * @param {'tracks' | 'likes' | 'history'} id
	 */
	function tabHref(id) {
		return id === 'tracks' ? '?' : `?tab=${id}`;
	}

	const sidebarCards = $derived.by(() => {
		const visibility = data.sidebarVisibility;
		if (!visibility) {
			return {
				stats: true,
				fansAlsoLike: true,
				followers: true,
				activity: true
			};
		}
		if (!visibility.enabled) {
			return {
				stats: false,
				fansAlsoLike: false,
				followers: false,
				activity: false
			};
		}
		return {
			stats: visibility.stats,
			fansAlsoLike: visibility.fansAlsoLike,
			followers: visibility.followers,
			activity: visibility.activity
		};
	});
	const hasSidebarCards = $derived(
		showSidebar &&
			(sidebarCards.stats ||
				sidebarCards.fansAlsoLike ||
				sidebarCards.followers ||
				sidebarCards.activity)
	);

	/** The server has already sanitized `bioHtml` before it reaches this component. */
	const renderBio = $derived.by(() => {
		const html = data.profile.bioHtml ?? '';
		/** @type {import('svelte/attachments').Attachment} */
		return (node) => {
			node.innerHTML = html;
			return () => node.replaceChildren();
		};
	});
</script>

<div class="profile-catalog">
	<div class="profile-grid" class:no-sidebar={!hasSidebarCards}>
		<div class="profile-main">
			{#if showHero}
				<section class="hero" aria-labelledby={profileNameId}>
					<p class="eyebrow eyebrow-chip accent-text">
						{data.viaTenantHost ? 'Music' : 'Public profile'}
					</p>
					<div class="name-block">
						<div class="signal" aria-hidden="true">
							<svg viewBox="0 0 800 180" role="presentation" preserveAspectRatio="none">
								<path
									d="M0 90 H40 L55 60 L70 120 L90 30 L110 150 L130 70 L150 100 L170 20 L190 160 L210 55 L230 115 L250 40 L270 140 L290 80 L310 95 L330 50 L350 130 L370 75 L390 105 L410 35 L430 145 L450 65 L470 110 L490 45 L510 135 L530 85 L550 100 L570 25 L590 155 L610 60 L630 120 L650 70 L670 100 L690 55 L710 125 L730 90 H800"
								/>
							</svg>
						</div>
						<h1 id={profileNameId} class="display-face">{data.profile.name}</h1>
					</div>

					<div class="identity">
						<Avatar src={data.profile.avatarUrl} name={data.profile.name} size="3.5rem" />
						<div class="identity-copy">
							<p class="handle">@{data.profile.username}</p>
							{#if data.profile.location}
								<p class="location">
									<IconMapPin size={15} stroke={1.75} />
									{data.profile.location}
								</p>
							{/if}
						</div>
						{#if data.viewer?.isOwner}
							<a class="edit-btn" href="{profileLinkBase}/settings" aria-label="Edit profile">
								<IconPencil size={16} stroke={1.75} aria-hidden="true" />
							</a>
						{/if}
					</div>

					{#if data.profile.bioHtml}
						<div class="bio" {@attach renderBio}></div>
					{/if}

					{#if data.links.length > 0}
						<ul class="link-list" aria-label="Links">
							{#each data.links as link (link.id)}
								<li>
									<a href={link.url} target="_blank" rel="me noopener nofollow">
										<span class="link-glyph" aria-hidden="true">
											<ProfileLinkIcon label={link.label} />
										</span>
										<span class="link-label">{link.label}</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}

			<section class="tracks" class:without-hero={!showHero} aria-labelledby={tracksHeadingId}>
				{#if showTabs}
					<nav class="scope-strip" aria-label="Profile library">
						{#each tabs as tab (tab.id)}
							<a
								class="scope-btn"
								href={tabHref(tab.id)}
								aria-current={data.tab === tab.id ? 'page' : undefined}
							>
								{tab.label}
							</a>
						{/each}
					</nav>
				{/if}
				<h2 id={tracksHeadingId} class="sr-only">{headingCopy}</h2>
				{#if list.items.length === 0}
					<p class="lede">{emptyCopy}</p>
				{:else if items.length === 0}
					<p class="lede">Reposts are hidden. Turn them back on to see this profile's picks.</p>
				{:else}
					<div class="list-rail">
						<InfiniteList {list} moreLabel="Load more">
							<ul class="profile-track-list">
								{#each items as item (item.id)}
									<li data-cursor={item.cursor}>
										{#if item.kind === 'playlist'}
											<PlaylistCard
												playlist={item}
												linkBase={resourceLinkBase}
												signedIn={Boolean(data.viewer)}
												viewerId={data.viewer?.id ?? null}
												viewerName={data.viewer?.name ?? null}
												viewerImage={data.viewer?.image ?? null}
												ondeleted={() => list.remove(item.id)}
											/>
										{:else}
											<TrackCard
												track={item}
												linkBase={resourceLinkBase}
												signedIn={Boolean(data.viewer)}
												viewerId={data.viewer?.id ?? null}
												viewerName={data.viewer?.name ?? null}
												viewerImage={data.viewer?.image ?? null}
												ondeleted={() => list.remove(item.id)}
											/>
										{/if}
									</li>
								{/each}
							</ul>
						</InfiniteList>
					</div>
				{/if}
			</section>
		</div>

		{#if hasSidebarCards}
			<ProfileSidebar
				username={data.profile.username}
				name={data.profile.name}
				stats={data.stats}
				fansAlsoLike={data.sidebar.fansAlsoLike}
				followers={data.sidebar.followers}
				recentComments={data.sidebar.recentComments}
				signedIn={Boolean(data.viewer)}
				isOwner={Boolean(data.viewer?.isOwner)}
				isFollowing={Boolean(data.viewer?.isFollowing)}
				{hasReposts}
				{showReposts}
				linkBase={profileLinkBase}
				showStats={sidebarCards.stats}
				showFansAlsoLike={sidebarCards.fansAlsoLike}
				showFollowers={sidebarCards.followers}
				showActivity={sidebarCards.activity}
				onrepoststoggle={(next) => (showReposts = next)}
			/>
		{/if}
	</div>
</div>

<style>
	.profile-catalog {
		width: min(100%, var(--site-content-max-wide));
		margin-inline: auto;
	}

	.profile-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--site-sidebar-width);
		column-gap: clamp(2rem, 5vw, 3rem);
		align-items: start;
	}

	.profile-grid.no-sidebar {
		grid-template-columns: minmax(0, 1fr);
	}

	.profile-main {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		min-width: 0;
	}

	.hero {
		max-width: 38rem;
		animation: rise 0.7s ease both;
	}

	.hero > .eyebrow {
		margin: 0 0 0.35rem;
	}

	.name-block {
		position: relative;
		z-index: 0;
	}

	h1 {
		position: relative;
		margin: 0;
		font-size: clamp(2.75rem, 7vw, 4.5rem);
		line-height: 0.95;
		letter-spacing: -0.03em;
		word-break: break-word;
	}

	.identity {
		display: flex;
		gap: 0.85rem;
		align-items: center;
		margin-top: 0.55rem;
	}

	.identity-copy {
		min-width: 0;
		flex: 1;
	}

	.edit-btn {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 2.1rem;
		height: 2.1rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		color: var(--ink);
		background: transparent;
		text-decoration: none;
		transition:
			border-color 120ms ease,
			background 120ms ease,
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1);
	}

	.edit-btn:hover {
		border-color: var(--ink);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}

	.edit-btn:active {
		transform: translate(1px, 1px);
	}

	.edit-btn :global(svg) {
		display: block;
	}

	.handle {
		margin: 0;
		color: var(--muted);
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.location {
		display: flex;
		gap: 0.3rem;
		align-items: center;
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.bio {
		max-width: 34rem;
		margin: 0.85rem 0 0;
		font-size: 1rem;
		line-height: 1.5;
		animation: rise 0.8s ease 0.06s both;
	}

	.bio :global(p) {
		margin: 0 0 0.55em;
	}

	.bio :global(p:last-child) {
		margin-bottom: 0;
	}

	.bio :global(ul),
	.bio :global(ol) {
		margin: 0.35em 0 0.55em;
		padding-left: 1.25rem;
	}

	.bio :global(li) {
		margin: 0.15em 0;
	}

	.bio :global(a) {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	.bio :global(a:hover) {
		color: color-mix(in srgb, var(--accent) 55%, var(--ink));
	}

	.link-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
		animation: rise 0.85s ease 0.12s both;
	}

	.link-list a {
		display: inline-flex;
		gap: 0.45rem;
		align-items: center;
		padding: 0.45rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		color: var(--ink);
		text-decoration: none;
		transition:
			border-color 120ms ease,
			background 120ms ease,
			transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1);
	}

	.link-list a:hover {
		border-color: var(--ink);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}

	.link-list a:active {
		transform: translate(1px, 1px);
	}

	.link-glyph {
		display: inline-flex;
		align-items: center;
	}

	.link-label {
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.lede {
		max-width: 32rem;
		margin: 1rem 0 0;
		color: var(--muted);
		font-size: 1rem;
		line-height: 1.45;
		animation: rise 0.8s ease 0.08s both;
	}

	.tracks {
		min-width: 0;
		padding-top: clamp(1rem, 2.5vw, 1.25rem);
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.85s ease 0.2s both;
	}

	.tracks.without-hero {
		padding-top: 0;
		border-top: 0;
	}

	.tracks > .lede {
		margin-top: 1.25rem;
	}

	.scope-strip {
		display: flex;
		flex-wrap: wrap;
		width: fit-content;
		max-width: 100%;
		margin-bottom: 1.25rem;
		border: 1px solid var(--hard-border);
		box-shadow: 3px 3px 0 var(--hard-shadow);
	}

	.scope-btn {
		display: inline-flex;
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
	}

	.list-rail {
		min-width: 0;
	}

	.profile-track-list {
		display: grid;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.profile-track-list li {
		content-visibility: auto;
		contain-intrinsic-size: auto 192px;
	}

	.profile-track-list li:has(:global(.more-btn[aria-expanded='true'])) {
		position: relative;
		z-index: 2;
		content-visibility: visible;
	}

	.signal {
		position: absolute;
		z-index: -1;
		inset: -18% -8%;
		mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent);
		animation: pulse-line 3.2s ease-in-out infinite;
	}

	.signal svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.signal path {
		fill: none;
		stroke: var(--accent);
		stroke-width: 4;
		vector-effect: non-scaling-stroke;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.75rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse-line {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 0.8;
		}
	}

	@media (max-width: 960px) {
		.profile-grid {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 1rem;
		}

		.profile-main {
			display: contents;
		}

		.hero {
			order: 1;
		}

		.profile-grid :global(.profile-sidebar) {
			order: 2;
		}

		.tracks {
			order: 3;
		}
	}

	@media (max-width: 640px) {
		.hero {
			padding-bottom: 0.25rem;
		}

		h1 {
			font-size: clamp(2rem, 7vw, 4.5rem);
		}

		.tracks {
			padding-top: 1rem;
		}

		.tracks.without-hero {
			padding-top: 0;
		}
	}

	@media (max-width: 560px) {
		.signal {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.edit-btn {
			width: var(--tap-min);
			height: var(--tap-min);
		}
	}
</style>
