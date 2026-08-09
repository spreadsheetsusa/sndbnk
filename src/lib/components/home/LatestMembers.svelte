<script>
	import Avatar from '#lib/components/Avatar.svelte';

	/**
	 * @typedef {{
	 *   username: string,
	 *   name: string,
	 *   image: string | null,
	 *   location: string | null
	 * }} LatestMember
	 */

	/** @type {{ members: LatestMember[] }} */
	let { members } = $props();
</script>

<div class="latest">
	<header class="head">
		<p class="eyebrow">New in the bnk</p>
		<span class="mark" aria-hidden="true">///</span>
	</header>
	<ul class="grid">
		{#each members as member (member.username)}
			<li>
				<a class="member" href="/users/{member.username}">
					<span class="avatar-wrap">
						<Avatar src={member.image} name={member.name} size="128px" alt="" />
					</span>
					<span class="meta">
						<span class="name">{member.name}</span>
						{#if member.location}
							<span class="location">{member.location}</span>
						{/if}
					</span>
				</a>
			</li>
		{/each}
	</ul>
</div>

<style>
	.latest {
		display: grid;
		gap: 1.5rem;
	}

	.head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 2rem;
	}

	.eyebrow {
		margin: 0.65rem 0 0;
	}

	.mark {
		padding: 0.45rem 0.7rem;
		color: var(--on-accent);
		background: var(--accent);
		font-weight: 900;
		letter-spacing: 0.15em;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: 1.5rem 1.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.grid > li {
		min-width: 0;
	}

	.member {
		display: flex;
		width: 100%;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		color: inherit;
		text-align: center;
		text-decoration: none;
	}

	.avatar-wrap {
		display: block;
		width: 100%;
		--avatar-border: 2px solid var(--accent);
		--avatar-bg: color-mix(in srgb, var(--ink) 10%, var(--paper));
		--avatar-color: var(--ink);
	}

	.avatar-wrap :global(.avatar) {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
	}

	.meta {
		display: flex;
		width: 100%;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		min-width: 0;
	}

	.name {
		display: -webkit-box;
		width: 100%;
		overflow: hidden;
		color: var(--ink);
		font-weight: 700;
		line-height: 1.25;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.location {
		display: -webkit-box;
		width: 100%;
		overflow: hidden;
		color: color-mix(in srgb, var(--muted) 72%, transparent);
		font-size: 0.8125rem;
		line-height: 1.25;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	@media (max-width: 960px) {
		.grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.grid {
			gap: 0.85rem 0.55rem;
		}

		.member {
			gap: 0.4rem;
		}

		.name {
			font-size: 0.8125rem;
		}

		.location {
			font-size: 0.6875rem;
		}
	}
</style>
