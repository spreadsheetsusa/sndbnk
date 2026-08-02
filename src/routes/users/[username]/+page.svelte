<script>
	import PublicProfile from '#lib/components/PublicProfile.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';
	import { absoluteUrl, personJsonLd } from '#lib/seo.js';

	let { data } = $props();

	/** @type {HTMLElement | undefined} */
	let container;

	const paged = restorableList(
		() => ({ scope: 'profile', username: data.profile.username }),
		() => data,
		() => container
	);

	export const snapshot = paged.snapshot;

	const pageTitle = $derived(`${data.profile.name} (@${data.profile.username}) | SNDBNK`);
	const pageDescription = $derived(`${data.profile.name} on SNDBNK — a public profile for sound.`);
	const seoCanonical = $derived(`${data.siteOrigin}/users/${data.profile.username}`);
	const seoJsonLd = $derived(
		personJsonLd({
			name: data.profile.name,
			username: data.profile.username,
			url: seoCanonical,
			image: data.profile.avatarUrl ? absoluteUrl(data.siteOrigin, data.profile.avatarUrl) : null,
			description: pageDescription
		})
	);
</script>

<SeoHead
	title={pageTitle}
	description={pageDescription}
	canonical={seoCanonical}
	origin={data.siteOrigin}
	image={data.profile.avatarUrl}
	type="profile"
	jsonLd={seoJsonLd}
/>

<div bind:this={container}>
	<PublicProfile {data} list={paged.current} />
</div>
