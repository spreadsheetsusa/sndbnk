<script>
	import IconAlertCircle from '@tabler/icons-svelte-runes/icons/alert-circle';
	import IconCheck from '@tabler/icons-svelte-runes/icons/check';
	import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from '$app/env/public';
	import { invalidateAll } from '$app/navigation';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	let { data } = $props();

	/** @type {'month' | 'year'} */
	let interval = $state('month');
	/** @type {string | null} */
	let selectedPlan = $state(null);
	let name = $state('');
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let promoCode = $state('');
	let starting = $state(false);
	let confirming = $state(false);
	let applyingPromo = $state(false);
	/** @type {string | null} */
	let message = $state(null);
	/** @type {string | null} */
	let promoNote = $state(null);
	let paymentReady = $state(false);

	/** @type {import('@stripe/stripe-js').StripeCheckoutLoadActionsSuccess | null} */
	let checkoutActions = $state.raw(null);

	const signedIn = $derived(Boolean(data.account));
	const currentPlan = $derived(data.account?.plan ?? null);
	const selected = $derived(data.plans.find((tier) => tier.id === selectedPlan) ?? null);
	const needsAccount = $derived(!signedIn);

	/**
	 * @param {number} cents
	 */
	function money(cents) {
		const dollars = cents / 100;
		return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
	}

	/**
	 * @param {{ monthlyAmount: number, yearlyAmount: number }} tier
	 */
	function priceFor(tier) {
		return interval === 'year' ? tier.yearlyAmount : tier.monthlyAmount;
	}

	/**
	 * How much the yearly price undercuts twelve monthly payments.
	 * @param {{ monthlyAmount: number, yearlyAmount: number }} tier
	 */
	function yearlySavings(tier) {
		if (!tier.monthlyAmount || !tier.yearlyAmount) return 0;
		return Math.round((1 - tier.yearlyAmount / (tier.monthlyAmount * 12)) * 100);
	}

	/**
	 * @param {string} planId
	 */
	function choose(planId) {
		message = null;
		promoNote = null;
		selectedPlan = planId;
		checkoutActions = null;
		paymentReady = false;
	}

	function cancelCheckout() {
		selectedPlan = null;
		checkoutActions = null;
		paymentReady = false;
		message = null;
	}

	/**
	 * Match the Payment Element to the brutalist tokens: square corners, ink
	 * borders, and the live accent read off the document so a custom accent carries
	 * into the Stripe iframe.
	 */
	function appearance() {
		const styles = getComputedStyle(document.documentElement);
		const read = (/** @type {string} */ token) => styles.getPropertyValue(token).trim();

		return /** @type {import('@stripe/stripe-js').Appearance} */ ({
			theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe',
			variables: {
				colorPrimary: read('--accent') || '#c8ff3d',
				colorBackground: read('--paper') || '#f2f0e8',
				colorText: read('--ink') || '#11110f',
				colorTextSecondary: read('--muted') || '#696861',
				borderRadius: '0px',
				fontFamily: 'Inter, system-ui, sans-serif',
				fontSizeBase: '15px',
				spacingUnit: '4px'
			},
			rules: {
				'.Input': { border: `1px solid ${read('--ink') || '#11110f'}`, boxShadow: 'none' },
				'.Input:focus': { boxShadow: `4px 4px 0 ${read('--accent') || '#c8ff3d'}` },
				'.Label': {
					fontSize: '11px',
					fontWeight: '900',
					letterSpacing: '0.1em',
					textTransform: 'uppercase'
				},
				'.Tab': { border: `1px solid ${read('--ink') || '#11110f'}`, boxShadow: 'none' },
				'.Tab--selected': { boxShadow: `3px 3px 0 ${read('--accent') || '#c8ff3d'}` }
			}
		});
	}

	async function startCheckout() {
		if (!selected || starting) return;

		starting = true;
		message = null;

		try {
			const response = await fetch('/api/billing/checkout', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					planId: selected.id,
					interval,
					...(needsAccount ? { name, username, email, password } : {})
				})
			});

			if (!response.ok) {
				const body = await response.json().catch(() => null);
				message = body?.message ?? 'We could not start checkout. Try again.';
				return;
			}

			const { clientSecret, accountCreated } = await response.json();

			// The account now exists and the session cookie is set, so the page's own
			// data (and the header) must catch up before payment resolves.
			if (accountCreated) await invalidateAll();

			const { loadStripe } = await import('@stripe/stripe-js');
			const stripe = await loadStripe(PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');
			if (!stripe) {
				message = 'Stripe.js failed to load. Check your connection and try again.';
				return;
			}

			const checkout = stripe.initCheckoutElementsSdk({
				clientSecret,
				elementsOptions: { appearance: appearance() }
			});

			const loaded = await checkout.loadActions();
			if (loaded.type === 'error') {
				message = loaded.error.message;
				return;
			}

			checkoutActions = loaded.actions;
			// The mount target is already rendered — the form that got us here lives in the
			// same `{#if selected}` block.
			checkout.createPaymentElement().mount('#payment-element');
			paymentReady = true;
		} catch (error) {
			message = error instanceof Error ? error.message : 'Something went wrong. Try again.';
		} finally {
			starting = false;
		}
	}

	async function applyPromo() {
		if (!checkoutActions || applyingPromo) return;

		applyingPromo = true;
		promoNote = null;

		try {
			const result = await checkoutActions.applyPromotionCode(promoCode.trim().toUpperCase());
			promoNote =
				result.type === 'error' ? result.error.message : 'Code applied — see the new total below.';
		} finally {
			applyingPromo = false;
		}
	}

	async function confirmPayment() {
		if (!checkoutActions || confirming) return;

		confirming = true;
		message = null;

		try {
			const result = await checkoutActions.confirm();
			// A success navigates to the session's return_url, so reaching here is a failure.
			if (result.type === 'error') message = result.error.message;
		} finally {
			confirming = false;
		}
	}
</script>

<svelte:head>
	<title>Plans and pricing | SNDBNK</title>
	<meta
		name="description"
		content="Host your sound on SNDBNK — a free profile, your own subdomain, or your own domain with unlimited tracks."
	/>
</svelte:head>

<div class="page">
	<SiteHeader />

	<main class="shell">
		<header class="intro">
			<p class="eyebrow accent-text eyebrow-chip">Pricing</p>
			<h1 class="display-face">Pick your signal strength.</h1>
			<p class="lede">
				Every plan gets a public profile and a real player. Pay to move onto your own domain and
				bring your own storage.
			</p>

			<div class="interval-toggle" role="group" aria-label="Billing interval">
				<button
					class="interval"
					class:active={interval === 'month'}
					type="button"
					aria-pressed={interval === 'month'}
					onclick={() => (interval = 'month')}
				>
					Monthly
				</button>
				<button
					class="interval"
					class:active={interval === 'year'}
					type="button"
					aria-pressed={interval === 'year'}
					onclick={() => (interval = 'year')}
				>
					Yearly
					<span class="save">save 18%</span>
				</button>
			</div>
		</header>

		{#if !data.billingEnabled}
			<div class="banner error" role="alert">
				Billing is not configured on this server, so paid plans cannot be purchased yet.
			</div>
		{/if}

		<section class="tiers" aria-label="Plans">
			{#each data.plans as tier (tier.id)}
				{@const amount = priceFor(tier)}
				{@const isCurrent = currentPlan === tier.id}
				<article class="tier" class:current={isCurrent} class:picked={selectedPlan === tier.id}>
					<h2 class="display-face">{tier.label}</h2>
					<p class="blurb">{tier.blurb}</p>

					<p class="price">
						{#if amount === 0}
							<span class="amount">Free</span>
						{:else}
							<span class="amount">{money(amount)}</span>
							<span class="per">/{interval === 'year' ? 'year' : 'month'}</span>
						{/if}
					</p>

					{#if interval === 'year' && yearlySavings(tier) > 0}
						<p class="price-note">
							{money(tier.monthlyAmount * 12)} billed monthly — you save {money(
								tier.monthlyAmount * 12 - tier.yearlyAmount
							)}.
						</p>
					{/if}

					<ul>
						{#each tier.features as feature (feature)}
							<li>
								<IconCheck size={14} stroke={2.5} aria-hidden="true" />
								{feature}
							</li>
						{/each}
					</ul>

					{#if isCurrent}
						<a class="cta ghost pressable" href="/settings?tab=billing">Your current plan</a>
					{:else if amount === 0}
						<a class="cta ghost pressable" href={signedIn ? '/settings?tab=billing' : '/signup'}>
							{signedIn ? 'Manage plan' : 'Start free'}
						</a>
					{:else if data.account?.hasSubscription}
						<a class="cta pressable" href="/settings?tab=billing">Switch to {tier.label}</a>
					{:else}
						<button
							class="cta pressable"
							type="button"
							disabled={!data.billingEnabled || !tier.purchasable}
							onclick={() => choose(tier.id)}
						>
							{tier.purchasable ? `Choose ${tier.label}` : 'Not available yet'}
						</button>
					{/if}
				</article>
			{/each}
		</section>

		{#if selected}
			<section class="checkout" aria-labelledby="checkout-title">
				<div class="checkout-head">
					<div>
						<p class="eyebrow">Checkout</p>
						<h2 id="checkout-title">
							{selected.label} — {money(priceFor(selected))}/{interval === 'year'
								? 'year'
								: 'month'}
						</h2>
					</div>
					<button class="text-button" type="button" onclick={cancelCheckout}>Cancel</button>
				</div>

				{#if message}
					<div class="banner error" role="alert" aria-live="polite">
						<IconAlertCircle size={16} stroke={1.75} aria-hidden="true" />
						{message}
					</div>
				{/if}

				{#if !paymentReady}
					<form
						class="account-form"
						aria-busy={starting}
						onsubmit={(event) => {
							event.preventDefault();
							startCheckout();
						}}
					>
						{#if needsAccount}
							<p class="form-intro">
								Your account is created before payment, so a declined card still leaves you a
								working Basic profile.
							</p>

							<label for="plan-name">Name</label>
							<input id="plan-name" type="text" autocomplete="name" bind:value={name} required />

							<label for="plan-username">Username</label>
							<input
								id="plan-username"
								type="text"
								autocomplete="username"
								autocapitalize="none"
								spellcheck="false"
								minlength="3"
								maxlength="30"
								bind:value={username}
								required
								aria-describedby="plan-username-hint"
							/>
							<p class="field-hint" id="plan-username-hint">
								Your profile lives at <span class="mono">{username || 'you'}.{data.baseDomain}</span
								>.
							</p>

							<label for="plan-email">Email</label>
							<input
								id="plan-email"
								type="email"
								autocomplete="email"
								bind:value={email}
								required
							/>

							<label for="plan-password">Password</label>
							<input
								id="plan-password"
								type="password"
								autocomplete="new-password"
								minlength="8"
								bind:value={password}
								required
							/>
						{:else}
							<p class="form-intro">
								Signed in as <strong>{data.account?.username}</strong>. Continue to enter payment
								details.
							</p>
						{/if}

						<button class="submit pressable" type="submit" disabled={starting}>
							{starting ? 'Preparing checkout…' : 'Continue to payment'}
						</button>
					</form>
				{/if}

				<div class="payment" hidden={!paymentReady}>
					<div id="payment-element"></div>

					<div class="promo">
						<label for="plan-promo">Promo code</label>
						<div class="promo-row">
							<input
								id="plan-promo"
								type="text"
								autocapitalize="characters"
								bind:value={promoCode}
							/>
							<button
								class="ghost pressable"
								type="button"
								disabled={applyingPromo || !promoCode.trim()}
								onclick={applyPromo}
							>
								{applyingPromo ? 'Checking…' : 'Apply'}
							</button>
						</div>
						{#if promoNote}
							<p class="field-hint" role="status">{promoNote}</p>
						{/if}
					</div>

					<button
						class="submit pressable"
						type="button"
						disabled={confirming}
						onclick={confirmPayment}
					>
						{confirming ? 'Confirming…' : `Subscribe to ${selected.label}`}
					</button>
					<p class="field-hint">
						You can change or cancel any time from Settings → Billing. Cancelling keeps your tracks.
					</p>
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
	}

	.shell {
		width: min(100%, var(--site-shell-max));
		margin: 0 auto;
		padding: 0 var(--site-shell-pad-x) 5rem;
	}

	.intro {
		max-width: 46rem;
		margin: 0 0 3rem;
	}

	.intro .eyebrow {
		margin: 0 0 1rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.6rem, 6vw, 4.5rem);
		line-height: 0.9;
	}

	.lede {
		margin: 1.25rem 0 0;
		max-width: 34rem;
		color: var(--muted);
		font-size: 1rem;
		line-height: 1.55;
	}

	.interval-toggle {
		display: inline-flex;
		margin-top: 2rem;
		border: 1px solid var(--hard-border);
		box-shadow: 5px 5px 0 var(--hard-shadow);
	}

	.interval {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.7rem 1.1rem;
		border: 0;
		border-radius: 0;
		color: var(--ink);
		background: transparent;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.interval + .interval {
		border-left: 1px solid color-mix(in srgb, var(--ink) 30%, transparent);
	}

	.interval.active {
		color: var(--on-accent);
		background: var(--accent);
	}

	.save {
		padding: 0.1rem 0.35rem;
		border: 1px solid currentcolor;
		font-size: 0.6rem;
		letter-spacing: 0.06em;
	}

	.tiers {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.5rem;
	}

	.tier {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.5rem;
		border: 1px solid var(--hard-border);
		background: transparent;
	}

	.tier.current,
	.tier.picked {
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		box-shadow: 6px 6px 0 var(--hard-shadow);
	}

	.tier h2 {
		margin: 0;
		font-size: 1.9rem;
		line-height: 1;
	}

	.blurb {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.45;
	}

	.price {
		display: flex;
		gap: 0.35rem;
		align-items: baseline;
		margin: 0.5rem 0 0;
	}

	.amount {
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 2.4rem;
		letter-spacing: -0.04em;
		line-height: 1;
	}

	.per {
		color: var(--muted);
		font-size: 0.8rem;
	}

	.price-note {
		margin: 0;
		color: var(--muted);
		font-size: 0.7rem;
	}

	.tier ul {
		flex: 1;
		display: grid;
		gap: 0.45rem;
		margin: 0.75rem 0 1rem;
		padding: 0;
		list-style: none;
		font-size: 0.85rem;
	}

	.tier li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.5rem;
		align-items: start;
		line-height: 1.4;
	}

	.tier li :global(svg) {
		display: block;
		margin-top: 0.15rem;
		color: var(--accent);
	}

	.cta {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: auto;
		padding: 0.9rem 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
	}

	.cta.ghost {
		border-color: var(--hard-border);
		color: var(--ink);
		background: transparent;
	}

	.cta:disabled {
		opacity: 0.55;
		box-shadow: 2px 2px 0 var(--hard-shadow);
		cursor: not-allowed;
	}

	.checkout {
		max-width: 34rem;
		margin: 3rem 0 0;
		padding: 1.75rem;
		border: 1px solid var(--hard-border);
		box-shadow: 6px 6px 0 var(--hard-shadow);
	}

	.checkout-head {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	.checkout-head .eyebrow {
		margin: 0 0 0.4rem;
	}

	.checkout-head h2 {
		margin: 0;
		font-family: 'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 1.5rem;
		font-weight: 400;
		letter-spacing: -0.03em;
		line-height: 1.1;
	}

	.text-button {
		border: 0;
		color: var(--muted);
		background: transparent;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-decoration: underline;
		text-transform: uppercase;
		text-underline-offset: 0.25rem;
		cursor: pointer;
	}

	.banner {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.6rem;
		align-items: center;
		margin-bottom: 1.25rem;
		padding: 0.8rem;
		border: 1px solid var(--ink);
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.4;
	}

	.banner.error {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.banner :global(svg) {
		display: block;
	}

	.account-form {
		display: grid;
	}

	.form-intro {
		margin: 0 0 1.5rem;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.5;
	}

	label {
		margin: 0 0 0.5rem;
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	input {
		width: 100%;
		height: 3rem;
		margin-bottom: 1rem;
		padding: 0 0.8rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		color: var(--ink);
		background: transparent;
		outline: none;
	}

	input:focus {
		box-shadow: 4px 4px 0 var(--accent);
	}

	.field-hint {
		margin: -0.4rem 0 1.1rem;
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.45;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.submit {
		width: 100%;
		margin-top: 0.5rem;
		padding: 1rem;
		border: 1px solid var(--ink);
		color: var(--on-accent);
		background: var(--accent);
		box-shadow: 5px 5px 0 var(--hard-shadow);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.submit:disabled {
		opacity: 0.65;
		box-shadow: 2px 2px 0 var(--hard-shadow);
		cursor: wait;
	}

	.payment {
		display: grid;
	}

	.promo {
		margin: 1.5rem 0 0.5rem;
	}

	.promo-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.6rem;
		align-items: start;
	}

	.promo-row input {
		margin-bottom: 0;
	}

	.promo-row button {
		height: 3rem;
		padding: 0 1rem;
		border: 1px solid var(--hard-border);
		border-radius: 0;
		color: var(--ink);
		background: transparent;
		box-shadow: 4px 4px 0 var(--hard-shadow);
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.promo .field-hint {
		margin: 0.6rem 0 0;
	}

	@media (max-width: 960px) {
		.tiers {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.intro {
			margin-bottom: 2rem;
		}

		.lede {
			display: none;
		}

		.interval-toggle {
			margin-top: 1.25rem;
		}
	}

	@media (pointer: coarse) {
		.interval {
			min-height: var(--tap-min);
		}
	}
</style>
