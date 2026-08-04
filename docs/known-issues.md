# Known issues and debts

Things that look wrong because they are. Read this before "fixing" something that turns out to be
deliberate, and before assuming something deliberate is safe.

## A stale `.env` breaks the app at boot

Every variable in [`src/env.js`](../src/env.js) is required unless it declares a validator saying
otherwise. Add one there and every existing `.env` — local checkouts, the VM snapshot — starts
failing **every route with a 500**, not just the feature that needs it:

```
Invalid environment variables
BODY_SIZE_LIMIT
  - Value is missing. If it is optional, add a validator declaring it as such.
```

That is what happens after pulling the `BODY_SIZE_LIMIT` change if your `.env` predates it. The
deploy workflow forces the value on the server, and `.env.example` lists it, but nothing repairs an
existing local file.

So when you add an env var: update `.env.example`, update the deploy workflow's managed list, and
either give it a validator marking it optional or expect everyone to edit their `.env`.

## `.env` is still tracked with live secrets

`.gitignore` lists `.env` (and ignores `.env.*` except `.env.example` / `.env.test`), but the file
remains in the git index from an earlier deploy expedient. `BETTER_AUTH_SECRET`, `STORAGE_SECRET`,
and mail credentials are therefore in git history.

Unwinding requires `git rm --cached .env`, provisioning env outside the repo (the deploy script
already merges and generates secrets server-side), and **rotating** both app secrets — which logs
every user out and invalidates every stored SSH credential. Do this before a major advertising push.

Do not add new secrets to `.env` while it is tracked. Prefer `.env.local` (gitignored) for machine-
specific overrides.

## Content-Security-Policy is Report-Only

The app and Caddy emit `Content-Security-Policy-Report-Only` (not enforcing) so Butterchurn,
Stripe.js, and Google Fonts can be inventory'd without breaking playback. Flip to enforcing CSP
after confirming the report-only policy is clean in production.

## Dead and unfinished code

| Item                                       | Status                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `task` table                               | Scaffolding from `sv create`. Defined in `schema.js` and the push script, queried by nothing. Safe to remove from both.       |
| `resolveTenantHost().pathname`             | Computed and typed, never read. Tenant `/` renders the profile from `locals.tenant` instead.                                  |
| `s3` and `r2` in `STORAGE_ADAPTERS`        | `enabled: false`, no implementation. The settings UI renders them as unavailable.                                             |
| Old Basic/Premium/Business Stripe products | Retired in app catalog (Free/Vault/Studio/Label). Archive leftover products in the Stripe Dashboard after `stripe:bootstrap`. |
| `src/lib/index.js`                         | An empty stub. Real imports use `#lib/...` subpaths; nothing imports the bare `#lib`.                                         |
| `scratch-seed.js`, `scratch-verify.js`     | Committed one-off probes from the tag-embedding work, with hardcoded `/tmp/sndbnk-tag/` paths and no `package.json` wiring.   |
| `db:push` (retired stub)                   | Exits with instructions. Real path is `db:generate` + `db:migrate`. See [`drizzle-migrations.html`](drizzle-migrations.html). |

## Inconsistencies worth knowing

- **Mixed state generations.** [`stores/theme.js`](../src/lib/stores/theme.js) and
  [`stores/brand.js`](../src/lib/stores/brand.js) are legacy `writable` stores;
  [`player/player.svelte.js`](../src/lib/player/player.svelte.js) is a rune class. `Waveform.svelte`
  consumes both in one file. New shared state should be a rune module — see
  [reactivity.md](reactivity.md).
- **Duplicate screen-reader utility.** `/settings` defines `.visually-hidden`, `PublicProfile.svelte`
  defines `.sr-only`, both scoped, both identical in intent. Should be one global class in
  `layout.css`.
- **Tailwind is installed but unused.** `@import 'tailwindcss'`, the Vite plugin, and
  `prettier-plugin-tailwindcss` are all configured; components style themselves with scoped CSS and
  custom properties. Tokens live in `:root`, not in a Tailwind `@theme` block. This is fine, just do
  not assume utilities are available idiom here.
- **Import extension inconsistency.** `storage/index.js` imports `./crypto.js`;
  `db/schema.js` imports `./auth.schema`. Both resolve; neither is enforced.
- **Env access is split by context.** Runtime code uses `$app/env/private`; `drizzle.config.js` and
  `scripts/migrate-sqlite.js` / `scripts/backup-sqlite.js` use `process.env` because they run outside
  the SvelteKit runtime.
  That split is correct, not a bug.
- **Reserved subdomains resolve to apex, not 404.** `classifyHost()` treats any hostname whose label
  is in `RESERVED_USERNAMES` as apex, so `admin.sndbnk.com` serves the main app. Deliberate — it
  keeps infra hostnames working.
- **`bun run lint` does not pass cleanly on `main`.** A few committed files fail
  `prettier --check`. Pre-existing; run `bun run format` on files you touch rather than reformatting
  the repo in an unrelated change.
