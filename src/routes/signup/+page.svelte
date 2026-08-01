<script>
	import IconAlertCircle from '@tabler/icons-svelte-runes/icons/alert-circle';
	import IconArrowLeft from '@tabler/icons-svelte-runes/icons/arrow-left';
	import IconArrowUpRight from '@tabler/icons-svelte-runes/icons/arrow-up-right';
	import { enhance } from '$app/forms';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';

	let { form } = $props();
	let submitting = $state(false);

	function handleSubmit() {
		submitting = true;

		return async ({ update }) => {
			try {
				await update();
			} finally {
				submitting = false;
			}
		};
	}
</script>

<svelte:head>
	<title>Create an account | SNDBNK</title>
	<meta name="description" content="Create your SNDBNK account and join a place built for sound." />
</svelte:head>

<main class="auth-page">
	<section class="auth-intro" aria-labelledby="signup-title">
		<div class="auth-top">
			<a class="logo display-face" href="/" aria-label="SNDBNK home">SNDBNK</a>
			<ThemeToggle />
		</div>
		<div class="intro-copy">
			<p class="eyebrow accent-text">Join the signal</p>
			<h1 id="signup-title" class="display-face">Make noise on your own terms.</h1>
		</div>
		<p class="side-note">We are building a thoughtful home for sound and the people around it.</p>
		<svg viewBox="0 0 600 120" role="img" aria-label="Abstract sound wave">
			<path
				d="M0 60 H45 L57 45 L68 76 L80 20 L94 102 L109 48 L124 70 L139 8 L154 112 L169 40 L184 81 L199 26 L214 96 L229 52 L244 67 L259 16 L274 105 L289 43 L304 78 L319 30 L334 91 L349 54 L364 65 L379 22 L394 99 L409 47 L424 73 L439 34 L454 87 L469 56 L484 64 L499 42 L514 76 L529 57 L544 63 L555 51 L566 68 L578 59 H600"
			/>
		</svg>
	</section>

	<section class="form-panel" aria-label="Create account form">
		<div class="form-wrap">
			<p class="eyebrow">New account</p>
			<h2>Create account</h2>
			<p class="form-intro">A few details and you are in.</p>

			{#if form?.message && !submitting}
				<div class="form-error" id="form-error" role="alert" aria-live="polite">
					<span class="form-error-icon" aria-hidden="true">
						<IconAlertCircle size={16} stroke={1.75} />
					</span>
					{form.message}
				</div>
			{/if}

			<form method="POST" use:enhance={handleSubmit} aria-busy={submitting}>
				<label for="name">Name</label>
				<input
					id="name"
					name="name"
					type="text"
					value={form?.name ?? ''}
					autocomplete="name"
					required
					aria-invalid={form?.message && !submitting ? 'true' : undefined}
					aria-describedby={form?.message && !submitting ? 'form-error' : undefined}
				/>

				<label for="username">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					value={form?.username ?? ''}
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					minlength="3"
					maxlength="30"
					pattern="[a-zA-Z0-9](?:[a-zA-Z0-9-]{(1, 28)}[a-zA-Z0-9])?"
					required
					aria-invalid={form?.message && !submitting ? 'true' : undefined}
					aria-describedby={form?.message && !submitting
						? 'form-error username-hint'
						: 'username-hint'}
				/>
				<p class="field-hint" id="username-hint">
					Your public URL: sndbnk.com/users/<span class="hint-em">you</span>. Letters, numbers,
					hyphens.
				</p>

				<label for="email">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					value={form?.email ?? ''}
					autocomplete="email"
					required
					aria-invalid={form?.message && !submitting ? 'true' : undefined}
					aria-describedby={form?.message && !submitting ? 'form-error' : undefined}
				/>

				<label for="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					minlength="8"
					required
					aria-invalid={form?.message && !submitting ? 'true' : undefined}
					aria-describedby={form?.message && !submitting
						? 'form-error password-hint'
						: 'password-hint'}
				/>
				<p class="field-hint" id="password-hint">Use at least 8 characters.</p>

				<button class="pressable" type="submit" disabled={submitting}>
					{submitting ? 'Creating account…' : 'Create account'}
					{#if !submitting}
						<IconArrowUpRight size={16} stroke={1.75} aria-hidden="true" />
					{/if}
				</button>
			</form>

			<p class="switch-auth">Already have an account? <a href="/signin">Sign in</a></p>
		</div>
		<a class="back-link" href="/">
			<IconArrowLeft size={14} stroke={1.75} aria-hidden="true" />
			Back home
		</a>
	</section>
</main>

<style>
	.auth-page {
		display: grid;
		grid-template-columns: minmax(24rem, 0.95fr) minmax(28rem, 1.05fr);
		min-height: 100vh;
	}

	.auth-intro {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 100vh;
		padding: clamp(1.5rem, 4vw, 4rem);
		overflow: hidden;
		color: var(--on-inverse);
		background: var(--inverse);
	}

	.auth-top {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.logo {
		width: fit-content;
		color: var(--on-inverse);
		font-size: clamp(1.7rem, 2.8vw, 2.4rem);
		line-height: 1;
		text-decoration: none;
	}

	.intro-copy {
		position: relative;
		z-index: 2;
		margin: auto 0;
	}

	.intro-copy .eyebrow {
		margin: 0 0 1.5rem;
	}

	h1 {
		max-width: 8ch;
		margin: 0;
		font-size: clamp(4rem, 7vw, 7.5rem);
		line-height: 0.82;
	}

	.side-note {
		position: relative;
		z-index: 2;
		max-width: 28rem;
		margin: 0;
		color: color-mix(in srgb, var(--on-inverse) 70%, transparent);
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.auth-intro svg {
		position: absolute;
		top: 52%;
		left: 50%;
		width: 115%;
		transform: translate(-50%, -50%);
		opacity: 0.22;
	}

	.auth-intro path {
		fill: none;
		stroke: var(--accent);
		stroke-width: 5;
		vector-effect: non-scaling-stroke;
	}

	.form-panel {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: clamp(2rem, 8vw, 8rem);
		background: var(--paper);
	}

	.form-wrap {
		width: min(100%, 29rem);
		margin: auto;
	}

	.form-wrap > .eyebrow {
		display: flex;
		gap: 0.7rem;
		align-items: center;
		margin: 0 0 1.25rem;
	}

	.form-wrap > .eyebrow::before {
		width: 2rem;
		height: 0.55rem;
		background: var(--accent);
		content: '';
	}

	h2 {
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: clamp(2.8rem, 5vw, 4.75rem);
		font-weight: 400;
		letter-spacing: -0.045em;
		line-height: 1;
	}

	.form-intro {
		margin: 1rem 0 2rem;
		color: var(--muted);
		line-height: 1.5;
	}

	.form-error {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		align-items: center;
		margin: 0 0 1.25rem;
		padding: 0.85rem;
		border: 1px solid var(--ink);
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.4;
	}

	.form-error-icon {
		display: grid;
		width: 1.5rem;
		aspect-ratio: 1;
		place-items: center;
		color: var(--on-accent);
		background: var(--accent);
	}

	.form-error-icon :global(svg) {
		display: block;
	}

	form {
		display: grid;
	}

	label {
		margin: 0 0 0.55rem;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	input {
		width: 100%;
		height: 3.1rem;
		margin-bottom: 1.1rem;
		padding: 0 0.85rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		color: var(--ink);
		background: transparent;
		outline: none;
	}

	input:focus {
		border-color: var(--ink);
		box-shadow: 4px 4px 0 var(--accent);
	}

	.field-hint {
		margin: -0.45rem 0 1.25rem;
		color: var(--muted);
		font-size: 0.7rem;
	}

	.hint-em {
		color: var(--ink);
		font-weight: 700;
	}

	button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 3.5rem;
		margin-top: 0.1rem;
		padding: 0 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.65;
		box-shadow: 2px 2px 0 var(--hard-shadow);
		cursor: wait;
	}

	.switch-auth {
		margin: 1.75rem 0 0;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.switch-auth a,
	.back-link {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		width: fit-content;
		margin-top: 3rem;
		color: var(--ink);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-underline-offset: 0.25rem;
	}

	.back-link :global(svg) {
		display: block;
		flex-shrink: 0;
	}

	@media (max-width: 800px) {
		.auth-page {
			grid-template-columns: 1fr;
		}

		.auth-intro {
			min-height: 23rem;
			padding: 1.5rem;
		}

		.intro-copy {
			margin: 4rem 0 1rem;
		}

		h1 {
			max-width: 9ch;
			font-size: clamp(3.5rem, 15vw, 5.5rem);
		}

		.side-note {
			display: none;
		}

		.form-panel {
			min-height: calc(100vh - 23rem);
			padding: 3.5rem 1.5rem 2rem;
		}

		.form-wrap {
			margin: 0 auto;
		}
	}
</style>
