<script>
	import IconArrowUpRight from '@tabler/icons-svelte-runes/icons/arrow-up-right';

	/**
	 * @type {{
	 *   href: string,
	 *   label: string
	 * }}
	 */
	let { href, label } = $props();
</script>

<a class="cartridge pressable" {href}>
	{label}
	<IconArrowUpRight size={16} stroke={1.75} aria-hidden="true" />
</a>

<style>
	.cartridge {
		display: inline-flex;
		gap: 0.65rem;
		align-items: center;
		justify-content: center;
		min-width: 13rem;
		padding: 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	@media (max-width: 640px) {
		.cartridge {
			min-width: 100%;
		}
	}
</style>
