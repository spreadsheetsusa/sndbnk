<script>
	import IconPhoto from '@tabler/icons-svelte-runes/icons/photo';
	import IconVideo from '@tabler/icons-svelte-runes/icons/video';
	import { siteMediaUrl } from '#lib/site-media-url.js';

	/**
	 * @type {{
	 *   label?: string,
	 *   ratio?: string,
	 *   mediaId?: string,
	 *   kind?: string,
	 *   border?: boolean
	 * }}
	 */
	let { label = 'Image', ratio = '4 / 3', mediaId = '', kind = '', border = true } = $props();

	const src = $derived(siteMediaUrl(mediaId));
	const isVideo = $derived(kind === 'video' && Boolean(src));
	let failedSrc = $state('');
	const failed = $derived(Boolean(src) && failedSrc === src);
	// `auto` keeps the file's own proportions so a circular PNG is not cropped into the layout frame.
	const natural = $derived(ratio === 'auto');
	const framed = $derived(border !== false);
</script>

<div
	class="media-ph"
	class:filled={Boolean(src) && !failed}
	class:natural
	class:frameless={!framed}
	style:--ratio={natural ? undefined : ratio}
>
	{#if src && !failed && isVideo}
		<video
			{src}
			controls
			playsinline
			preload="metadata"
			aria-label={label}
			onerror={() => (failedSrc = src)}
		>
			<track kind="captions" />
		</video>
	{:else if src && !failed}
		<img {src} alt={label} onerror={() => (failedSrc = src)} />
	{:else}
		<div class="empty" role="img" aria-label={label}>
			{#if kind === 'video'}
				<IconVideo size={28} stroke={1.5} aria-hidden="true" />
			{:else}
				<IconPhoto size={28} stroke={1.5} aria-hidden="true" />
			{/if}
			<span>{label}</span>
		</div>
	{/if}
</div>

<style>
	.media-ph {
		width: 100%;
		min-height: 6rem;
		aspect-ratio: var(--ratio);
		overflow: hidden;
		background: color-mix(in srgb, var(--ink) 6%, var(--paper));
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	.media-ph.filled {
		background: color-mix(in srgb, var(--ink) 12%, black);
	}

	.media-ph.natural {
		aspect-ratio: auto;
		height: auto;
	}

	.media-ph.natural:not(.filled) {
		aspect-ratio: 1;
		min-height: 6rem;
	}

	.media-ph.frameless {
		border: 0;
	}

	.media-ph.natural.filled,
	.media-ph.frameless.filled {
		background: transparent;
	}

	.media-ph.natural.filled {
		min-height: 0;
	}

	img,
	video,
	.empty {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.media-ph.natural img,
	.media-ph.natural video {
		height: auto;
		object-fit: contain;
	}

	.empty {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.35rem;
		color: var(--muted);
	}

	.empty span {
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
</style>
