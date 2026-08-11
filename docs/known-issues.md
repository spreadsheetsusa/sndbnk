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

## Secrets once lived in a tracked `.env`

`.env` is gitignored and untracked (stopped in `38e9c1d` / `#61`). Deploy and local instances keep
their own file; `git pull` does not manage it. Prefer `.env.local` (gitignored) for machine-specific
overrides.

Older commits still contain former secret values. Rotate `BETTER_AUTH_SECRET`, `STORAGE_SECRET`, and
any mail or Stripe keys that were ever committed before a major advertising push. Rotation logs
everyone out and invalidates every stored SSH credential — there is no grace period or key
versioning. See [operations.md](operations.md).

## Content-Security-Policy is Report-Only

[`src/lib/server/security-headers.js`](../src/lib/server/security-headers.js) and production Caddy
already set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
and (in prod) HSTS. Only CSP stays `Content-Security-Policy-Report-Only` so Butterchurn, Stripe.js,
and Google Fonts can be inventory'd without breaking playback. Flip to enforcing CSP after
confirming the report-only policy is clean in production.

## Footguns that look like bugs

### Kit `redirect()` crashes under the Bun adapter

Never `import { redirect } from '@sveltejs/kit'` in server code. Use
[`safeRedirect()`](../src/lib/server/safe-redirect.js) from `#lib/server/safe-redirect`. Kit's
`redirect()` hits a Rolldown/`#internal` bug under `svelte-adapter-bun` and throws
`ReferenceError: window is not defined` in production. Hooks that need a plain HTTP redirect may use
`Response.redirect`.

### `BODY_SIZE_LIMIT` defaults to 512K

`svelte-adapter-bun` rejects bodies larger than its limit **before** app validation runs. Without
`BODY_SIZE_LIMIT=520M` (see `.env.example`), uploads return `413` and look like a broken form. This
is also the classic stale-`.env` example above.

### Prod login fails with `INVALID_ORIGIN`

`PROTOCOL_HEADER` / `HOST_HEADER` are read by the Bun adapter, not `src/env.js`. Without them behind
Caddy the app sees `http://localhost:3000` as its origin and better-auth rejects sign-ins. Local
works; prod fails. Full troubleshooting: [operations.md](operations.md).

### `bun:sqlite` UNRESOLVED_IMPORT during `bun run build`

Keep using Bun’s native driver. During the `svelte-adapter-bun` Rolldown pass you will see
`[UNRESOLVED_IMPORT] Could not resolve 'bun:sqlite' … treating it as an external dependency`
followed by `✔ done`. That is expected: the adapter leaves `bun:*` for the Bun runtime. It is not
a build failure and does not mean you should switch to `better-sqlite3`.

### Waveforms and WAV→MP3 are async and fail-soft

The request path only enqueues via
[`enqueueWaveformJob`](../src/lib/server/queue/waveform.js) /
[`enqueueTranscodeJob`](../src/lib/server/queue/transcode.js) — it never shells out to ffmpeg.
Real peaks and MP3 playback copies need `REDIS_URL`, a running worker (`bun run worker:waveform`
locally; `sndbnk-waveform-worker` in prod), and ffmpeg with `libmp3lame`. Missing any of those
leaves SoundCloud-style placeholder bars and/or WAV streaming as WAV; the upload itself still
succeeded. Details: [media-and-storage.md](media-and-storage.md).

The worker runs raw Bun (not Vite). Bun’s package `imports` map does not resolve
extensionless `#lib/…` the way Vite does — imports in the worker dependency tree must use
`.js` / `index.js` or the unit crash-loops with `Cannot find module '#lib/server/…'`.

### Stripe env keys alone leave paid tiers unavailable

`/plans` marks a tier purchasable only when `stripe_price_*` IDs exist on the `plan` row. Env
publishable/secret keys alone show **Not available yet**. Run `bun run stripe:bootstrap` to sync
Stripe products/prices into the database.

### Rate limits are in-memory only

Sign-in, signup, forgot/reset password, verification resend, and anonymous checkout use
[`rate-limit.js`](../src/lib/server/rate-limit.js). Counters live in process memory: they reset on
restart and are not shared across processes. Fine for single-node Lightsail; not a Redis-backed
limiter. Signup also uses Cloudflare Turnstile (optional keys) and a honeypot; new accounts must
confirm email before sign-in (`requireEmailVerification`). Migration
`0021_verify_existing_emails` marks pre-existing users verified so deploy does not lock them out.

### List chrome, infinite scroll, and scroll restore

Track rows use `content-visibility: auto`, which clips absolutely positioned ellipsis menus — the
open-menu row must force `content-visibility: visible` and a raised z-index. Scroll restore must
measure via the `offsetTop` chain, not `getBoundingClientRect()`, because the `rise` entrance
transform skews rects. IntersectionObserver sentinels for short rows can stall inside `rootMargin`;
verify infinite scroll in a foregrounded tab or via the rendering-independent **Load more** button.

### No automated tests

There is no test runner or `test` script. Verification is `bun run format` / `bun run lint` on files
you touch, plus the manual smoke path in [AGENTS.md](../AGENTS.md) (`/signup` → upload → play →
like/comment → sign out).

### Media is not served via signed URLs

`/api/media/[id]/[file]` authorizes with UUID obscurity plus `canViewTrack` / tenant checks. There
are no HMAC expiry links. `STORAGE_SECRET` encrypts BYOS (SSH) credentials at rest only — rotating
it does not invalidate media URLs.

### Tabler icons: runes package, per-icon paths

Import from `@tabler/icons-svelte-runes/icons/...`. The plain `@tabler/icons-svelte` package is
Svelte 4 (`$$props`) and fails under the forced runes mode in [`vite.config.js`](../vite.config.js).
Barrel imports make Vite compile the whole icon set.

### `auth.schema.js` is generated

[`src/lib/server/db/auth.schema.js`](../src/lib/server/db/auth.schema.js) comes from
`bun run auth:schema`. Hand edits are lost on the next regenerate. Always follow with
`bun run format` — the CLI emits double quotes that fail `prettier --check`.

### Dev server port is 5174

[`vite.config.js`](../vite.config.js) pins `server.port` to **5174**. Use
`ORIGIN=http://localhost:5174`. Some older docs still say 5173; a mismatched `ORIGIN` breaks
better-auth the same way a wrong prod origin does.

## Dead and unfinished code

| Item                                       | Status                                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task` table                               | Scaffolding from `sv create`. Defined in `schema.js`, queried by nothing. Safe to remove.                                                                       |
| `resolveTenantHost().pathname`             | Computed and typed, never read. Tenant `/` renders the profile from `locals.tenant` instead.                                                                    |
| `s3` and `r2` in `STORAGE_ADAPTERS`        | `enabled: false`, no implementation. The settings UI renders them as unavailable.                                                                               |
| Old Basic/Premium/Business Stripe products | Retired in app catalog (Free/Vault/Studio/Label). Archive leftover products in the Stripe Dashboard after `stripe:bootstrap`.                                   |
| `src/lib/index.js`                         | An empty stub. Real imports use `#lib/...` subpaths; nothing imports the bare `#lib`.                                                                           |
| `scratch-*.js` (repo root)                 | One-off probes (`scratch-seed.js`, `scratch-verify.js`, `scratch-billing-verify.js`, `scratch-seed-many.js`) with hardcoded paths and no `package.json` wiring. |
| `db:push` (retired stub)                   | Exits with instructions. Real path is `db:generate` + `db:migrate`. See [`drizzle-migrations.html`](drizzle-migrations.html).                                   |

## Inconsistencies worth knowing

- **Mixed state generations.** [`stores/theme.js`](../src/lib/stores/theme.js) and
  [`stores/brand.js`](../src/lib/stores/brand.js) are legacy `writable` stores;
  [`player/player.svelte.js`](../src/lib/player/player.svelte.js) is a rune class. `Waveform.svelte`
  consumes both in one file. New shared state should be a rune module — see
  [reactivity.md](reactivity.md).
- **Duplicate screen-reader utility.** Global `.sr-only` already lives in
  [`layout.css`](../src/routes/layout.css), but settings / admin / feed still define scoped
  `.visually-hidden`, and [`InfiniteList.svelte`](../src/lib/components/lists/InfiniteList.svelte)
  redefines `.sr-only`. Collapse onto the global class.
- **Tailwind is installed but not the component idiom.** `@import 'tailwindcss'`, the Vite plugin,
  and `prettier-plugin-tailwindcss` are configured; components primarily use scoped CSS and custom
  properties. Tokens live in `:root`, not a Tailwind `@theme` block. Prefer scoped CSS for new work;
  do not assume utility classes are the house style.
- **Import extension inconsistency.** `storage/index.js` imports `./crypto.js`;
  `db/schema.js` imports `./auth.schema`. Both resolve; neither is enforced.
- **Env access is split by context.** Runtime code uses `$app/env/private`; `drizzle.config.js` and
  `scripts/migrate-sqlite.js` / `scripts/backup-sqlite.js` use `process.env` because they run outside
  the SvelteKit runtime. That split is correct, not a bug.
- **Reserved subdomains resolve to apex, not 404.** `classifyHost()` treats any hostname whose label
  is in `RESERVED_USERNAMES` as apex, so `admin.sndbnk.com` serves the main app. Deliberate — it
  keeps infra hostnames working.
- **`bun run lint` does not pass cleanly.** At least
  `.cursor/hooks/state/continual-learning.json` fails `prettier --check`. Pre-existing; run
  `bun run format` on files you touch rather than reformatting the repo in an unrelated change.
