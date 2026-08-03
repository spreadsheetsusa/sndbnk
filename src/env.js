import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5174`.'
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	PUBLIC_BASE_DOMAIN: {
		public: true,
		description:
			'Apex hostname for tenant URLs (no protocol). Dev: `localhost`. Prod: `sndbnk.com`.'
	},
	MEDIA_ROOT: {
		description: 'Local filesystem root for media uploads (e.g. `./media`).'
	},
	BODY_SIZE_LIMIT: {
		description:
			'svelte-adapter-bun / Bun max request body size (e.g. `520M`). Default 512K is too small for library uploads; must cover audio (500MB) + cover (5MB) + form overhead.'
	},
	REDIS_URL: {
		schema: (value) => value || undefined,
		description:
			'Redis connection URL for BullMQ waveform jobs (e.g. `redis://127.0.0.1:6379`). Leave empty to skip async peak generation.'
	},
	STORAGE_SECRET: {
		description:
			'Secret used to encrypt bring-your-own-storage credentials at rest. Use 32+ characters with high entropy.'
	},
	// Billing and mail are optional so the app still boots with a `.env` that predates them.
	// Each schema returns `undefined` when unset, which marks the variable optional.
	STRIPE_SECRET_KEY: {
		schema: (value) => value || undefined,
		description:
			'Stripe API key. Prefer a restricted key (`rk_...`) over a secret key. Sandbox keys start with `rk_test_`. Leave empty to disable billing.'
	},
	PUBLIC_STRIPE_PUBLISHABLE_KEY: {
		public: true,
		schema: (value) => value || undefined,
		description: 'Stripe publishable key (`pk_...`), used by Stripe.js in the browser.'
	},
	STRIPE_WEBHOOK_SECRET: {
		schema: (value) => value || undefined,
		description:
			'Signing secret (`whsec_...`) for the `/api/stripe/webhook` endpoint. In dev, `stripe listen` prints one.'
	},
	MAIL_TRANSPORT: {
		schema: (value) => (value === 'smtp' ? 'smtp' : 'console'),
		description: 'Mail adapter: `console` (default, writes to stdout) or `smtp`.'
	},
	MAIL_FROM: {
		schema: (value) => value || 'SNDBNK <no-reply@sndbnk.com>',
		description: 'From header for outgoing mail.'
	},
	SMTP_HOST: {
		schema: (value) => value || undefined,
		description: 'SMTP hostname. Required when `MAIL_TRANSPORT=smtp`.'
	},
	SMTP_PORT: {
		schema: (value) => {
			if (!value) return 587;
			const port = Number(value);
			if (!Number.isInteger(port) || port < 1 || port > 65535) {
				throw new Error('SMTP_PORT must be an integer between 1 and 65535');
			}
			return port;
		},
		description: 'SMTP port. Defaults to 587 (STARTTLS).'
	},
	SMTP_SECURE: {
		schema: (value) => value === 'true',
		description: 'Set to `true` for implicit TLS on connect (port 465). Otherwise STARTTLS is used.'
	},
	SMTP_USER: {
		schema: (value) => value || undefined,
		description: 'SMTP username. Omit for an unauthenticated relay.'
	},
	SMTP_PASSWORD: {
		schema: (value) => value || undefined,
		description: 'SMTP password. Omit for an unauthenticated relay.'
	}
});
