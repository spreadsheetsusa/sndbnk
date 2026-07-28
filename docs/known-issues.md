# Known issues and debts

Things that look wrong because they are. Read this before "fixing" something that turns out to be
deliberate, and before assuming something deliberate is safe.

## Schema drift between Drizzle and the push script

**Severity: breaks production features.**

There are two schema definitions:

- [`src/lib/server/db/schema.js`](../src/lib/server/db/schema.js) — what the app queries
- [`scripts/push-sqlite-schema.js`](../scripts/push-sqlite-schema.js) — what `bun run db:push`
  actually applies, and what the Lightsail deploy runs

The script is behind. It is missing:

- the `track_comment` and `track_like` tables entirely
- `track.waveform`, `track.duration_ms`, `track.bitrate`, `track.sample_rate`, `track.channels`,
  and `track.codec`

Because every statement is `CREATE TABLE IF NOT EXISTS`, the missing **tables** will be created on
the next deploy, but the missing **columns** never will — `IF NOT EXISTS` is a no-op against an
existing table and there is no `ALTER TABLE` step. So on any database that predates the audio
playback work, likes, comments, and waveforms will fail at the SQL layer.

It also defines `track_userId_idx`, which `schema.js` does not.

Fixing it means bringing the DDL in sync and adding guarded `ALTER TABLE … ADD COLUMN` statements
for the missing columns. Until then, **any schema change needs a matching edit to that script**, and
column additions need explicit migration handling.

## `.env` is committed with live secrets

`.gitignore` carries an explicit `!.env` exception:

```
# NOTE: .env is temporarily tracked so production can pull required vars.
```

Introduced as a deploy expedient. It means `BETTER_AUTH_SECRET` and `STORAGE_SECRET` are in git
history. Unwinding it requires re-ignoring the file, provisioning env another way (the deploy script
already merges and generates secrets server-side, so this is close to unnecessary), and rotating both
secrets — which logs every user out and invalidates every stored SSH credential.

Do not add new secrets to `.env` while it is tracked.

## Dead and unfinished code

| Item                                                | Status                                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `task` table                                        | Scaffolding from `sv create`. Defined in `schema.js` and the push script, queried by nothing. Safe to remove from both.     |
| `resolveTenantHost().pathname`                      | Computed and typed, never read. Tenant `/` renders the profile from `locals.tenant` instead.                                |
| `s3` and `r2` in `STORAGE_ADAPTERS`                 | `enabled: false`, no implementation. The settings UI renders them as unavailable.                                           |
| `profile.stripeCustomerId` / `stripeSubscriptionId` | Columns exist; no billing code. `setPlan` changes the plan with no payment.                                                 |
| `src/lib/index.js`                                  | An empty stub. Real imports use `#lib/...` subpaths; nothing imports the bare `#lib`.                                       |
| `scratch-seed.js`, `scratch-verify.js`              | Committed one-off probes from the tag-embedding work, with hardcoded `/tmp/sndbnk-tag/` paths and no `package.json` wiring. |
| `db:generate`, `db:migrate`, `db:studio`            | Present in `package.json`; no `drizzle/` folder exists, so migrations have never been used.                                 |

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
- **`accent` store is static.** `stores/brand.js` exports `writable('#c8ff3d')` and nothing ever
  sets it. It is plumbed through the root layout as `style:--accent`, presumably for future
  per-tenant branding.
- **Import extension inconsistency.** `storage/index.js` imports `./crypto.js`;
  `db/schema.js` imports `./auth.schema`. Both resolve; neither is enforced.
- **Env access is split by context.** Runtime code uses `$app/env/private`; `drizzle.config.js` and
  `scripts/push-sqlite-schema.js` use `process.env` because they run outside the SvelteKit runtime.
  That split is correct, not a bug.
- **Reserved subdomains resolve to apex, not 404.** `classifyHost()` treats any hostname whose label
  is in `RESERVED_USERNAMES` as apex, so `admin.sndbnk.com` serves the main app. Deliberate — it
  keeps infra hostnames working.
- **`bun run lint` does not pass cleanly on `main`.** A few committed files fail
  `prettier --check`. Pre-existing; run `bun run format` on files you touch rather than reformatting
  the repo in an unrelated change.
