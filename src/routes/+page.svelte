<script>
	import IconArrowUpRight from '@tabler/icons-svelte-runes/icons/arrow-up-right';
	import PublicProfile from '#lib/components/PublicProfile.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import CoverFlow from '#lib/components/home/CoverFlow.svelte';
	import StatBadges from '#lib/components/home/StatBadges.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';

	let { data } = $props();

	/** @type {HTMLElement | undefined} */
	let container;

	// Tenant hosts serve one profile from `/`; the marketing home has no paged
	// list, so this stays empty and inert there.
	const paged = restorableList(
		() => ({
			scope: 'profile',
			username: data.mode === 'tenant-profile' ? data.profile.username : null
		}),
		() => (data.mode === 'tenant-profile' ? data : { tracks: [], nextCursor: null }),
		() => container
	);

	export const snapshot = paged.snapshot;

	const shortName = $derived(
		data.mode === 'marketing'
			? (data.user?.name?.trim().split(/\s+/)[0] ?? data.user?.email?.split('@')[0] ?? 'Account')
			: 'Account'
	);

	const pageTitle = $derived(
		data.mode === 'tenant-profile'
			? `${data.profile.name} (@${data.profile.username}) | SNDBNK`
			: 'SNDBNK | A place for sound'
	);

	const pageDescription = $derived(
		data.mode === 'tenant-profile'
			? `${data.profile.name} on SNDBNK — a public profile for sound.`
			: 'SNDBNK is taking shape. A new home for artists, listeners, and the work between them.'
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
</svelte:head>

{#if data.mode === 'tenant-profile'}
	<div bind:this={container}>
		<PublicProfile {data} list={paged.current} />
	</div>
{:else}
	<div class="landing">
		<SiteHeader --site-header-gap="0" />

		<main>
			<section class="hero" aria-labelledby="hero-title">
				<div class="hero-copy">
					<p class="eyebrow">A place for sound</p>
					<h1 id="hero-title" class="display-face">Make some noise. <span>Keep it yours.</span></h1>
					<p class="intro">
						SNDBNK is taking shape. A new home for artists, listeners, and the work between them.
					</p>
					{#if data.authNotice}
						<p class="auth-notice" role="status" aria-live="polite">{data.authNotice}</p>
					{/if}
					{#if data.user}
						<p class="welcome">Good to have you here, {shortName}.</p>
					{:else}
						<div class="hero-actions">
							<a class="primary-action pressable" href="/signup">
								Create account
								<IconArrowUpRight size={16} stroke={1.75} aria-hidden="true" />
							</a>
							<a class="text-action" href="/signin">Sign in</a>
						</div>
					{/if}
				</div>

				<div class="sound-card" aria-label="Abstract audio waveform">
					<div class="card-topline">
						<span>SNDBNK / 001</span>
						<span>Signal in motion</span>
					</div>
					<svg viewBox="0 0 800 320" role="img" aria-labelledby="wave-title wave-description">
						<title id="wave-title">Audio waveform</title>
						<desc id="wave-description">A bright waveform moving across a dark field.</desc>
						<path
							d="M0 160 L20 160 L32 138 L44 183 L58 100 L72 218 L87 150 L103 170 L118 45 L132 275 L148 124 L162 196 L177 82 L192 245 L208 135 L224 175 L240 17 L255 302 L270 111 L286 208 L300 68 L316 259 L332 143 L348 178 L364 93 L380 232 L396 151 L412 168 L428 55 L444 269 L460 119 L476 204 L492 78 L508 251 L524 141 L540 181 L556 103 L572 222 L588 146 L604 174 L620 39 L636 281 L652 128 L668 192 L684 91 L700 237 L716 148 L732 170 L746 118 L760 202 L774 153 L800 160"
						/>
					</svg>
					<div class="card-footer">
						<span>00:00</span>
						<span class="card-note">Play it forward</span>
						<span>03:42</span>
					</div>
					<div class="stamp" aria-hidden="true">Independent<br />frequency</div>
				</div>
			</section>

			{#if data.showcase.length > 0}
				<section class="showcase" aria-labelledby="showcase-heading">
					<div class="showcase-head">
						<p class="eyebrow eyebrow-chip accent-text">In the bank</p>
						<h2 id="showcase-heading">Sound that already lives here</h2>
						<p class="showcase-lede">
							Drag it, nudge it, or leave it alone and let it play itself.
						</p>
					</div>

					<CoverFlow tracks={data.showcase} />
					<StatBadges stats={data.stats} />
				</section>
			{/if}

			<section class="manifesto" aria-label="Our intention">
				<p class="eyebrow">Why we are here</p>
				<p class="manifesto-copy">
					Music moves through people. We are building a place that respects that.
				</p>
				<span class="manifesto-mark" aria-hidden="true">///</span>
			</section>
		</main>

		<footer>
			<a class="logo display-face" href="/" aria-label="SNDBNK home">SNDBNK</a>
			<p>Sound belongs with the people who make it matter.</p>
			<p>© {new Date().getFullYear()} SNDBNK</p>
		</footer>
	</div>
{/if}

<style>
	.landing {
		width: min(100%, var(--site-shell-max));
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x);
		/* Not `overflow: hidden` — that makes a scroll container and breaks the sticky header. */
		overflow-x: clip;
	}

	.logo {
		color: var(--ink);
		font-size: clamp(1.5rem, 2.5vw, 2.1rem);
		line-height: 1;
		text-decoration: none;
	}

	.hero-actions {
		display: flex;
		align-items: center;
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(24rem, 1.1fr);
		gap: clamp(2rem, 5vw, 6rem);
		align-items: center;
		min-height: calc(100vh - 5rem);
		padding: clamp(3rem, 7vw, 7rem) 0;
	}

	.hero-copy {
		position: relative;
		z-index: 1;
	}

	.hero-copy > .eyebrow {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin: 0 0 1.5rem;
	}

	.hero-copy > .eyebrow::before {
		width: 2.75rem;
		height: 0.65rem;
		background: var(--accent);
		content: '';
	}

	h1 {
		max-width: 10ch;
		margin: 0;
		font-size: clamp(4.5rem, 8.4vw, 9rem);
		line-height: 0.78;
	}

	h1 span {
		display: block;
		color: transparent;
		-webkit-text-stroke: clamp(1px, 0.12vw, 2px) var(--ink);
	}

	.intro {
		max-width: 35rem;
		margin: clamp(2rem, 4vw, 3.5rem) 0 0;
		font-size: clamp(1rem, 1.4vw, 1.25rem);
		line-height: 1.55;
	}

	.hero-actions {
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.primary-action,
	.text-action {
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.primary-action {
		display: inline-flex;
		gap: 2rem;
		align-items: center;
		justify-content: space-between;
		min-width: 13rem;
		padding: 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		text-decoration: none;
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.text-action {
		text-underline-offset: 0.35rem;
	}

	.welcome {
		display: inline-block;
		margin: 2rem 0 0;
		padding: 0.8rem 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		font-weight: 800;
	}

	.auth-notice {
		width: fit-content;
		max-width: 35rem;
		margin: 2rem 0 0;
		padding: 0.9rem 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-weight: 800;
		line-height: 1.4;
	}

	.auth-notice + .welcome {
		margin-top: 1.25rem;
	}

	.sound-card {
		position: relative;
		min-height: clamp(28rem, 55vw, 44rem);
		padding: clamp(1.25rem, 3vw, 2.5rem);
		overflow: hidden;
		color: var(--on-inverse);
		background: var(--inverse);
		box-shadow: clamp(0.75rem, 2vw, 1.5rem) clamp(0.75rem, 2vw, 1.5rem) 0 var(--accent);
	}

	.sound-card::before,
	.sound-card::after {
		position: absolute;
		inset: 15% auto 15% 50%;
		border-left: 1px solid color-mix(in srgb, var(--on-inverse) 18%, transparent);
		content: '';
	}

	.sound-card::after {
		inset: 50% 10% auto;
		border-top: 1px solid color-mix(in srgb, var(--on-inverse) 18%, transparent);
		border-left: 0;
	}

	.card-topline,
	.card-footer {
		position: relative;
		z-index: 1;
		display: flex;
		justify-content: space-between;
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.sound-card svg {
		position: absolute;
		z-index: 1;
		top: 50%;
		left: 50%;
		width: 115%;
		transform: translate(-50%, -50%);
	}

	.sound-card path {
		fill: none;
		stroke: var(--accent);
		stroke-linecap: square;
		stroke-linejoin: bevel;
		stroke-width: 7;
		vector-effect: non-scaling-stroke;
	}

	.card-footer {
		position: absolute;
		right: clamp(1.25rem, 3vw, 2.5rem);
		bottom: clamp(1.25rem, 3vw, 2.5rem);
		left: clamp(1.25rem, 3vw, 2.5rem);
		align-items: end;
	}

	.card-note {
		color: var(--accent);
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: clamp(1.25rem, 2.3vw, 2.25rem);
		font-style: italic;
		font-weight: 400;
		letter-spacing: -0.03em;
		text-transform: none;
	}

	.stamp {
		position: absolute;
		z-index: 2;
		top: 17%;
		right: 9%;
		display: grid;
		width: 6.5rem;
		aspect-ratio: 1;
		place-items: center;
		border: 1px solid var(--accent);
		border-radius: 50%;
		color: var(--accent);
		font-size: 0.55rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		line-height: 1.5;
		text-align: center;
		text-transform: uppercase;
		transform: rotate(8deg);
	}

	/* Full-bleed band: the covers should run off both edges of the viewport,
	   not stop at the page rail. `.landing` clips the overflow. */
	.showcase {
		display: grid;
		gap: clamp(1.5rem, 3.5vw, 2.5rem);
		justify-items: center;
		margin-inline: calc(50% - 50vw);
		padding: clamp(2.5rem, 6vw, 4.5rem) var(--site-shell-pad-x);
		border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		animation: rise 0.85s ease both;
	}

	.showcase-head {
		display: grid;
		justify-items: center;
		max-width: 34rem;
		text-align: center;
	}

	.showcase-head .eyebrow {
		margin: 0 0 0.9rem;
	}

	.showcase-head h2 {
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: clamp(2rem, 5vw, 3.25rem);
		font-weight: 400;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}

	.showcase-lede {
		margin: 0.85rem 0 0;
		color: var(--muted);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.manifesto {
		display: grid;
		grid-template-columns: 0.35fr 1fr auto;
		gap: 2rem;
		align-items: start;
		padding: clamp(3rem, 6vw, 6rem) 0;
		border-top: 1px solid var(--ink);
		border-bottom: 1px solid var(--ink);
	}

	.manifesto .eyebrow {
		margin: 0.65rem 0 0;
	}

	.manifesto-copy {
		max-width: 24ch;
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: clamp(2rem, 4vw, 4.5rem);
		line-height: 1.06;
	}

	.manifesto-mark {
		padding: 0.45rem 0.7rem;
		color: var(--on-accent);
		background: var(--accent);
		font-weight: 900;
		letter-spacing: 0.15em;
	}

	footer {
		display: grid;
		grid-template-columns: 0.5fr 1fr auto;
		gap: 2rem;
		align-items: end;
		padding: 2rem 0;
	}

	footer p {
		margin: 0;
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.4;
	}

	footer p:last-child {
		text-align: right;
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

	@media (max-width: 960px) {
		.hero {
			grid-template-columns: 1fr;
			min-height: auto;
		}

		h1 {
			max-width: 8ch;
			font-size: clamp(4.4rem, 18vw, 8rem);
		}

		.sound-card {
			min-height: clamp(16rem, 115vw, 42rem);
		}
	}

	@media (max-width: 640px) {
		.hero {
			gap: 3rem;
			padding: 3.5rem 0 4.5rem;
		}

		h1 {
			font-size: clamp(4rem, 20vw, 6.5rem);
		}

		.intro {
			margin-top: 2rem;
		}

		.hero-actions {
			flex-wrap: wrap;
		}

		.primary-action {
			min-width: 100%;
		}

		.sound-card {
			min-height: clamp(16rem, 110vw, 42rem);
			box-shadow: 0.65rem 0.65rem 0 var(--accent);
		}

		.card-note {
			max-width: 8ch;
			text-align: center;
		}

		.stamp {
			top: 14%;
			width: 5.5rem;
		}
	}

	@media (max-width: 560px) {
		.manifesto {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.manifesto-copy {
			grid-column: auto;
			grid-row: auto;
		}

		.manifesto-mark {
			grid-column: auto;
			grid-row: auto;
			justify-self: start;
		}

		footer {
			grid-template-columns: 1fr;
		}

		footer p:last-child {
			text-align: left;
		}

		footer p:nth-child(2) {
			display: none;
		}
	}
</style>
