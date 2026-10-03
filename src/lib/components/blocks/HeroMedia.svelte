<script>
	import MediaPlaceholder from '#lib/components/blocks/MediaPlaceholder.svelte';

	/**
	 * @type {{
	 *   label?: string,
	 *   mediaId?: string,
	 *   kind?: string,
	 *   fallbackRatio?: string,
	 *   imageRatio?: string,
	 *   imageWidth?: string,
	 *   imageBorder?: boolean
	 * }}
	 */
	let {
		label = '',
		mediaId = '',
		kind = '',
		fallbackRatio = '4 / 3',
		imageRatio = '',
		imageWidth = '',
		imageBorder = true
	} = $props();

	const ratio = $derived(
		typeof imageRatio === 'string' && imageRatio.trim() ? imageRatio.trim() : fallbackRatio
	);
	const maxWidth = $derived(typeof imageWidth === 'string' ? imageWidth.trim() : '');
</script>

<div
	class="media"
	data-hero-media
	class:sized={Boolean(maxWidth)}
	style:--hero-media-max={maxWidth || undefined}
>
	<MediaPlaceholder {label} {mediaId} {kind} {ratio} border={imageBorder} />
</div>

<style>
	.media {
		width: min(100%, var(--hero-media-cap, 100%));
	}

	.media.sized {
		width: min(100%, var(--hero-media-max));
		margin-inline: auto;
	}
</style>
