<script>
	import IconMapPin from '@tabler/icons-svelte-runes/icons/map-pin';
	import IconPencil from '@tabler/icons-svelte-runes/icons/pencil';
	import Avatar from '#lib/components/Avatar.svelte';
	import ProfileLinkIcon from '#lib/components/ProfileLinkIcon.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import InfiniteList from '#lib/components/lists/InfiniteList.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';
	import ProfileSidebar from '#lib/components/profile/ProfileSidebar.svelte';
	import { displayUrl } from '#lib/profile-links.js';

	/**
	 * @typedef {{
	 *   profile: {
	 *     username: string,
	 *     name: string,
	 *     plan: string,
	 *     bio: string | null,
	 *     location: string | null,
	 *     avatarUrl: string | null,
	 *     customDomain: string | null,
	 *     customDomainStatus: string
	 *   },
	 *   site?: {
	 *     name: string | null,
	 *     description: string | null,
	 *     logoUrl: string | null,
	 *     ogImageUrl: string | null,
	 *     accentColor: string | null,
	 *     hideBranding: boolean
	 *   } | null,
	 *   links: Array<{ id: string, label: string, url: string }>,
	 *   tracks: import('#lib/components/player/TrackCard.svelte').CardTrack[],
	 *   stats: import('#lib/components/profile/ProfileSidebar.svelte').ProfileStats,
	 *   sidebar: {
	 *     fansAlsoLike: import('#lib/components/profile/ArtistRow.svelte').Artist[],
	 *     followers: import('#lib/components/profile/ArtistRow.svelte').Artist[],
	 *     recentComments: import('#lib/components/profile/ProfileSidebar.svelte').RecentComment[]
	 *   },
	 *   viaTenantHost: boolean,
	 *   siteOrigin: string,
	 *   viewer: {
	 *     id: string,
	 *     name: string,
	 *     image: string | null,
	 *     isOwner: boolean,
	 *     isFollowing: boolean
	 *   } | null
	 * }} ProfilePageData
	 */

	/**
	 * @type {{
	 *   data: ProfilePageData,
	 *   list: import('#lib/lists/track-list.svelte.js').TrackList
	 * }}
	 */
	let { data, list } = $props();

	/** Viewer-side filter only — nothing about it is persisted. */
	let showReposts = $state(true);
	const hasReposts = $derived(list.items.some((track) => track.repostedAt));
	const items = $derived(
		showReposts ? list.items : list.items.filter((track) => !track.repostedAt)
	);
	const linkBase = $derived(data.viaTenantHost ? data.siteOrigin : '');
	const siteName = $derived(data.site?.name?.trim() || data.profile.name);
	const showPoweredBy = $derived(data.viaTenantHost && !data.site?.hideBranding);
</script>

<div class="profile-page" class:tenant-host={data.viaTenantHost}>
	{#if data.viaTenantHost}
		<header class="tenant-chrome">
			<a class="tenant-brand" href="/">
				{#if data.site?.logoUrl}
					<img class="tenant-logo" src={data.site.logoUrl} alt="" />
				{/if}
				<span class="tenant-name display-face">{siteName}</span>
			</a>
		</header>
	{:else}
		<SiteHeader />
	{/if}

	<main>
		<div class="profile-grid">
			<div class="block">
				<section class="hero" aria-labelledby="profile-name">
					<p class="eyebrow eyebrow-chip accent-text">
						{data.viaTenantHost ? 'Home' : 'Public profile'}
					</p>
					<div class="name-block">
						<div class="signal" aria-hidden="true">
							<svg viewBox="0 0 800 180" role="presentation" preserveAspectRatio="none">
								<path
									d="M0 90 H40 L55 60 L70 120 L90 30 L110 150 L130 70 L150 100 L170 20 L190 160 L210 55 L230 115 L250 40 L270 140 L290 80 L310 95 L330 50 L350 130 L370 75 L390 105 L410 35 L430 145 L450 65 L470 110 L490 45 L510 135 L530 85 L550 100 L570 25 L590 155 L610 60 L630 120 L650 70 L670 100 L690 55 L710 125 L730 90 H800"
								/>
							</svg>
						</div>
						<h1 id="profile-name" class="display-face">{data.profile.name}</h1>
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
							<a class="edit-btn" href="/settings" aria-label="Edit profile">
								<IconPencil size={16} stroke={1.75} aria-hidden="true" />
							</a>
						{/if}
					</div>

					{#if data.profile.bio}
						<p class="bio">{data.profile.bio}</p>
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
										<span class="link-url">{displayUrl(link.url)}</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}

					{#if list.items.length === 0}
						<p class="lede">No tracks have been uploaded yet.</p>
					{/if}
				</section>

				{#if list.items.length > 0}
					<section class="tracks" aria-labelledby="tracks-heading">
						<p class="eyebrow">{hasReposts ? 'Tracks & Reposts' : 'Tracks'}</p>
						<h2 id="tracks-heading" class="sr-only">Tracks by {data.profile.name}</h2>
						{#if items.length === 0}
							<p class="lede">Reposts are hidden. Turn them back on to see this profile's picks.</p>
						{:else}
							<InfiniteList {list} moreLabel="Load more tracks">
								<ul class="profile-track-list">
									{#each items as track (track.id)}
										<li data-cursor={track.cursor}>
											<TrackCard
												{track}
												{linkBase}
												signedIn={Boolean(data.viewer)}
												viewerName={data.viewer?.name ?? null}
												viewerImage={data.viewer?.image ?? null}
												ondeleted={() => list.remove(track.id)}
											/>
										</li>
									{/each}
								</ul>
							</InfiniteList>
						{/if}
					</section>
				{/if}
			</div>

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
				{linkBase}
				onrepoststoggle={(next) => (showReposts = next)}
			/>
		</div>
	</main>

	{#if !data.viaTenantHost}
		<SiteFooter bordered />
	{:else if showPoweredBy}
		<footer class="tenant-footer">
			<a href={data.siteOrigin} rel="noopener">Powered by SNDBNK</a>
		</footer>
	{/if}
</div>

<style>
	.profile-page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) clamp(1.25rem, 4vw, 2.5rem);
	}

	.profile-page.tenant-host {
		display: grid;
		align-content: start;
	}

	.tenant-chrome {
		display: flex;
		align-items: center;
		padding: 0.85rem 0 0.5rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
	}

	.tenant-brand {
		display: inline-flex;
		gap: 0.65rem;
		align-items: center;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}

	.tenant-logo {
		width: 2rem;
		height: 2rem;
		object-fit: cover;
		border: 1px solid var(--ink);
	}

	.tenant-name {
		overflow: hidden;
		font-size: 1.15rem;
		letter-spacing: -0.02em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tenant-footer a {
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.tenant-footer a:hover {
		color: var(--ink);
	}

	.tenant-footer {
		padding: 1.25rem 0 0.25rem;
		text-align: center;
	}

	main {
		width: min(100%, var(--site-content-max-wide));
		margin: 0 auto;
		padding-top: clamp(0.75rem, 2vw, 1.25rem);
	}

	.profile-page.tenant-host main {
		padding-top: 0;
	}

	.profile-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--site-sidebar-width);
		gap: clamp(2rem, 5vw, 3rem);
		align-items: start;
	}

	.block {
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
		white-space: pre-line;
		animation: rise 0.8s ease 0.06s both;
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

	.link-url {
		max-width: 14rem;
		overflow: hidden;
		color: var(--muted);
		font-size: 0.72rem;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		margin-top: 2.5rem;
		padding-top: clamp(1.5rem, 4vw, 2rem);
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.85s ease 0.2s both;
	}

	.tracks > .eyebrow {
		margin: 0 0 0.75rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	.profile-track-list {
		display: grid;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Off-screen cards skip layout and paint entirely; `auto` keeps each row's
	   real height once measured, so scrolling back up lands where it should. */
	.profile-track-list li {
		content-visibility: auto;
		contain-intrinsic-size: auto 192px;
	}

	/* `content-visibility: auto` paint-contains the row and clips the absolute
	   menu; drop containment for the open row and stack it above neighbors.
	   `.more-btn` is in TrackCard, so it must be `:global` here. */
	.profile-track-list li:has(:global(.more-btn[aria-expanded='true'])) {
		position: relative;
		z-index: 2;
		content-visibility: visible;
	}

	.signal {
		position: absolute;
		z-index: -1;
		inset: -18% -8%;
		/* Fade the ends so the trace reads as texture rather than a boxed-in graphic */
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
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		main {
			padding-top: 0.5rem;
		}

		.hero {
			padding-bottom: 0.25rem;
		}

		h1 {
			font-size: clamp(2rem, 7vw, 4.5rem);
		}

		.hero > .lede {
			display: none;
		}

		.tracks {
			margin-top: 1.75rem;
			padding-top: 1.25rem;
		}
	}

	@media (max-width: 560px) {
		.signal {
			display: none;
		}

		.link-url {
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
