<script>
	import IconMapPin from '@tabler/icons-svelte-runes/icons/map-pin';
	import { invalidateAll } from '$app/navigation';
	import Avatar from '#lib/components/Avatar.svelte';
	import ProfileLinkIcon from '#lib/components/ProfileLinkIcon.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import TrackCard from '#lib/components/player/TrackCard.svelte';
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
	 *   links: Array<{ id: string, label: string, url: string }>,
	 *   urls: {
	 *     pathUrl: string,
	 *     subdomainUrl: string | null,
	 *     customDomainUrl: string | null,
	 *     cnameTarget: string
	 *   },
	 *   tracks: import('#lib/components/player/TrackCard.svelte').CardTrack[],
	 *   viaTenantHost: boolean,
	 *   viewer: { id: string, name: string, image: string | null, isOwner: boolean } | null
	 * }} ProfilePageData
	 */

	/** @type {{ data: ProfilePageData }} */
	let { data } = $props();
</script>

<div class="profile-page" class:tenant-host={data.viaTenantHost}>
	{#if !data.viaTenantHost}
		<SiteHeader />
	{/if}

	<main>
		<section class="hero" aria-labelledby="profile-name">
			<p class="eyebrow eyebrow-chip accent-text">Public profile</p>
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
				<Avatar src={data.profile.avatarUrl} name={data.profile.name} size="4.5rem" />
				<div class="identity-copy">
					<p class="handle">@{data.profile.username}</p>
					{#if data.profile.location}
						<p class="location">
							<IconMapPin size={15} stroke={1.75} />
							{data.profile.location}
						</p>
					{/if}
				</div>
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

			{#if data.tracks.length === 0}
				<p class="lede">
					This space is ready for sound. Tracks, releases, and the rest of SNDBNK will land here.
				</p>
			{/if}

			<ul class="url-list" aria-label="Profile addresses">
				<li>
					<span class="url-label">Path</span>
					<a href={data.urls.pathUrl}>{data.urls.pathUrl.replace(/^https?:\/\//, '')}</a>
				</li>
				{#if data.urls.subdomainUrl}
					<li>
						<span class="url-label">Subdomain</span>
						<a href={data.urls.subdomainUrl}>{data.urls.subdomainUrl.replace(/^https?:\/\//, '')}</a
						>
					</li>
				{/if}
				{#if data.urls.customDomainUrl}
					<li>
						<span class="url-label">Custom</span>
						<a href={data.urls.customDomainUrl}
							>{data.urls.customDomainUrl.replace(/^https?:\/\//, '')}</a
						>
					</li>
				{/if}
			</ul>

			{#if data.viewer?.isOwner}
				<p class="owner-note">
					This is your profile.
					<a href="/settings">Manage plan &amp; domains</a>
				</p>
			{/if}
		</section>

		{#if data.tracks.length > 0}
			<section class="tracks" aria-labelledby="tracks-heading">
				<p class="eyebrow">Tracks</p>
				<h2 id="tracks-heading" class="sr-only">Tracks by {data.profile.name}</h2>
				<ul class="profile-track-list">
					{#each data.tracks as track (track.id)}
						<li>
							<TrackCard
								{track}
								signedIn={Boolean(data.viewer)}
								viewerName={data.viewer?.name ?? null}
								viewerImage={data.viewer?.image ?? null}
								ondeleted={() => invalidateAll()}
							/>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</main>

	{#if !data.viaTenantHost}
		<footer>
			<a class="logo display-face" href="/">SNDBNK</a>
			<p>Sound belongs with the people who make it matter.</p>
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
		align-content: center;
	}

	main {
		width: min(100%, var(--site-content-max-wide));
		margin: 0 auto;
		padding-top: clamp(1.25rem, 4vw, 2.5rem);
	}

	.profile-page.tenant-host main {
		padding-top: 0;
	}

	.logo {
		color: var(--ink);
		font-size: clamp(1.5rem, 3vw, 2rem);
		line-height: 1;
		text-decoration: none;
	}

	.hero {
		max-width: 38rem;
		animation: rise 0.7s ease both;
	}

	.eyebrow {
		margin: 0 0 1rem;
	}

	.name-block {
		position: relative;
		z-index: 0;
	}

	h1 {
		position: relative;
		margin: 0;
		font-size: clamp(3.5rem, 10vw, 6.5rem);
		line-height: 0.9;
		letter-spacing: -0.03em;
	}

	.identity {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-top: 1.15rem;
	}

	.identity-copy {
		min-width: 0;
	}

	.handle {
		margin: 0;
		color: var(--muted);
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.location {
		display: flex;
		gap: 0.3rem;
		align-items: center;
		margin: 0.35rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.bio {
		max-width: 34rem;
		margin: 1.35rem 0 0;
		font-size: 1rem;
		line-height: 1.6;
		white-space: pre-line;
		animation: rise 0.8s ease 0.06s both;
	}

	.link-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1.5rem 0 0;
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
		margin: 1.5rem 0 0;
		color: var(--muted);
		font-size: 1.05rem;
		line-height: 1.55;
		animation: rise 0.8s ease 0.08s both;
	}

	.url-list {
		display: grid;
		gap: 0.65rem;
		margin: 2rem 0 0;
		padding: 0;
		list-style: none;
		animation: rise 0.85s ease 0.16s both;
	}

	.url-list li {
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.75rem 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.url-list li:last-child {
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.url-label {
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.url-list a {
		color: var(--ink);
		font-weight: 700;
		word-break: break-all;
		text-underline-offset: 0.2rem;
	}

	.owner-note {
		margin: 1.75rem 0 0;
		font-size: 0.9rem;
	}

	.owner-note a {
		color: var(--ink);
		font-weight: 800;
	}

	.tracks {
		margin-top: clamp(2.5rem, 7vw, 4rem);
		padding-top: clamp(1.5rem, 4vw, 2rem);
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.85s ease 0.2s both;
	}

	.tracks > .eyebrow {
		margin: 0 0 1rem;
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

	.signal {
		position: absolute;
		z-index: -1;
		inset: -26% -10%;
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

	footer {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 2rem;
		align-items: end;
		justify-content: space-between;
		margin-top: clamp(3rem, 10vw, 6rem);
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		color: var(--muted);
		font-size: 0.8rem;
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

	@media (max-width: 620px) {
		.url-list li {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}

		.link-url {
			display: none;
		}
	}
</style>
