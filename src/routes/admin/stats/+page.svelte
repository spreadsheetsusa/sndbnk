<script>
	import { invalidateAll } from '$app/navigation';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { formatBytes } from '#lib/media/audio-metadata.js';
	import { TRACK_MEDIA_TYPE_OPTIONS } from '#lib/media/track-media-type.js';

	let { data } = $props();

	const countFormat = new Intl.NumberFormat('en-US');
	const dayFormat = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
	const timeFormat = new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	});

	const MIME_LABELS = {
		'audio/mpeg': 'MP3',
		'audio/mp3': 'MP3',
		'audio/wav': 'WAV',
		'audio/x-wav': 'WAV',
		'audio/wave': 'WAV',
		'audio/flac': 'FLAC',
		'audio/x-flac': 'FLAC',
		'audio/mp4': 'M4A',
		'audio/x-m4a': 'M4A',
		'audio/aac': 'AAC',
		'audio/ogg': 'OGG',
		'audio/aiff': 'AIFF',
		'audio/x-aiff': 'AIFF'
	};

	let refreshing = $state(false);

	const countedLabel = $derived(timeFormat.format(data.countedAt));
	const mediaTotal = $derived(
		data.media.masters +
			data.media.playback +
			data.media.covers +
			data.media.waveforms +
			data.media.images +
			data.media.videos
	);
	const mediaSegments = $derived(
		[
			{ id: 'masters', label: 'Masters', tone: 'masters', bytes: data.media.masters },
			{ id: 'playback', label: 'Playback', tone: 'playback', bytes: data.media.playback },
			{ id: 'covers', label: 'Covers', tone: 'covers', bytes: data.media.covers },
			{ id: 'waveforms', label: 'Waveforms', tone: 'waveforms', bytes: data.media.waveforms },
			{ id: 'images', label: 'Site images', tone: 'images', bytes: data.media.images },
			{ id: 'videos', label: 'Site video', tone: 'videos', bytes: data.media.videos }
		].map((segment) => ({ ...segment, weight: segment.bytes }))
	);
	const visibleMedia = $derived(mediaSegments.filter((segment) => segment.bytes > 0));
	const signupMax = $derived(Math.max(1, ...data.users.signups.map((day) => day.count)));
	const signupTotal = $derived(data.users.signups.reduce((sum, day) => sum + day.count, 0));
	const heavyMax = $derived(
		Math.max(1, ...data.heavy.map((row) => row.hostedBytes + row.sshBytes), 1)
	);
	const planAccounts = $derived(data.plans.reduce((sum, row) => sum + row.accounts, 0));

	const notes = $derived.by(() => {
		/** @type {string[]} */
		const lines = [];
		const users = data.users.total;
		if (users === 0 && data.catalog.tracks === 0) {
			lines.push('The bank is empty. Accounts and uploads will show up here.');
		}
		if (data.catalog.tracks > 0) {
			lines.push(
				`Average master is ${formatBytes(data.media.masters / data.catalog.tracks)} across ${formatCount(data.catalog.tracks)} tracks.`
			);
		}
		const topPlan = data.plans.toSorted((a, b) => b.accounts - a.accounts)[0];
		if (topPlan && topPlan.accounts > 0 && users > 0) {
			lines.push(
				`${topPlan.label} holds ${share(topPlan.accounts, users)} of accounts (${formatCount(topPlan.accounts)}).`
			);
		}
		if (data.catalog.drafts > 0) {
			lines.push(`${counted(data.catalog.drafts, 'track is', 'tracks are')} still unpublished.`);
		}
		if (data.catalog.privateTracks > 0) {
			lines.push(
				`${counted(data.catalog.privateTracks, 'published track is a private link', 'published tracks are private links')}.`
			);
		}
		if (data.catalog.playbackQueued > 0) {
			lines.push(
				`${counted(data.catalog.playbackQueued, 'playback encode is', 'playback encodes are')} queued.`
			);
		}
		if (data.catalog.playbackFailed > 0) {
			lines.push(
				`${counted(data.catalog.playbackFailed, 'playback encode', 'playback encodes')} failed.`
			);
		}
		if (data.catalog.missingDuration > 0) {
			lines.push(
				`${counted(data.catalog.missingDuration, 'track has', 'tracks have')} no duration.`
			);
		}
		if (data.users.unverified > 0) {
			lines.push(
				`${counted(data.users.unverified, 'account has', 'accounts have')} an unverified email.`
			);
		}
		if (data.users.banned > 0) {
			lines.push(`${counted(data.users.banned, 'account is', 'accounts are')} banned.`);
		}
		if (data.users.withoutProfile > 0) {
			lines.push(
				`${counted(data.users.withoutProfile, 'account has', 'accounts have')} no profile yet.`
			);
		}
		const logical = data.database.liveBytes + data.database.freeBytes;
		if (logical > 8 * 1024 * 1024 && data.database.freeBytes / logical > 0.2) {
			lines.push(
				`${share(data.database.freeBytes, logical)} of the database is empty pages (${formatBytes(data.database.freeBytes)}). A backup and VACUUM would shrink the file.`
			);
		}
		if (
			data.database.walBytes > 8 * 1024 * 1024 &&
			data.database.walBytes > data.database.fileBytes * 4
		) {
			lines.push(
				`The write-ahead log is ${formatBytes(data.database.walBytes)} and will fold into the database file on the next checkpoint.`
			);
		}
		const ssh = data.locations.find((row) => row.id === 'ssh');
		if (ssh && ssh.bytes > 0) {
			lines.push(
				`${formatBytes(ssh.bytes)} of audio lives on creator servers, outside this machine and the platform bucket.`
			);
		}
		return lines;
	});

	/**
	 * @param {number} value
	 */
	function formatCount(value) {
		return countFormat.format(value);
	}

	/**
	 * @param {number} value
	 * @param {string} singular
	 * @param {string} plural
	 */
	function counted(value, singular, plural) {
		return `${formatCount(value)} ${value === 1 ? singular : plural}`;
	}

	/**
	 * @param {number} ms
	 */
	function formatHours(ms) {
		const hours = ms / 3_600_000;
		if (hours < 1) return `${formatCount(Math.round(ms / 60_000))} min`;
		if (hours < 10) return `${hours.toFixed(1)} hr`;
		return `${formatCount(Math.round(hours))} hr`;
	}

	/**
	 * @param {number} part
	 * @param {number} total
	 */
	function share(part, total) {
		if (total <= 0 || part <= 0) return '0%';
		const pct = (part / total) * 100;
		if (pct < 1) return '<1%';
		return `${Math.round(pct)}%`;
	}

	/**
	 * @param {string} id
	 */
	function typeLabel(id) {
		return TRACK_MEDIA_TYPE_OPTIONS.find((option) => option.value === id)?.plural ?? id;
	}

	/**
	 * @param {string} mime
	 */
	function mimeLabel(mime) {
		return MIME_LABELS[/** @type {keyof typeof MIME_LABELS} */ (mime)] ?? mime;
	}

	/**
	 * @param {string} day
	 */
	function dayLabel(day) {
		return dayFormat.format(new Date(`${day}T00:00:00Z`));
	}

	/**
	 * @param {{
	 *   capacityBytes: number,
	 *   usedBytes: number,
	 *   availableBytes: number,
	 *   mediaBytes: number,
	 *   databaseBytes: number
	 * }} volume
	 */
	function diskModel(volume) {
		const capacity = volume.capacityBytes || volume.usedBytes + volume.availableBytes;
		const known = volume.databaseBytes + volume.mediaBytes;
		const capped = known > volume.usedBytes && known > 0;
		let database = volume.databaseBytes;
		let media = volume.mediaBytes;
		if (capped) {
			const room = Math.max(volume.usedBytes, 0);
			database = known === 0 ? 0 : Math.round((volume.databaseBytes / known) * room);
			media = Math.max(0, room - database);
		}
		const other = Math.max(0, volume.usedBytes - database - media);
		const available = Math.max(0, capacity - database - media - other);
		return {
			capped,
			used: volume.usedBytes,
			capacity,
			available: volume.availableBytes,
			segments: [
				{
					id: 'database',
					label: 'Database',
					tone: 'database',
					bytes: volume.databaseBytes,
					weight: database
				},
				{
					id: 'local',
					label: 'Local media',
					tone: 'local',
					bytes: volume.mediaBytes,
					weight: media
				},
				{ id: 'other', label: 'Other', tone: 'other', bytes: other, weight: other },
				{
					id: 'free',
					label: 'Available',
					tone: 'free',
					bytes: volume.availableBytes,
					weight: available
				}
			]
		};
	}

	/**
	 * @param {{ label: string, bytes: number }[]} segments
	 * @param {number} total
	 */
	function barLabel(segments, total) {
		if (total <= 0) return 'No files in this bar';
		return segments
			.filter((segment) => segment.bytes > 0)
			.map((segment) => `${segment.label} ${formatBytes(segment.bytes)}`)
			.join(', ');
	}

	async function refresh() {
		refreshing = true;
		try {
			await invalidateAll();
		} finally {
			refreshing = false;
		}
	}
</script>

<svelte:head>
	<title>System stats | SNDBNK</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="stats-page">
	<SiteHeader />

	<main>
		<header class="page-head">
			<div class="page-head-copy">
				<p class="eyebrow eyebrow-chip accent-text">Admin</p>
				<h1 class="display-face">System</h1>
			</div>
			<div class="page-head-actions">
				<p class="counted">Counted {countedLabel}</p>
				<a class="text-link" href="/admin">Plans and accounts</a>
				<button type="button" class="pressable ghost small" disabled={refreshing} onclick={refresh}>
					{refreshing ? 'Counting…' : 'Refresh'}
				</button>
			</div>
		</header>
		<p class="intro">Media files, disk, database, and who is using the bank.</p>

		<section class="panel" aria-labelledby="media-heading">
			<div class="panel-head">
				<div>
					<h2 id="media-heading">Media files</h2>
					<p>
						Sizes recorded when each file was saved. Waveforms are the peak files kept beside the
						audio.
					</p>
				</div>
				<p class="panel-total lcd-face">{formatBytes(mediaTotal)}</p>
			</div>

			<div class="ios-bar" aria-hidden="true">
				{#each visibleMedia as segment (segment.id)}
					<span class="seg" data-tone={segment.tone} style:flex-grow={segment.weight}></span>
				{/each}
			</div>
			{#if visibleMedia.length === 0}
				<p class="empty">No media files yet.</p>
			{:else}
				<ul class="legend" aria-label={barLabel(visibleMedia, mediaTotal)}>
					{#each visibleMedia as segment (segment.id)}
						<li>
							<span class="swatch" data-tone={segment.tone} aria-hidden="true"></span>
							<span class="legend-copy">
								<span class="legend-label">{segment.label}</span>
								<span class="legend-value">
									{formatBytes(segment.bytes)} · {share(segment.bytes, mediaTotal)}
								</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}

			<ul class="locations">
				{#each data.locations as location (location.id)}
					<li>
						<span class="location-label">{location.label}</span>
						<span class="location-value lcd-face">{formatBytes(location.bytes)}</span>
						<span class="location-meta">
							{#if location.id === 's3' && !location.configured && location.tracks === 0 && location.bytes === 0}
								Off
							{:else if location.id === 's3' && !location.configured}
								Off · {formatCount(location.tracks)}
								{location.tracks === 1 ? 'track' : 'tracks'}
							{:else}
								{formatCount(location.tracks)}
								{location.tracks === 1 ? 'track' : 'tracks'}
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		</section>

		{#if data.volumes.server}
			{@const disk = diskModel(data.volumes.server)}
			<section class="panel" aria-labelledby="disk-heading">
				<div class="panel-head">
					<div>
						<h2 id="disk-heading">
							{data.volumes.media ? 'Database volume' : 'This server'}
						</h2>
						<p>
							{formatBytes(disk.used)} of {formatBytes(disk.capacity)} used.
							{#if data.platformBucket}
								Local media is the catalog total for files still on the local adapter. Bucket files
								sit outside this disk.
							{:else}
								Local media is the catalog total for the local adapter, plus site files while the
								bucket is off.
							{/if}
						</p>
					</div>
					<p class="panel-total lcd-face">{formatBytes(disk.available)} free</p>
				</div>
				<div class="ios-bar" aria-hidden="true">
					{#each disk.segments as segment (segment.id)}
						{#if segment.weight > 0}
							<span class="seg" data-tone={segment.tone} style:flex-grow={segment.weight}></span>
						{/if}
					{/each}
				</div>
				<ul class="legend" aria-label={barLabel(disk.segments, disk.capacity)}>
					{#each disk.segments as segment (segment.id)}
						<li>
							<span class="swatch" data-tone={segment.tone} aria-hidden="true"></span>
							<span class="legend-copy">
								<span class="legend-label">{segment.label}</span>
								<span class="legend-value">
									{formatBytes(segment.bytes)} · {share(segment.bytes, disk.capacity)}
								</span>
							</span>
						</li>
					{/each}
				</ul>
				<p class="caption">
					Database on disk is {formatBytes(
						data.database.fileBytes + data.database.walBytes + data.database.shmBytes
					)}
					({formatBytes(data.database.liveBytes)} live{#if data.database.walBytes > 0}, write-ahead
						log
						{formatBytes(data.database.walBytes)}{/if}). Avatars are part of Other.
					{#if disk.capped}
						Catalogued files are larger than the used reading, so the bar fits them into used space.
					{/if}
				</p>
			</section>
		{/if}

		{#if data.volumes.media}
			{@const disk = diskModel(data.volumes.media)}
			<section class="panel" aria-labelledby="media-disk-heading">
				<div class="panel-head">
					<div>
						<h2 id="media-disk-heading">Media volume</h2>
						<p>{formatBytes(disk.used)} of {formatBytes(disk.capacity)} used on the upload disk.</p>
					</div>
					<p class="panel-total lcd-face">{formatBytes(disk.available)} free</p>
				</div>
				<div class="ios-bar" aria-hidden="true">
					{#each disk.segments as segment (segment.id)}
						{#if segment.weight > 0}
							<span class="seg" data-tone={segment.tone} style:flex-grow={segment.weight}></span>
						{/if}
					{/each}
				</div>
				<ul class="legend" aria-label={barLabel(disk.segments, disk.capacity)}>
					{#each disk.segments as segment (segment.id)}
						<li>
							<span class="swatch" data-tone={segment.tone} aria-hidden="true"></span>
							<span class="legend-copy">
								<span class="legend-label">{segment.label}</span>
								<span class="legend-value">{formatBytes(segment.bytes)}</span>
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="metrics" aria-label="Totals">
			<article class="metric">
				<h2>Users</h2>
				<p class="metric-value lcd-face">{formatCount(data.users.total)}</p>
				<p class="metric-sub">
					{counted(data.users.admins, 'admin', 'admins')} · {counted(
						data.users.sessions,
						'live session',
						'live sessions'
					)}
				</p>
			</article>
			<article class="metric">
				<h2>New accounts</h2>
				<p class="metric-value lcd-face">{formatCount(data.users.signups7)}</p>
				<p class="metric-sub">{formatCount(data.users.signups30)} in the last 30 days</p>
			</article>
			<article class="metric">
				<h2>Tracks</h2>
				<p class="metric-value lcd-face">{formatCount(data.catalog.tracks)}</p>
				<p class="metric-sub">
					{formatCount(data.catalog.published)} published · {formatCount(data.catalog.drafts)} drafts
				</p>
			</article>
			<article class="metric">
				<h2>Catalog</h2>
				<p class="metric-value lcd-face">{formatHours(data.catalog.durationMs)}</p>
				<p class="metric-sub">{formatCount(data.catalog.plays)} plays</p>
			</article>
			<article class="metric">
				<h2>Database</h2>
				<p class="metric-value lcd-face">
					{formatBytes(data.database.fileBytes + data.database.walBytes + data.database.shmBytes)}
				</p>
				<p class="metric-sub">{formatBytes(data.database.liveBytes)} live data</p>
			</article>
			<article class="metric">
				<h2>Sites</h2>
				<p class="metric-value lcd-face">{formatCount(data.sites.total)}</p>
				<p class="metric-sub">
					{formatCount(data.sites.activeDomains)} custom domains · {formatCount(data.sites.pages)} pages
				</p>
			</article>
			<article class="metric">
				<h2>Listening</h2>
				<p class="metric-value lcd-face">{formatCount(data.catalog.likes)}</p>
				<p class="metric-sub">
					{formatCount(data.catalog.comments)} comments · {formatCount(data.catalog.downloads)} downloads
				</p>
			</article>
			<article class="metric">
				<h2>Collections</h2>
				<p class="metric-value lcd-face">{formatCount(data.catalog.playlists)}</p>
				<p class="metric-sub">
					{formatCount(data.catalog.follows)} follows · {formatCount(data.catalog.reposts)} reposts
				</p>
			</article>
		</section>

		<section class="panel spark-panel" aria-labelledby="signup-heading">
			<div class="panel-head">
				<div>
					<h2 id="signup-heading">Signups</h2>
					<p>Last 14 UTC days. {formatCount(signupTotal)} new accounts in that window.</p>
				</div>
			</div>
			<div class="spark" aria-hidden="true">
				{#each data.users.signups as day (day.day)}
					<span
						class="spark-bar"
						style:height={day.count === 0 ? '2px' : `${(day.count / signupMax) * 100}%`}
						title="{dayLabel(day.day)}: {formatCount(day.count)}"
					></span>
				{/each}
			</div>
			<div class="spark-scale">
				<span>{dayLabel(data.users.signups[0].day)}</span>
				<span>{dayLabel(data.users.signups[data.users.signups.length - 1].day)}</span>
			</div>
			<ul class="visually-hidden">
				{#each data.users.signups as day (day.day)}
					<li>{dayLabel(day.day)}: {formatCount(day.count)} signups</li>
				{/each}
			</ul>
		</section>

		<div class="split">
			<section class="panel" aria-labelledby="type-heading">
				<h2 id="type-heading">By type</h2>
				{#if data.media.byType.length === 0}
					<p class="empty">No tracks yet.</p>
				{:else}
					<div class="table-wrap">
						<table class="data-table">
							<thead>
								<tr>
									<th scope="col">Type</th>
									<th scope="col" class="num">Tracks</th>
									<th scope="col" class="num">Time</th>
									<th scope="col" class="num">Masters</th>
								</tr>
							</thead>
							<tbody>
								{#each data.media.byType as row (row.id)}
									<tr>
										<th scope="row">{typeLabel(row.id)}</th>
										<td class="num">{formatCount(row.tracks)}</td>
										<td class="num">{formatHours(row.durationMs)}</td>
										<td class="num">{formatBytes(row.masters)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>

			<section class="panel" aria-labelledby="mime-heading">
				<h2 id="mime-heading">By format</h2>
				{#if data.media.byMime.length === 0}
					<p class="empty">No audio files yet.</p>
				{:else}
					<div class="table-wrap">
						<table class="data-table">
							<thead>
								<tr>
									<th scope="col">Format</th>
									<th scope="col" class="num">Files</th>
									<th scope="col" class="num">Masters</th>
								</tr>
							</thead>
							<tbody>
								{#each data.media.byMime as row (row.mime)}
									<tr>
										<th scope="row">{mimeLabel(row.mime)}</th>
										<td class="num">{formatCount(row.files)}</td>
										<td class="num">{formatBytes(row.bytes)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>
		</div>

		<section class="panel" aria-labelledby="plan-heading">
			<h2 id="plan-heading">Plans</h2>
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th scope="col">Plan</th>
							<th scope="col" class="num">Accounts</th>
							<th scope="col">Share</th>
							<th scope="col" class="num">Tracks</th>
							<th scope="col" class="num">Hosted files</th>
						</tr>
					</thead>
					<tbody>
						{#each data.plans as row (row.id)}
							<tr>
								<th scope="row">{row.label}</th>
								<td class="num">{formatCount(row.accounts)}</td>
								<td>
									<span class="mini-meter" aria-hidden="true">
										<span
											class="mini-fill"
											style:width="{planAccounts ? (row.accounts / planAccounts) * 100 : 0}%"
										></span>
									</span>
									<span class="visually-hidden">{share(row.accounts, planAccounts)}</span>
								</td>
								<td class="num">{formatCount(row.tracks)}</td>
								<td class="num">{formatBytes(row.hostedBytes)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section class="panel" aria-labelledby="heavy-heading">
			<div class="panel-head">
				<div>
					<h2 id="heavy-heading">Largest accounts</h2>
					<p>
						Hosted files are on this server or the platform bucket. Creator-server audio is
						separate.
					</p>
				</div>
			</div>
			{#if data.heavy.length === 0}
				<p class="empty">No tracks yet.</p>
			{:else}
				<div class="table-wrap">
					<table class="data-table">
						<thead>
							<tr>
								<th scope="col">Account</th>
								<th scope="col">Plan</th>
								<th scope="col" class="num">Tracks</th>
								<th scope="col" class="num">Hosted</th>
								<th scope="col" class="num">Creator server</th>
							</tr>
						</thead>
						<tbody>
							{#each data.heavy as row (row.username)}
								<tr>
									<th scope="row">
										<a class="account-link" href="/users/{row.username}">@{row.username}</a>
										<span class="account-name">{row.name}</span>
									</th>
									<td>{row.planLabel}</td>
									<td class="num">{formatCount(row.tracks)}</td>
									<td class="num">
										{formatBytes(row.hostedBytes)}
										<span class="mini-meter" aria-hidden="true">
											<span
												class="mini-fill"
												style:width="{((row.hostedBytes + row.sshBytes) / heavyMax) * 100}%"
											></span>
										</span>
									</td>
									<td class="num">{formatBytes(row.sshBytes)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		{#if notes.length > 0}
			<section class="panel" aria-labelledby="notes-heading">
				<h2 id="notes-heading">Notes</h2>
				<ul class="notes">
					{#each notes as note, index (index)}
						<li>{note}</li>
					{/each}
				</ul>
			</section>
		{/if}
	</main>
</div>

<style>
	.stats-page {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 5rem;
	}

	.page-head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.5rem;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 0.4rem;
	}

	.page-head .eyebrow {
		margin: 0 0 0.45rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.8rem, 3.4vw, 2.6rem);
		line-height: 0.95;
	}

	.page-head-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 0.9rem;
		align-items: center;
	}

	.counted,
	.intro,
	.caption,
	.panel-head p,
	.metric-sub,
	.location-meta,
	.empty {
		color: var(--muted);
	}

	.counted,
	.intro,
	.caption {
		margin: 0;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.intro {
		margin: 0 0 1.25rem;
	}

	.text-link {
		color: var(--ink);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-decoration: none;
		text-transform: uppercase;
	}

	.text-link:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	.pressable {
		padding: 0.45rem 0.7rem;
		border: 1px solid var(--hard-border);
		border-radius: 0.125rem;
		color: var(--ink);
		background: transparent;
		box-shadow: 3px 3px 0 var(--hard-shadow);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.pressable:disabled {
		cursor: progress;
		opacity: 0.6;
	}

	.panel {
		margin-top: 1rem;
		padding: 1rem 1.05rem 1.1rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 4px 4px 0 var(--hard-shadow);
	}

	.panel-head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.5rem;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 0.9rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: 1.25rem;
		font-weight: 500;
		letter-spacing: -0.03em;
	}

	.panel-head p {
		max-width: 40rem;
		margin: 0.3rem 0 0;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.panel-total {
		margin: 0;
		font-size: 1.7rem;
		font-weight: 400;
		line-height: 1;
	}

	.ios-bar {
		display: flex;
		height: 1.65rem;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 8%, var(--paper));
	}

	.seg {
		flex-basis: 0;
		min-width: 3px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem 1.15rem;
		margin: 0.85rem 0 0;
		padding: 0;
		list-style: none;
	}

	.legend li {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		min-width: 8.5rem;
	}

	.swatch {
		flex-shrink: 0;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 0.15rem;
	}

	.legend-copy {
		display: grid;
		min-width: 0;
	}

	.legend-label {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.legend-value {
		color: var(--muted);
		font-family: var(--font-lcd), monospace;
		font-size: 0.95rem;
		font-weight: 400;
	}

	.seg[data-tone='masters'],
	.swatch[data-tone='masters'],
	.seg[data-tone='local'],
	.swatch[data-tone='local'] {
		background: var(--accent);
	}

	.seg[data-tone='playback'],
	.swatch[data-tone='playback'] {
		background: var(--chroma-cyan);
	}

	.seg[data-tone='covers'],
	.swatch[data-tone='covers'] {
		background: var(--chroma-red);
	}

	.seg[data-tone='waveforms'],
	.swatch[data-tone='waveforms'] {
		background: color-mix(in srgb, var(--accent) 45%, var(--ink));
	}

	.seg[data-tone='images'],
	.swatch[data-tone='images'] {
		background: color-mix(in srgb, var(--chroma-cyan) 58%, var(--ink));
	}

	.seg[data-tone='videos'],
	.swatch[data-tone='videos'] {
		background: color-mix(in srgb, var(--chroma-red) 50%, var(--ink));
	}

	.seg[data-tone='database'],
	.swatch[data-tone='database'] {
		background: var(--ink);
	}

	.seg[data-tone='other'],
	.swatch[data-tone='other'] {
		background: color-mix(in srgb, var(--ink) 42%, var(--paper));
	}

	.seg[data-tone='free'],
	.swatch[data-tone='free'] {
		background: color-mix(in srgb, var(--ink) 14%, var(--paper));
	}

	.locations {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 1rem 0 0;
		padding: 0.85rem 0 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
		list-style: none;
	}

	.location-label,
	.metric h2 {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-body);
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.location-value {
		display: block;
		margin-top: 0.2rem;
		font-size: 1.25rem;
		font-weight: 400;
	}

	.location-meta {
		display: block;
		margin-top: 0.1rem;
		font-size: 0.75rem;
	}

	.caption {
		margin-top: 0.85rem;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin-top: 1rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 4px 4px 0 var(--hard-shadow);
	}

	.metric {
		min-width: 0;
		padding: 0.85rem 0.95rem 0.95rem;
		border-right: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
	}

	.metric:nth-child(4n) {
		border-right: 0;
	}

	.metric-value {
		margin: 0.35rem 0 0;
		font-size: clamp(1.6rem, 2.4vw, 2.15rem);
		font-weight: 400;
		line-height: 1;
	}

	.metric-sub {
		margin: 0.35rem 0 0;
		font-size: 0.75rem;
		line-height: 1.35;
	}

	.spark {
		display: flex;
		gap: 0.35rem;
		align-items: flex-end;
		height: 5.5rem;
	}

	.spark-bar {
		flex: 1;
		min-height: 2px;
		border-radius: 0.125rem 0.125rem 0 0;
		background: var(--accent);
	}

	.spark-scale {
		display: flex;
		justify-content: space-between;
		margin-top: 0.4rem;
		color: var(--muted);
		font-size: 0.72rem;
	}

	.split {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		gap: 1rem;
	}

	.split .panel {
		margin-top: 1rem;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		margin-top: 0.85rem;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.data-table th {
		padding: 0.45rem 0.6rem;
		border-bottom: 1px solid var(--ink);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-align: left;
		text-transform: uppercase;
	}

	.data-table td,
	.data-table tbody th {
		padding: 0.7rem 0.6rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		font-size: 0.85rem;
		font-weight: 500;
		letter-spacing: 0;
		text-align: left;
		text-transform: none;
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.data-table th.num {
		text-align: right;
	}

	.account-link {
		color: var(--ink);
		font-weight: 800;
		text-decoration: none;
	}

	.account-link:hover {
		color: var(--on-accent);
		background: var(--accent);
	}

	.account-name {
		display: block;
		margin-top: 0.15rem;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.mini-meter {
		display: block;
		height: 0.35rem;
		margin-top: 0.35rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 12%, var(--paper));
	}

	.mini-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
	}

	.notes {
		margin: 0.75rem 0 0;
		padding-left: 1.1rem;
		line-height: 1.5;
	}

	.notes li + li {
		margin-top: 0.35rem;
	}

	.empty {
		margin: 0.8rem 0 0;
		font-size: 0.88rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 960px) {
		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.metric:nth-child(4n) {
			border-right: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		}

		.metric:nth-child(2n) {
			border-right: 0;
		}

		.split,
		.locations {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.panel-total {
			font-size: 1.35rem;
		}

		.page-head-actions .counted {
			width: 100%;
		}
	}

	@media (pointer: coarse) {
		.pressable,
		.text-link {
			min-height: var(--tap-min);
			display: inline-flex;
			align-items: center;
		}
	}
</style>
