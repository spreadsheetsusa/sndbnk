<script>
	import { relativeTime } from '#lib/relative-time.js';

	/**
	 * @type {{
	 *   accounts: Array<{
	 *     userId: string,
	 *     name: string,
	 *     email: string,
	 *     username: string | null,
	 *     createdAt: number
	 *   }>
	 * }}
	 */
	let { accounts } = $props();
</script>

<section class="accounts" aria-labelledby="site-accounts-heading">
	<h3 id="site-accounts-heading">Accounts created on your domain</h3>
	<p class="hint">
		People who created an account from your site. Anyone with a SNDBNK account can still sign in to
		like, comment, play, and download.
	</p>
	{#if accounts.length === 0}
		<p class="empty">No one has created an account on your domain yet.</p>
	{:else}
		<ul>
			{#each accounts as account (account.userId)}
				<li>
					<div>
						<p class="name">{account.name}</p>
						<p class="meta">
							{#if account.username}
								<a href="/users/{account.username}">@{account.username}</a>
							{/if}
							<span>{account.email}</span>
						</p>
					</div>
					<time datetime={new Date(account.createdAt).toISOString()}>
						{relativeTime(account.createdAt)}
					</time>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.accounts {
		margin-top: 1.75rem;
	}

	h3 {
		margin: 0;
		font-size: 1rem;
	}

	.hint,
	.empty {
		margin: 0.35rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
	}

	ul {
		margin: 0.85rem 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.65rem 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
	}

	.name {
		margin: 0;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.75rem;
		margin: 0.15rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.meta a {
		color: var(--ink);
	}

	time {
		flex-shrink: 0;
		color: var(--muted);
		font-size: 0.82rem;
	}
</style>
