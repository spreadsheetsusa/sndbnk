<script>
	import IconPhoto from '@tabler/icons-svelte-runes/icons/photo';

	/**
	 * @type {{
	 *   label?: string,
	 *   ratio?: string
	 * }}
	 */
	let { label = 'Image', ratio = '4 / 3' } = $props();
</script>

<div class="media-ph" style:--ratio={ratio} role="img" aria-label={label}>
	<IconPhoto size={28} stroke={1.5} aria-hidden="true" />
	<span>{label}</span>
</div>

<style>
	.media-ph {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.35rem;
		aspect-ratio: var(--ratio);
		width: 100%;
		min-height: 6rem;
		color: var(--muted);
		background: color-mix(in srgb, var(--ink) 6%, var(--paper));
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}

	span {
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
</style>
