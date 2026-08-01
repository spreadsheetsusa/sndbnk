<script>
	/**
	 * Circular user avatar with an initial fallback. Sizing and chrome are driven
	 * by CSS custom properties so callers can restyle without `:global`.
	 *
	 * @type {{
	 *   src?: string | null,
	 *   name?: string | null,
	 *   size?: string,
	 *   alt?: string
	 * }}
	 */
	let { src = null, name = null, size = '2rem', alt = '' } = $props();

	const initial = $derived((name ?? '?').trim().charAt(0).toUpperCase() || '?');
</script>

<span class="avatar" style:--avatar-size={size}>
	{#if src}
		<img {src} {alt} loading="lazy" />
	{:else}
		<span aria-hidden="true">{initial}</span>
	{/if}
</span>

<style>
	.avatar {
		display: inline-flex;
		width: var(--avatar-size);
		height: var(--avatar-size);
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border: var(--avatar-border, 1px solid var(--ink));
		border-radius: 50%;
		background: var(--avatar-bg, var(--accent));
		color: var(--avatar-color, var(--on-accent));
		font-size: var(--avatar-font-size, calc(var(--avatar-size) * 0.4));
		font-weight: 900;
		line-height: 1;
		flex-shrink: 0;
		user-select: none;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
