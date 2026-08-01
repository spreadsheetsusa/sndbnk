<script>
	import PublicProfile from '#lib/components/PublicProfile.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';

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
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
</svelte:head>

<div bind:this={container}>
	<PublicProfile {data} list={paged.current} />
</div>
