<script>
	import IconLoader2 from '@tabler/icons-svelte-runes/icons/loader-2';
	import IconPlayerPauseFilled from '@tabler/icons-svelte-runes/icons/player-pause-filled';
	import IconPlayerPlayFilled from '@tabler/icons-svelte-runes/icons/player-play-filled';

	/**
	 * @type {{
	 *   playing?: boolean,
	 *   loading?: boolean,
	 *   size?: number
	 * }}
	 */
	let { playing = false, loading = false, size = 18 } = $props();
</script>

{#if loading}
	<span class="glyph loading" aria-hidden="true">
		<IconLoader2 {size} />
	</span>
{:else if playing}
	<IconPlayerPauseFilled {size} aria-hidden="true" />
{:else}
	<IconPlayerPlayFilled {size} aria-hidden="true" />
{/if}

<style>
	.glyph.loading {
		display: inline-flex;
		animation: play-glyph-spin 0.8s linear infinite;
	}

	@keyframes play-glyph-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.glyph.loading {
			animation: none;
		}
	}
</style>
