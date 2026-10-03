<script>
	import { relativeTime } from '#lib/relative-time.js';

	/**
	 * @typedef {{
	 *   domainActive: boolean,
	 *   domain: string | null,
	 *   days: number,
	 *   pageLoads: number,
	 *   plays: number,
	 *   series: { day: string, label: string, pageLoads: number, plays: number }[],
	 *   topPages: { path: string, label: string, views: number }[],
	 *   topTracks: { title: string, artist: string | null, href: string | null, plays: number }[],
	 *   topReferrers: { host: string, views: number }[],
	 *   listeners: {
	 *     username: string,
	 *     trackTitle: string,
	 *     href: string | null,
	 *     playCount: number,
	 *     lastPlayedAt: number
	 *   }[]
	 * }} Audience
	 */

	/** @type {{ audience: Audience | null }} */
	let { audience } = $props();

	const countFormat = new Intl.NumberFormat('en');

	const peak = $derived(
		Math.max(1, ...(audience?.series ?? []).flatMap((point) => [point.pageLoads, point.plays]))
	);
	const quiet = $derived(
		Boolean(audience?.domainActive) && audience?.pageLoads === 0 && audience?.plays === 0
	);
	const chartLabel = $derived.by(() => {
		if (!audience?.domainActive) return '';
		const loads = `${countFormat.format(audience.pageLoads)} ${audience.pageLoads === 1 ? 'page load' : 'page loads'}`;
		const plays = `${countFormat.format(audience.plays)} ${audience.plays === 1 ? 'play' : 'plays'}`;
		return `${loads} and ${plays} over ${audience.days} days`;
	});

	/**
	 * @param {number} value
	 */
	function height(value) {
		return `${Math.round((value / peak) * 100)}%`;
	}
</script>

{#if !audience}
	<p class="hint">Loading audience…</p>
{:else if !audience.domainActive}
	<header class="block-head">
		<h2>Audience</h2>
		<p>Counts start once your custom domain is live.</p>
	</header>
	<p class="lead">
		{#if audience.domain}
			<code>{audience.domain}</code> is not active yet. Finish connecting it on the
			<a href="/settings?tab=domain">Domain tab</a>.
		{:else}
			Connect a domain on the <a href="/settings?tab=domain">Domain tab</a>. After it is active,
			this page shows page loads, where they came from, and plays on that hostname.
		{/if}
	</p>
{:else}
	<header class="block-head">
		<div class="head-row">
			<div>
				<h2>Audience</h2>
				<p>
					Page loads and plays on <code>{audience.domain}</code>. These are not unique people.
				</p>
			</div>
		</div>
	</header>

	<nav class="ranges" aria-label="Date range">
		{#each [7, 28, 90] as option (option)}
			<a
				href="/settings?tab=audience&range={option}"
				data-sveltekit-replacestate
				aria-current={audience.days === option ? 'true' : undefined}
			>
				{option} days
			</a>
		{/each}
	</nav>

	<div class="totals">
		<p>
			<strong>{countFormat.format(audience.pageLoads)}</strong>
			<span>{audience.pageLoads === 1 ? 'page load' : 'page loads'}</span>
		</p>
		<p>
			<strong>{countFormat.format(audience.plays)}</strong>
			<span>{audience.plays === 1 ? 'play on this domain' : 'plays on this domain'}</span>
		</p>
	</div>

	<div class="chart" role="img" aria-label={chartLabel}>
		{#each audience.series as point (point.day)}
			<div class="col" title="{point.label}: {point.pageLoads} page loads, {point.plays} plays">
				<span class="bar views" style:height={height(point.pageLoads)}></span>
				<span class="bar plays" style:height={height(point.plays)}></span>
			</div>
		{/each}
	</div>
	<div class="legend">
		<span><i class="swatch views" aria-hidden="true"></i> Page loads</span>
		<span><i class="swatch plays" aria-hidden="true"></i> Plays</span>
	</div>
	{#if audience.days === 7}
		<div class="axis">
			{#each audience.series as point (point.day)}
				<span>{point.label}</span>
			{/each}
		</div>
	{:else if audience.series.length > 0}
		<div class="axis ends">
			<span>{audience.series[0].label}</span>
			<span>{audience.series[audience.series.length - 1].label}</span>
		</div>
	{/if}
	{#if quiet}
		<p class="hint">No page loads or plays in this range yet.</p>
	{/if}

	<div class="tops">
		<section aria-labelledby="audience-pages">
			<h3 id="audience-pages">Top pages</h3>
			{#if audience.topPages.length === 0}
				<p class="hint">None yet.</p>
			{:else}
				<ol>
					{#each audience.topPages as page (page.path)}
						<li>
							<span class="name">{page.label}</span>
							<span class="num">{countFormat.format(page.views)}</span>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
		<section aria-labelledby="audience-referrers">
			<h3 id="audience-referrers">Top referrers</h3>
			{#if audience.topReferrers.length === 0}
				<p class="hint">None yet.</p>
			{:else}
				<ol>
					{#each audience.topReferrers as referrer (referrer.host)}
						<li>
							<span class="name">{referrer.host}</span>
							<span class="num">{countFormat.format(referrer.views)}</span>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
		<section aria-labelledby="audience-tracks">
			<h3 id="audience-tracks">Top tracks</h3>
			{#if audience.topTracks.length === 0}
				<p class="hint">None yet.</p>
			{:else}
				<ol>
					{#each audience.topTracks as track, index (`${track.title}:${index}`)}
						<li>
							<span class="name">
								{#if track.href}
									<a href={track.href}>{track.title}</a>
								{:else}
									{track.title}
								{/if}
								{#if track.artist}
									<small>{track.artist}</small>
								{/if}
							</span>
							<span class="num">{countFormat.format(track.plays)}</span>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>

	<section class="listeners" aria-labelledby="audience-listeners">
		<h3 id="audience-listeners">Signed-in listeners</h3>
		<p class="hint">
			Accounts that played during this range. The number is every counted play of that track on your
			domain, not only this range.
		</p>
		{#if audience.listeners.length === 0}
			<p class="hint">No signed-in listeners in this range.</p>
		{:else}
			<ul>
				{#each audience.listeners as listener (`${listener.username}:${listener.trackTitle}:${listener.lastPlayedAt}`)}
					<li>
						<span class="name">
							@{listener.username}
							{#if listener.href}
								<a href={listener.href}>{listener.trackTitle}</a>
							{:else}
								{listener.trackTitle}
							{/if}
						</span>
						<span class="when">
							<span title="Counted plays of this track on your domain">
								{listener.playCount}
								{listener.playCount === 1 ? 'play' : 'plays'}
							</span>
							{relativeTime(listener.lastPlayedAt)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<ul class="notes">
		<li>
			A page load is one browser document load, or a later page opened on your site. Refreshes
			count.
		</li>
		<li>
			A play is counted once per listening session, after the same listening threshold as the public
			play count.
		</li>
		<li>
			Days are UTC. Visits while you are signed in as the site owner, and known crawlers, are left
			out.
		</li>
	</ul>
{/if}

<style>
	.block-head h2 {
		margin: 0.25rem 0 0.35rem;
		font-family: var(--font-editorial);
		font-size: clamp(1.75rem, 4.5vw, 2.35rem);
		font-weight: 400;
		letter-spacing: -0.03em;
	}

	.block-head p,
	.lead {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
	}

	.lead {
		margin-top: 1rem;
	}

	code {
		color: var(--ink);
		font-size: 0.92em;
	}

	a {
		color: inherit;
	}

	.ranges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}

	.ranges a {
		padding: 0.35rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
		border-radius: 0.125rem;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.ranges a[aria-current='true'] {
		border-color: var(--ink);
		color: var(--on-accent);
		background: var(--accent);
	}

	.totals {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem 2.5rem;
		margin-top: 1.5rem;
	}

	.totals p {
		display: grid;
		gap: 0.15rem;
		margin: 0;
	}

	.totals strong {
		font-family: var(--font-editorial);
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 400;
		letter-spacing: -0.03em;
		line-height: 1;
	}

	.totals span,
	.hint,
	.notes {
		color: var(--muted);
		line-height: 1.4;
	}

	.hint {
		margin: 0.75rem 0 0;
	}

	.chart {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 8.5rem;
		margin-top: 1.5rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
	}

	.col {
		display: flex;
		flex: 1 1 0;
		align-items: flex-end;
		justify-content: center;
		gap: 1px;
		height: 100%;
		min-width: 0;
	}

	.bar {
		width: 42%;
		min-height: 0;
	}

	.bar.views,
	.swatch.views {
		background: color-mix(in srgb, var(--ink) 38%, transparent);
	}

	.bar.plays,
	.swatch.plays {
		background: var(--accent);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem 1.25rem;
		align-items: center;
		margin-top: 0.55rem;
		color: var(--muted);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.legend > span {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
	}

	.swatch {
		display: inline-block;
		width: 0.7rem;
		height: 0.7rem;
	}

	.axis {
		display: flex;
		justify-content: space-between;
		gap: 0.25rem;
		margin-top: 0.35rem;
		color: var(--muted);
		font-size: 0.68rem;
	}

	.axis:not(.ends) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
	}

	.axis span {
		overflow: hidden;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tops {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.5rem;
		margin-top: 2rem;
	}

	h3 {
		margin: 0 0 0.65rem;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	ol,
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	ol li,
	.listeners li {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.45rem 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
	}

	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name small {
		display: block;
		color: var(--muted);
		font-size: 0.85em;
	}

	.num,
	.when {
		flex: none;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.listeners {
		margin-top: 2rem;
	}

	.listeners .name {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		white-space: normal;
	}

	.when {
		display: grid;
		justify-items: end;
		gap: 0.1rem;
		font-size: 0.85rem;
	}

	.notes {
		margin: 1.75rem 0 0;
		padding: 0;
		list-style: disc;
		padding-left: 1.1rem;
	}

	.notes li + li {
		margin-top: 0.35rem;
	}

	@media (max-width: 800px) {
		.tops {
			grid-template-columns: 1fr;
		}
	}
</style>
