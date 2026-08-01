<script>
	import IconBrandApple from '@tabler/icons-svelte-runes/icons/brand-apple';
	import IconBrandBandcamp from '@tabler/icons-svelte-runes/icons/brand-bandcamp';
	import IconBrandBluesky from '@tabler/icons-svelte-runes/icons/brand-bluesky';
	import IconBrandInstagram from '@tabler/icons-svelte-runes/icons/brand-instagram';
	import IconBrandMastodon from '@tabler/icons-svelte-runes/icons/brand-mastodon';
	import IconBrandPatreon from '@tabler/icons-svelte-runes/icons/brand-patreon';
	import IconBrandSoundcloud from '@tabler/icons-svelte-runes/icons/brand-soundcloud';
	import IconBrandSpotify from '@tabler/icons-svelte-runes/icons/brand-spotify';
	import IconBrandTiktok from '@tabler/icons-svelte-runes/icons/brand-tiktok';
	import IconBrandX from '@tabler/icons-svelte-runes/icons/brand-x';
	import IconBrandYoutube from '@tabler/icons-svelte-runes/icons/brand-youtube';
	import IconLink from '@tabler/icons-svelte-runes/icons/link';
	import IconWorld from '@tabler/icons-svelte-runes/icons/world';

	import { iconForLabel } from '#lib/profile-links.js';

	/**
	 * Tabler icons are imported per path, so preset icon names resolve through a
	 * static map rather than a dynamic import.
	 * @type {{ label: string, size?: number, stroke?: number }}
	 */
	let { label, size = 16, stroke = 1.75 } = $props();

	const icons = {
		'brand-apple': IconBrandApple,
		'brand-bandcamp': IconBrandBandcamp,
		'brand-bluesky': IconBrandBluesky,
		'brand-instagram': IconBrandInstagram,
		'brand-mastodon': IconBrandMastodon,
		'brand-patreon': IconBrandPatreon,
		'brand-soundcloud': IconBrandSoundcloud,
		'brand-spotify': IconBrandSpotify,
		'brand-tiktok': IconBrandTiktok,
		'brand-x': IconBrandX,
		'brand-youtube': IconBrandYoutube,
		world: IconWorld,
		link: IconLink
	};

	const Icon = $derived(icons[iconForLabel(label)] ?? IconLink);
</script>

<Icon {size} {stroke} />
