<script>
	import { enhance } from '$app/forms';

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
	<title>Sign in | SNDBNK</title>
	<meta name="description" content="Sign in to your SNDBNK account." />
</svelte:head>

<main class="auth-page">
	<section class="auth-intro" aria-labelledby="signin-title">
		<a class="logo display-face" href="/" aria-label="SNDBNK home">SNDBNK</a>
		<div class="intro-copy">
			<p class="eyebrow accent-text">Return to the signal</p>
			<h1 id="signin-title" class="display-face">Pick up where you left off.</h1>
		</div>
		<p class="side-note">A place for sound, the people who make it, and the people who listen.</p>
		<svg viewBox="0 0 600 120" role="img" aria-label="Abstract sound wave">
			<path
				d="M0 60 H45 L57 45 L68 76 L80 20 L94 102 L109 48 L124 70 L139 8 L154 112 L169 40 L184 81 L199 26 L214 96 L229 52 L244 67 L259 16 L274 105 L289 43 L304 78 L319 30 L334 91 L349 54 L364 65 L379 22 L394 99 L409 47 L424 73 L439 34 L454 87 L469 56 L484 64 L499 42 L514 76 L529 57 L544 63 L555 51 L566 68 L578 59 H600"
			/>
		</svg>
	</section>

	<section class="form-panel" aria-label="Sign in form">
		<div class="form-wrap">
			<p class="eyebrow">Member access</p>
			<h2>Sign in</h2>
			<p class="form-intro">Enter your details to continue.</p>

			{#if form?.message && !submitting}
				<div class="form-error" id="form-error" role="alert" aria-live="polite">
					<span aria-hidden="true">!</span>
					{form.message}
				</div>
			{/if}

			<form method="POST" use:enhance={handleSubmit} aria-busy={submitting}>
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
					autocomplete="current-password"
					required
					aria-invalid={form?.message && !submitting ? 'true' : undefined}
					aria-describedby={form?.message && !submitting ? 'form-error' : undefined}
				/>

				<button type="submit" disabled={submitting}>
					{submitting ? 'Signing in…' : 'Sign in'}
					{#if !submitting}<span aria-hidden="true">↗</span>{/if}
				</button>
			</form>

			<p class="switch-auth">New to SNDBNK? <a href="/signup">Create an account</a></p>
		</div>
		<a class="back-link" href="/">← Back home</a>
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
		color: var(--paper);
		background: var(--ink);
	}

	.logo {
		position: relative;
		z-index: 2;
		width: fit-content;
		color: var(--paper);
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
		color: rgb(242 240 232 / 70%);
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
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2.8rem, 5vw, 4.75rem);
		font-weight: 400;
		letter-spacing: -0.045em;
		line-height: 1;
	}

	.form-intro {
		margin: 1rem 0 2.5rem;
		color: var(--muted);
		line-height: 1.5;
	}

	.form-error {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		align-items: center;
		margin: 0 0 1.5rem;
		padding: 0.85rem;
		border: 1px solid var(--ink);
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.4;
	}

	.form-error span {
		display: grid;
		width: 1.5rem;
		aspect-ratio: 1;
		place-items: center;
		background: var(--accent);
		font-weight: 900;
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
		height: 3.25rem;
		margin-bottom: 1.35rem;
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

	button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 3.5rem;
		margin-top: 0.35rem;
		padding: 0 1rem;
		border: 1px solid var(--ink);
		color: var(--ink);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--ink);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.65;
		box-shadow: 2px 2px 0 var(--ink);
		cursor: wait;
	}

	.switch-auth {
		margin: 2rem 0 0;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.switch-auth a,
	.back-link {
		color: var(--ink);
		font-weight: 800;
		text-underline-offset: 0.25rem;
	}

	.back-link {
		width: fit-content;
		margin-top: 3rem;
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
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
