<script>
	import IconAlertCircle from '@tabler/icons-svelte-runes/icons/alert-circle';
	import IconArrowLeft from '@tabler/icons-svelte-runes/icons/arrow-left';
	import IconArrowUpRight from '@tabler/icons-svelte-runes/icons/arrow-up-right';
	import IconCircleCheck from '@tabler/icons-svelte-runes/icons/circle-check';
	import { enhance } from '$app/forms';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';

	/**
	 * @type {{
	 *   data: { passwordReset: boolean, emailPending: boolean, emailVerifiedNotice: boolean },
	 *   form: {
	 *     message?: string,
	 *     email?: string,
	 *     needsVerification?: boolean,
	 *     resendSuccess?: boolean
	 *   } | null | undefined
	 * }}
	 */
	let { data, form } = $props();
	let submitting = $state(false);
	let resending = $state(false);

	const showVerificationHelp = $derived(
		Boolean(data.emailPending || form?.needsVerification || form?.resendSuccess)
	);

	function handleSubmit() {
		return ({ action }) => {
			const isResend = String(action).includes('resendVerification');
			if (isResend) resending = true;
			else submitting = true;

			return async ({ update }) => {
				try {
					await update({ reset: false });
				} finally {
					submitting = false;
					resending = false;
				}
			};
		};
	}
</script>

<svelte:head>
	<title>Sign in | SNDBNK</title>
	<meta name="description" content="Sign in to your SNDBNK account." />
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="auth-page">
	<section class="auth-intro" aria-labelledby="signin-title">
		<div class="auth-top">
			<a class="logo display-face" href="/" aria-label="SNDBNK home">SNDBNK</a>
			<ThemeToggle />
		</div>
		<div class="intro-copy">
			<p class="eyebrow accent-text">Return to the signal</p>
			<h1 id="signin-title" class="display-face">Pick up where you left off.</h1>
		</div>
		<p class="side-note">An audio multi-tool for artists and creative listeners alike.</p>
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

			{#if data.passwordReset && !form?.message && !submitting}
				<div class="form-success" id="form-success" role="status" aria-live="polite">
					<span class="form-success-icon" aria-hidden="true">
						<IconCircleCheck size={16} stroke={1.75} />
					</span>
					Password updated — sign in with your new password.
				</div>
			{/if}

			{#if data.emailVerifiedNotice && !form?.message && !submitting}
				<div class="form-success" role="status" aria-live="polite">
					<span class="form-success-icon" aria-hidden="true">
						<IconCircleCheck size={16} stroke={1.75} />
					</span>
					Email confirmed — you can sign in now.
				</div>
			{/if}

			{#if data.emailPending && !form?.message && !form?.resendSuccess && !submitting}
				<div class="form-success" role="status" aria-live="polite">
					<span class="form-success-icon" aria-hidden="true">
						<IconCircleCheck size={16} stroke={1.75} />
					</span>
					Check your email for a confirmation link before signing in.
				</div>
			{/if}

			{#if form?.resendSuccess && !resending}
				<div class="form-success" role="status" aria-live="polite">
					<span class="form-success-icon" aria-hidden="true">
						<IconCircleCheck size={16} stroke={1.75} />
					</span>
					If that address needs confirmation, we sent a fresh link.
				</div>
			{/if}

			{#if form?.message && !submitting && !resending}
				<div class="form-error" id="form-error" role="alert" aria-live="polite">
					<span class="form-error-icon" aria-hidden="true">
						<IconAlertCircle size={16} stroke={1.75} />
					</span>
					{form.message}
				</div>
			{/if}

			<form method="POST" use:enhance={handleSubmit} aria-busy={submitting || resending}>
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

				<div class="password-row">
					<label for="password">Password</label>
					<a class="forgot-link" href="/forgot-password">Forgot password?</a>
				</div>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					aria-invalid={form?.message && !submitting ? 'true' : undefined}
					aria-describedby={form?.message && !submitting ? 'form-error' : undefined}
				/>

				<button class="pressable" type="submit" disabled={submitting || resending}>
					{submitting ? 'Signing in…' : 'Sign in'}
					{#if !submitting}
						<IconArrowUpRight size={16} stroke={1.75} aria-hidden="true" />
					{/if}
				</button>

				{#if showVerificationHelp}
					<button
						class="resend-btn pressable"
						type="submit"
						formaction="?/resendVerification"
						formnovalidate
						disabled={resending || submitting}
					>
						{resending ? 'Sending…' : 'Resend confirmation email'}
					</button>
				{/if}
			</form>

			<p class="switch-auth">New to SNDBNK? <a href="/signup">Create an account</a></p>
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
		font-family: var(--font-editorial);
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

	.form-error,
	.form-success {
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

	.form-error-icon,
	.form-success-icon {
		display: grid;
		width: 1.5rem;
		aspect-ratio: 1;
		place-items: center;
		color: var(--on-accent);
		background: var(--accent);
	}

	.form-error-icon :global(svg),
	.form-success-icon :global(svg) {
		display: block;
	}

	form {
		display: grid;
	}

	.password-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 0 0.55rem;
	}

	.password-row label {
		margin: 0;
	}

	.forgot-link {
		color: var(--muted);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-underline-offset: 0.2rem;
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
		border: 1px solid var(--field-border);
		border-radius: 0;
		color: var(--ink);
		background: var(--field-surface);
		outline: none;
	}

	input:focus {
		border-color: var(--field-border);
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

	.resend-btn {
		justify-content: center;
		height: 2.75rem;
		margin-top: 0.85rem;
		color: var(--ink);
		background: var(--paper);
		box-shadow: 3px 3px 0 var(--hard-shadow);
		font-size: 0.68rem;
	}

	.switch-auth {
		margin: 2rem 0 0;
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

	@media (max-width: 960px) {
		.auth-page {
			grid-template-columns: 1fr;
		}

		.auth-intro {
			min-height: 12rem;
			padding: 1.25rem 1.5rem;
		}

		.intro-copy {
			margin: 1.25rem 0 0;
		}

		.intro-copy .eyebrow {
			margin-bottom: 0.65rem;
		}

		h1 {
			max-width: 9ch;
			font-size: clamp(2.4rem, 10vw, 3.75rem);
		}

		.auth-intro svg {
			display: none;
		}

		.side-note {
			display: none;
		}

		.form-panel {
			min-height: calc(100vh - 12rem);
			padding: 2.5rem 1.5rem 2rem;
		}

		.form-wrap {
			margin: 0 auto;
		}
	}

	@media (max-width: 640px) {
		h1 {
			max-width: none;
		}
	}
</style>
