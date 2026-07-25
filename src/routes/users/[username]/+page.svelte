<script>
	import PublicProfile from '#lib/components/PublicProfile.svelte';

	let { data } = $props();

	const pageTitle = $derived(`${data.profile.name} (@${data.profile.username}) | SNDBNK`);
	const pageDescription = $derived(`${data.profile.name} on SNDBNK — a public profile for sound.`);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
</svelte:head>

<PublicProfile {data} />
