<script>
	import { onDestroy } from 'svelte';
	import IconAlignCenter from '@tabler/icons-svelte-runes/icons/align-center';
	import IconAlignLeft from '@tabler/icons-svelte-runes/icons/align-left';
	import IconAlignRight from '@tabler/icons-svelte-runes/icons/align-right';
	import IconX from '@tabler/icons-svelte-runes/icons/x';

	import {
		STREAM_COUNT_MAX,
		STREAM_COUNT_PRESETS,
		parseStreamQuery
	} from '#lib/builder/stream-query.js';
	import { parseGenres } from '#lib/genres.js';
	import { TRACK_MEDIA_TYPE_OPTIONS } from '#lib/media/track-media-type.js';

	/**
	 * @type {{
	 *   props: Record<string, unknown>,
	 *   items?: Array<Record<string, any>>,
	 *   onChange: (patch: Record<string, unknown>) => void
	 * }}
	 */
	let { props, items = [], onChange } = $props();

	const query = $derived(parseStreamQuery(props));
	let artistDraft = $state('');
	/** Local text so a genre can be typed without refetching the stream on each character. */
	let genreDraft = $state(/** @type {string | null} */ (null));
	let genreTimer = 0;

	onDestroy(() => clearTimeout(genreTimer));

	const genreValue = $derived(
		genreDraft ?? (typeof props.genre === 'string' ? props.genre : (query.genre ?? ''))
	);

	/**
	 * @param {string} value
	 */
	function scheduleGenre(value) {
		genreDraft = value;
		clearTimeout(genreTimer);
		genreTimer = setTimeout(() => {
			genreDraft = null;
			onChange({ genre: value });
		}, 280);
	}

	const alignments = /** @type {const} */ ([
		{ value: 'left', label: 'Align left', icon: IconAlignLeft },
		{ value: 'center', label: 'Align center', icon: IconAlignCenter },
		{ value: 'right', label: 'Align right', icon: IconAlignRight }
	]);

	const typeOptions = [
		{ value: '', label: 'All' },
		...TRACK_MEDIA_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.plural }))
	];

	const knownArtists = $derived.by(() => {
		/** @type {Set<string>} */
		const seen = new Set();
		/** @type {string[]} */
		const out = [];
		for (const item of items) {
			if (item.kind === 'playlist' || item.repostedAt) continue;
			const name = typeof item.artist === 'string' ? item.artist.trim() : '';
			if (!name) continue;
			const key = name.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(name);
			if (out.length >= 8) break;
		}
		return out;
	});

	const knownGenres = $derived.by(() => {
		/** @type {Set<string>} */
		const seen = new Set();
		/** @type {string[]} */
		const out = [];
		for (const item of items) {
			if (item.kind === 'playlist' || item.repostedAt) continue;
			for (const token of parseGenres(typeof item.genre === 'string' ? item.genre : '')) {
				const key = token.toLowerCase();
				if (seen.has(key)) continue;
				seen.add(key);
				out.push(token);
				if (out.length >= 8) break;
			}
			if (out.length >= 8) break;
		}
		return out;
	});

	const selectedGenres = $derived(parseGenres(genreValue));

	/**
	 * @param {string} token
	 */
	function genreOn(token) {
		return selectedGenres.some((genre) => genre.toLowerCase() === token.toLowerCase());
	}

	/**
	 * @param {string} token
	 */
	function toggleGenre(token) {
		clearTimeout(genreTimer);
		genreDraft = null;
		const next = genreOn(token)
			? selectedGenres.filter((genre) => genre.toLowerCase() !== token.toLowerCase())
			: [...selectedGenres, token].slice(0, 6);
		onChange({ genre: next.join(', ') });
	}

	/**
	 * @param {string} name
	 */
	function artistOn(name) {
		const key = name.trim().toLowerCase();
		return query.artists.some((artist) => artist.toLowerCase() === key);
	}

	/**
	 * @param {string} name
	 */
	function toggleArtist(name) {
		const trimmed = name.trim();
		if (!trimmed) return;
		const next = artistOn(trimmed)
			? query.artists.filter((artist) => artist.toLowerCase() !== trimmed.toLowerCase())
			: [...query.artists, trimmed];
		onChange({ artists: parseStreamQuery({ artists: next }).artists });
	}

	/** @param {KeyboardEvent} event */
	function commitArtist(event) {
		if (event.key !== 'Enter' && event.key !== ',') return;
		event.preventDefault();
		const name = artistDraft.trim().replace(/,/g, '');
		artistDraft = '';
		if (!name || artistOn(name)) return;
		toggleArtist(name);
	}

	const customCount = $derived(
		query.count != null && !STREAM_COUNT_PRESETS.includes(query.count) ? String(query.count) : ''
	);
</script>

<div class="stream-fields">
	<section class="group" aria-labelledby="stream-heading-label">
		<div class="group-label" id="stream-heading-label">Heading</div>
		<div class="heading-row">
			<input
				type="text"
				maxlength="120"
				placeholder="Optional"
				aria-labelledby="stream-heading-label"
				value={query.heading}
				oninput={(e) => onChange({ heading: e.currentTarget.value.slice(0, 120) })}
			/>
			<div class="seg" role="group" aria-label="Heading alignment">
				{#each alignments as align (align.value)}
					{@const Icon = align.icon}
					<button
						type="button"
						class="seg-btn icon"
						aria-label={align.label}
						aria-pressed={query.headingAlign === align.value}
						title={align.label}
						onclick={() => onChange({ headingAlign: align.value })}
					>
						<Icon size={15} stroke={1.75} aria-hidden="true" />
					</button>
				{/each}
			</div>
		</div>
	</section>

	<section class="group" aria-label="Stream query">
		<div class="group-label">Query</div>

		<div class="field">
			<span id="stream-count-label">Count</span>
			<div class="seg count" role="group" aria-labelledby="stream-count-label">
				<button
					type="button"
					class="seg-btn"
					aria-pressed={query.count == null}
					onclick={() => onChange({ count: null })}
				>
					All
				</button>
				{#each STREAM_COUNT_PRESETS as preset (preset)}
					<button
						type="button"
						class="seg-btn"
						aria-pressed={query.count === preset}
						onclick={() => onChange({ count: preset })}
					>
						{preset}
					</button>
				{/each}
				<label class="count-custom" data-active={customCount !== ''}>
					<span class="sr-only">Custom count</span>
					<input
						type="number"
						inputmode="numeric"
						min="1"
						max={STREAM_COUNT_MAX}
						placeholder="#"
						value={customCount}
						oninput={(e) => {
							const raw = e.currentTarget.value;
							if (raw === '') {
								if (customCount !== '') onChange({ count: null });
								return;
							}
							onChange({ count: Number(raw) });
						}}
					/>
				</label>
			</div>
		</div>

		<div class="field">
			<span id="stream-when-label">When</span>
			<div class="dates">
				<input
					type="date"
					aria-label="From"
					value={query.dateFrom ?? ''}
					oninput={(e) => onChange({ dateFrom: e.currentTarget.value })}
				/>
				<span class="dash" aria-hidden="true">–</span>
				<input
					type="date"
					aria-label="To"
					value={query.dateTo ?? ''}
					oninput={(e) => onChange({ dateTo: e.currentTarget.value })}
				/>
				{#if query.dateFrom || query.dateTo}
					<button
						type="button"
						class="icon-x"
						aria-label="Clear dates"
						onclick={() => onChange({ dateFrom: '', dateTo: '' })}
					>
						<IconX size={13} stroke={1.75} aria-hidden="true" />
					</button>
				{/if}
			</div>
		</div>

		<div class="field">
			<span id="stream-type-label">Type</span>
			<div class="seg type" role="group" aria-labelledby="stream-type-label">
				{#each typeOptions as option (option.value)}
					<button
						type="button"
						class="seg-btn"
						aria-pressed={(query.mediaType ?? '') === option.value}
						onclick={() => onChange({ mediaType: option.value })}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<label class="field">
			<span>Genre</span>
			<input
				type="text"
				maxlength="200"
				placeholder="House, Techno"
				value={genreValue}
				oninput={(e) => scheduleGenre(e.currentTarget.value.slice(0, 200))}
			/>
		</label>
		{#if knownGenres.length}
			<div class="chips" aria-label="Genres in the catalog">
				{#each knownGenres as token (token.toLowerCase())}
					<button
						type="button"
						class="suggest"
						aria-pressed={genreOn(token)}
						onclick={() => toggleGenre(token)}
					>
						{token}
					</button>
				{/each}
			</div>
		{/if}

		<div class="field">
			<span id="stream-artists-label">Artists</span>
			{#if query.artists.length}
				<ul class="chips" aria-label="Selected artists">
					{#each query.artists as artist (artist.toLowerCase())}
						<li class="chip">
							<span>{artist}</span>
							<button
								type="button"
								aria-label="Remove {artist}"
								onclick={() => toggleArtist(artist)}
							>
								<IconX size={12} stroke={1.75} aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<input
				type="text"
				placeholder="Add artist"
				aria-labelledby="stream-artists-label"
				bind:value={artistDraft}
				onkeydown={commitArtist}
			/>
		</div>
		{#if knownArtists.length}
			<div class="chips" aria-label="Artists in the catalog">
				{#each knownArtists as name (name.toLowerCase())}
					<button
						type="button"
						class="suggest"
						aria-pressed={artistOn(name)}
						onclick={() => toggleArtist(name)}
					>
						{name}
					</button>
				{/each}
			</div>
		{/if}
		<p class="hint">Published uploads. Clear the query to show the full stream.</p>
	</section>
</div>

<style>
	.stream-fields {
		display: grid;
		gap: 0.75rem;
	}

	.group {
		display: grid;
		gap: 0.45rem;
	}

	.group + .group {
		padding-top: 0.7rem;
		border-top: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.group-label,
	.field > span {
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.hint {
		margin: 0.15rem 0 0;
		color: var(--muted);
		font-size: 0.68rem;
		line-height: 1.35;
	}

	.field {
		display: grid;
		gap: 0.28rem;
	}

	.heading-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.35rem;
		align-items: center;
	}

	input {
		width: 100%;
		min-width: 0;
		padding: 0.38rem 0.45rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: 0.85rem;
		text-transform: none;
		letter-spacing: normal;
	}

	input[type='date'] {
		font-size: 0.75rem;
		color-scheme: light;
	}

	:global(html.dark) input[type='date'] {
		color-scheme: dark;
	}

	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}

	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.seg {
		display: inline-flex;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	.seg.count,
	.seg.type {
		display: grid;
		width: 100%;
	}

	.seg.count {
		grid-template-columns: 1.4fr repeat(3, 1fr) 1.3fr;
	}

	.seg.type {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.seg-btn {
		padding: 0.32rem 0.35rem;
		border: 0;
		border-right: 1px solid var(--ink);
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
	}

	.seg-btn.icon {
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		padding: 0;
	}

	.seg-btn:last-child {
		border-right: 0;
	}

	.seg.type .seg-btn {
		border-bottom: 1px solid var(--ink);
	}

	.seg.type .seg-btn:nth-child(3n) {
		border-right: 0;
	}

	.seg.type .seg-btn:nth-last-child(-n + 3) {
		border-bottom: 0;
	}

	.seg-btn[aria-pressed='true'] {
		background: var(--hud-ui);
		color: var(--on-hud-ui);
	}

	.count-custom {
		display: grid;
		min-width: 0;
	}

	.count-custom input {
		height: 100%;
		padding: 0.32rem 0.2rem;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 800;
		text-align: center;
	}

	.count-custom[data-active='true'] {
		background: var(--hud-ui);
	}

	.count-custom[data-active='true'] input {
		color: var(--on-hud-ui);
	}

	.dates {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
		gap: 0.3rem;
		align-items: center;
	}

	.dash {
		color: var(--muted);
		font-size: 0.8rem;
	}

	.icon-x {
		display: grid;
		place-items: center;
		width: 1.55rem;
		height: 1.55rem;
		padding: 0;
		border: 1px solid var(--ink);
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chip {
		display: inline-flex;
		gap: 0.1rem;
		align-items: center;
		padding: 0.05rem 0.1rem 0.05rem 0.4rem;
		border: 1px solid var(--ink);
		background: var(--hud-wash-strong);
		color: var(--ink);
		font-size: 0.75rem;
	}

	.chip button,
	.suggest {
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.chip button {
		display: grid;
		place-items: center;
		width: 1.15rem;
		height: 1.15rem;
		padding: 0;
	}

	.suggest {
		padding: 0.18rem 0.4rem;
		border: 1px solid color-mix(in srgb, var(--ink) 35%, transparent);
		color: var(--muted);
		font: inherit;
		font-size: 0.72rem;
	}

	.suggest[aria-pressed='true'] {
		border-color: var(--hud-line);
		background: var(--hud-ui);
		color: var(--on-hud-ui);
	}
</style>
