<script>
	import IconPhoto from '@tabler/icons-svelte-runes/icons/photo';
	import IconVideo from '@tabler/icons-svelte-runes/icons/video';
	import { siteMediaUrl } from '#lib/site-media-url.js';

	/**
	 * @type {{
	 *   label?: string,
	 *   ratio?: string,
	 *   mediaId?: string,
	 *   kind?: string
	 * }}
	 */
	let { label = 'Image', ratio = '4 / 3', mediaId = '', kind = '' } = $props();

	const src = $derived(siteMediaUrl(mediaId));
	const isVideo = $derived(kind === 'video' && Boolean(src));
	let failedSrc = $state('');
	const failed = $derived(Boolean(src) && failedSrc === src);
</script>

<div class="media-ph" class:filled={Boolean(src) && !failed} style:--ratio={ratio}>
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

	img,
	video,
	.empty {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
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
