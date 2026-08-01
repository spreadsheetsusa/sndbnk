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
			'svelte-adapter-bun / Bun max request body size (e.g. `110M`). Default 512K is too small for library uploads; must cover audio (100MB) + cover (5MB) + form overhead.'
	},
	STORAGE_SECRET: {
		description:
			'Secret used to encrypt bring-your-own-storage credentials at rest. Use 32+ characters with high entropy.'
	}
});
