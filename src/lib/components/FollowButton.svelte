<script>
	import IconUserCheck from '@tabler/icons-svelte-runes/icons/user-check';
	import IconUserPlus from '@tabler/icons-svelte-runes/icons/user-plus';

	/**
	 * @type {{
	 *   username: string,
	 *   name?: string | null,
	 *   following?: boolean,
	 *   signedIn?: boolean,
	 *   size?: 'sm' | 'md',
	 *   onchange?: (state: { username: string, following: boolean, followerCount: number }) => void
	 * }}
	 */
	let {
		username,
		name = null,
		following = false,
		signedIn = false,
		size = 'md',
		onchange
	} = $props();

	/** @type {{ following: boolean } | null} */
	let override = $state(null);
	let busy = $state(false);
	const isFollowing = $derived(override?.following ?? following);
	const label = $derived(isFollowing ? 'Following' : 'Follow');
	const who = $derived(name ?? `@${username}`);

	async function toggle() {
		if (busy) return;
		busy = true;
		try {
			const res = await fetch(`/api/users/${username}/follow`, { method: 'POST' });
			if (!res.ok) return;
			const data = await res.json();
			override = { following: data.following };
			onchange?.({ username, following: data.following, followerCount: data.followerCount });
		} finally {
			busy = false;
		}
	}
</script>

{#if signedIn}
	<button
		type="button"
		class={['follow-btn', 'pressable', size]}
		aria-pressed={isFollowing}
		aria-label={isFollowing ? `Unfollow ${who}` : `Follow ${who}`}
		disabled={busy}
		onclick={toggle}
	>
		{#if isFollowing}
			<IconUserCheck size={14} stroke={1.75} aria-hidden="true" />
		{:else}
			<IconUserPlus size={14} stroke={1.75} aria-hidden="true" />
		{/if}
		<span>{label}</span>
	</button>
{:else}
	<a class={['follow-btn', 'pressable', size]} href="/signin" aria-label="Sign in to follow {who}">
		<IconUserPlus size={14} stroke={1.75} aria-hidden="true" />
		<span>Follow</span>
	</a>
{/if}

<style>
	.follow-btn {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		font-weight: 900;
		letter-spacing: 0.06em;
		line-height: 1;
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}

	.follow-btn.sm {
		padding: 0.35rem 0.45rem;
		font-size: 0.62rem;
	}

	.follow-btn.md {
		width: 100%;
		padding: 0.6rem 0.75rem;
		box-shadow: 3px 3px 0 var(--hard-shadow);
		font-size: 0.72rem;
	}

	.follow-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent) 78%, var(--ink));
	}

	/* Confirmed state reads as pressed-in rather than as a call to action. */
	.follow-btn[aria-pressed='true'] {
		border-color: color-mix(in srgb, var(--ink) 30%, transparent);
		color: var(--muted);
		background: color-mix(in srgb, var(--paper) 88%, var(--ink));
		box-shadow: inset 2px 2px 0 color-mix(in srgb, var(--ink) 18%, transparent);
		transform: translate(1px, 1px);
	}

	.follow-btn[aria-pressed='true']:hover:not(:disabled) {
		border-color: var(--ink);
		color: var(--ink);
		background: color-mix(in srgb, var(--paper) 80%, var(--ink));
	}

	.follow-btn:disabled {
		opacity: 0.65;
		cursor: progress;
	}

	.follow-btn :global(svg) {
		display: block;
	}

	@media (max-width: 400px) {
		.follow-btn.sm span {
			display: none;
		}
	}
</style>
