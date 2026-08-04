<script>
	import { onDestroy } from 'svelte';

	import { mediaCoverUrl } from '#lib/media/cover-url.js';

	const MAX_ATTEMPTS = 3;

	/**
	 * Resilient track cover: native lazy/async loading, short retries with
	 * cache-bust on error, then a placeholder. Optional `wash` draws the mobile
	 * card backdrop from the same resolved URL.
	 *
	 * @type {{
	 *   trackId: string,
	 *   hasCover?: boolean,
	 *   loading?: 'lazy' | 'eager',
	 *   fetchpriority?: 'high' | 'low' | 'auto',
	 *   width?: number | string,
	 *   height?: number | string,
	 *   alt?: string,
	 *   class?: string,
	 *   wash?: boolean,
	 *   wrapperClass?: string,
	 *   placeholder?: import('svelte').Snippet | false
	 * }}
	 */
	let {
		trackId,
		hasCover = false,
		loading = 'lazy',
		fetchpriority = undefined,
		width = undefined,
		height = undefined,
		alt = '',
		class: className = '',
		wash = false,
		wrapperClass = undefined,
		placeholder
	} = $props();

	/** @type {{ key: string, attempt: number, failed: boolean }} */
	let retry = $state({ key: '', attempt: 0, failed: false });
	/** @type {ReturnType<typeof setTimeout> | null} */
	let retryTimer = null;

	const loadKey = $derived(`${trackId}\0${hasCover}`);
	const attempt = $derived(retry.key === loadKey ? retry.attempt : 0);
	const failed = $derived(retry.key === loadKey ? retry.failed : false);
	const src = $derived(hasCover && !failed && trackId ? mediaCoverUrl(trackId, attempt) : null);
	const showPlaceholder = $derived(!src && placeholder !== false);
	const placeholderClass = $derived(className ? `${className} placeholder` : 'cover-placeholder');

	function handleError() {
		if (retryTimer) clearTimeout(retryTimer);
		const key = loadKey;
		const current = retry.key === key ? retry.attempt : 0;
		if (current + 1 >= MAX_ATTEMPTS) {
			retry = { key, attempt: current, failed: true };
			return;
		}
		const next = current + 1;
		const delay = 150 * 2 ** current;
		retryTimer = setTimeout(() => {
			retryTimer = null;
			retry = { key, attempt: next, failed: false };
		}, delay);
	}

	onDestroy(() => {
		if (retryTimer) clearTimeout(retryTimer);
	});
</script>

{#snippet media()}
	{#if src}
		<img
			{src}
			{alt}
			{loading}
			decoding="async"
			{fetchpriority}
			{width}
			{height}
			class={className}
			onerror={handleError}
		/>
	{:else if showPlaceholder}
		<span class={placeholderClass} aria-hidden="true">
			{#if typeof placeholder === 'function'}
				{@render placeholder()}
			{/if}
		</span>
	{/if}
{/snippet}

{#if wash && src}
	<div class="cover-art-wash" style:--cover-art-url="url({src})" aria-hidden="true"></div>
{/if}
{#if wrapperClass}
	<div class={wrapperClass}>
		{@render media()}
	</div>
{:else}
	{@render media()}
{/if}

<style>
	.cover-art-wash {
		display: none;
	}

	@media (max-width: 640px) {
		.cover-art-wash {
			display: block;
			position: absolute;
			z-index: -1;
			inset: 0;
			pointer-events: none;
			background:
				var(--cover-art-wash-scrim, none),
				var(--cover-art-url) center / cover no-repeat;
			filter: blur(14px) saturate(1.15);
			opacity: var(--track-card-wash, 0.5);
			transform: scale(1.08);
		}

		:global(.playlist-card) > .cover-art-wash {
			z-index: 0;
			filter: blur(8px);
			opacity: 0.12;
			transform: none;
			background: var(--cover-art-url) center / cover no-repeat;
		}
	}
</style>
