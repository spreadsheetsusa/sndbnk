<script>
	import HeaderPlayer from '#lib/components/player/HeaderPlayer.svelte';
</script>

<div class="site-nav-player">
	<HeaderPlayer />
</div>

<style>
	.site-nav-player:not(:has(:global(.header-player))) {
		display: none;
	}

	.site-nav-player:has(:global(.header-player)) {
		display: flex;
		/* Basis 0 so the slot shares the row instead of wrapping on its content width. */
		flex: 1 1 0%;
		align-items: center;
		justify-content: center;
		min-width: 0;
		max-width: 100%;
	}

	/* Same wrap as the platform header: player takes the next row when the bar is narrow. */
	@media (max-width: 960px) {
		.site-nav-player:has(:global(.header-player)) {
			flex: 1 1 100%;
			order: 2;
			width: 100%;
		}
	}
</style>
