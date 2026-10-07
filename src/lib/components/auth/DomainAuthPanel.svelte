<script>
	import IconArrowLeft from '@tabler/icons-svelte-runes/icons/arrow-left';

	/**
	 * @type {{
	 *   siteName: string,
	 *   logoUrl?: string | null,
	 *   title: string,
	 *   lede: string,
	 *   children: import('svelte').Snippet
	 * }}
	 */
	let { siteName, logoUrl = null, title, lede, children } = $props();
</script>

<main class="domain-auth">
	<a class="brand" href="/">
		{#if logoUrl}
			<img src={logoUrl} alt="" />
		{/if}
		<span>{siteName}</span>
	</a>

	<section class="panel" aria-labelledby="domain-auth-title">
		<h1 id="domain-auth-title">{title}</h1>
		<p class="lede">{lede}</p>
		{@render children()}
		<p class="note">Your account also works on SNDBNK.</p>
	</section>

	<a class="back" href="/">
		<IconArrowLeft size={14} stroke={1.75} aria-hidden="true" />
		Back to {siteName}
	</a>
</main>

<style>
	.domain-auth {
		display: grid;
		gap: 1.25rem;
		width: min(100% - 2rem, 28rem);
		margin: 2.5rem auto 3rem;
	}

	.brand {
		display: inline-flex;
		gap: 0.65rem;
		align-items: center;
		width: fit-content;
		color: var(--ink);
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
	}

	.brand img {
		width: 2rem;
		height: 2rem;
		object-fit: cover;
		border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--ink));
	}

	.panel {
		padding: 1.25rem 1.15rem 1.1rem;
		border: 1px solid var(--hard-border);
		background: var(--paper);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	h1 {
		margin: 0;
		font-size: 1.65rem;
		line-height: 1.1;
	}

	.lede,
	.note {
		margin: 0.45rem 0 0;
		color: var(--muted);
	}

	.note {
		margin-top: 1rem;
		font-size: 0.85rem;
	}

	.back {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		width: fit-content;
		color: var(--muted);
		font-size: 0.9rem;
		text-decoration: none;
	}

	.back:hover {
		color: var(--ink);
	}

	.panel :global(form) {
		display: grid;
		gap: 0.35rem;
		margin-top: 1.1rem;
	}

	.panel :global(label) {
		margin-top: 0.35rem;
		font-size: 0.82rem;
	}

	.panel :global(input) {
		width: 100%;
		height: 2.7rem;
		padding: 0 0.75rem;
		border: 1px solid var(--field-border);
		border-radius: 0;
		color: var(--ink);
		background: var(--field-surface);
	}

	.panel :global(.password-row) {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.panel :global(.forgot-link),
	.panel :global(.switch-auth a) {
		color: var(--ink);
	}

	.panel :global(.field-hint),
	.panel :global(.switch-auth) {
		margin: 0.15rem 0 0;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.panel :global(button.pressable) {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		justify-content: center;
		height: 2.7rem;
		margin-top: 0.55rem;
		border: 1px solid var(--ink);
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 4px 4px 0 var(--hard-shadow);
		cursor: pointer;
	}

	.panel :global(button.pressable:disabled) {
		cursor: progress;
		opacity: 0.7;
	}

	.panel :global(.form-error),
	.panel :global(.form-success) {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.65rem;
		align-items: center;
		margin: 0.85rem 0 0;
		padding: 0.75rem;
		border: 1px solid var(--ink);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.panel :global(.form-error-icon),
	.panel :global(.form-success-icon) {
		display: grid;
		width: 1.4rem;
		aspect-ratio: 1;
		place-items: center;
		color: var(--on-accent);
		background: var(--accent);
	}

	.panel :global(.hp) {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
