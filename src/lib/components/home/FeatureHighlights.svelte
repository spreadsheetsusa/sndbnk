<script>
	import IconHeadphones from '@tabler/icons-svelte-runes/icons/headphones';
	import IconPlanet from '@tabler/icons-svelte-runes/icons/planet';
	import IconServer from '@tabler/icons-svelte-runes/icons/server';
	import IconUsers from '@tabler/icons-svelte-runes/icons/users';
	import IconWaveSine from '@tabler/icons-svelte-runes/icons/wave-sine';
	import IconWorld from '@tabler/icons-svelte-runes/icons/world';

	const FEATURES = [
		{
			id: 'domains',
			icon: IconWorld,
			title: 'Your own address',
			description: 'Subdomain out of the box, custom domain when you are ready.'
		},
		{
			id: 'storage',
			icon: IconServer,
			title: 'Bring your own disks',
			description:
				'Host on our disk or point at yours. The platform should feel like a friend, not a landlord.'
		},
		{
			id: 'viz',
			icon: IconPlanet,
			title: 'Milkdrop in the mix',
			description: 'Butterchurn viz rides the waveform while you listen.'
		},
		{
			id: 'people',
			icon: IconUsers,
			title: 'People, not predictions',
			description:
				'A feed from the humans you follow. Stumble into sound — we are not here to guess what you should like.'
		},
		{
			id: 'any-sound',
			icon: IconHeadphones,
			title: 'Any sound, posted',
			description: 'Tracks, mixes, loops, samples, sessions — get it up while it is still warm.'
		},
		{
			id: 'player',
			icon: IconWaveSine,
			title: 'Player that sticks',
			description: 'Header transport and waveform scrub ride every route with you.'
		}
	];
</script>

<section class="features" aria-labelledby="features-title">
	<header class="head">
		<div class="head-row">
			<p class="eyebrow">In the toolkit</p>
			<span class="mark" aria-hidden="true">///</span>
		</div>
		<h2 id="features-title">Built for posting and making contact</h2>
		<p class="lede">
			Drop the file. Keep the chrome alive. Find people the old way — by listening, following, and
			showing up.
		</p>
	</header>

	<ol class="index">
		{#each FEATURES as feature, i (feature.id)}
			{@const Icon = feature.icon}
			<li class="item" style="--i: {i}">
				<span class="num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
				<span class="icon" aria-hidden="true">
					<Icon size={22} stroke={1.75} />
				</span>
				<div class="copy">
					<h3>{feature.title}</h3>
					<p>{feature.description}</p>
				</div>
			</li>
		{/each}
	</ol>
</section>

<style>
	.features {
		display: grid;
		gap: clamp(2rem, 4vw, 3rem);
		width: 100%;
		padding: clamp(2.5rem, 5vw, 4.5rem) 0;
	}

	.head {
		display: grid;
		gap: 1rem;
	}

	.head-row {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 2rem;
	}

	.head > :not(.head-row) {
		max-width: 48rem;
		text-wrap: pretty;
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

	h2 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: clamp(1.85rem, 3.6vw, 3rem);
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.lede {
		margin: 0;
		max-width: 46rem;
		color: color-mix(in srgb, var(--muted) 88%, var(--ink));
		font-size: clamp(1rem, 1.35vw, 1.125rem);
		line-height: 1.55;
	}

	.index {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0;
		margin: 0;
		padding: 0;
		border-top: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		list-style: none;
	}

	.item {
		--bank-tone: 72%;
		--bank-lo: 10%;
		--bank-hi: 22%;
		--bank-dur: 7.2s;
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		gap: 0.85rem 1rem;
		align-items: start;
		padding: 1.35rem 1.25rem 1.35rem 1.25rem;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background-color: color-mix(
			in srgb,
			color-mix(in srgb, var(--accent) var(--bank-tone), black) var(--bank-lo),
			transparent
		);
		animation:
			rise 0.7s ease both,
			bank-pulse var(--bank-dur) ease-in-out infinite;
		animation-delay: calc(var(--i) * 70ms), calc(var(--i) * -1.1s);
	}

	.item:nth-child(1) {
		--bank-tone: 58%;
		--bank-lo: 7%;
		--bank-hi: 18%;
		--bank-dur: 8.4s;
	}

	.item:nth-child(2) {
		--bank-tone: 78%;
		--bank-lo: 12%;
		--bank-hi: 28%;
		--bank-dur: 6.1s;
	}

	.item:nth-child(3) {
		--bank-tone: 48%;
		--bank-lo: 9%;
		--bank-hi: 20%;
		--bank-dur: 9s;
	}

	.item:nth-child(4) {
		--bank-tone: 68%;
		--bank-lo: 11%;
		--bank-hi: 26%;
		--bank-dur: 5.6s;
	}

	.item:nth-child(5) {
		--bank-tone: 82%;
		--bank-lo: 8%;
		--bank-hi: 24%;
		--bank-dur: 7.8s;
	}

	.item:nth-child(6) {
		--bank-tone: 62%;
		--bank-lo: 10%;
		--bank-hi: 22%;
		--bank-dur: 6.7s;
	}

	.item:nth-child(odd) {
		padding-right: 1.75rem;
		padding-left: 1.75rem;
		border-right: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
	}

	.item:nth-child(even) {
		padding-left: 1.75rem;
	}

	/* Odd last item alone on the final row spans full width. */
	.item:last-child:nth-child(odd) {
		grid-column: 1 / -1;
		border-right: none;
	}

	.num {
		min-width: 1.75rem;
		color: var(--ink);
		font-family: var(--font-editorial);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		line-height: 1.4;
	}

	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		color: var(--ink);
	}

	.copy {
		display: grid;
		gap: 0.35rem;
		min-width: 0;
	}

	h3 {
		margin: 0;
		font-family: var(--font-editorial);
		font-size: 1.0625rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.copy p {
		margin: 0;
		color: color-mix(in srgb, var(--muted) 82%, var(--ink));
		font-size: 0.9375rem;
		line-height: 1.45;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.6rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes bank-pulse {
		0%,
		100% {
			background-color: color-mix(
				in srgb,
				color-mix(in srgb, var(--accent) var(--bank-tone), black) var(--bank-lo),
				transparent
			);
		}
		50% {
			background-color: color-mix(
				in srgb,
				color-mix(in srgb, var(--accent) var(--bank-tone), black) var(--bank-hi),
				transparent
			);
		}
	}

	@media (max-width: 720px) {
		.index {
			grid-template-columns: 1fr;
		}

		.item,
		.item:nth-child(odd),
		.item:nth-child(even),
		.item:last-child:nth-child(odd) {
			grid-column: auto;
			padding: 1.2rem 0.25rem 1.2rem 1.25rem;
			border-right: none;
		}
	}
</style>
