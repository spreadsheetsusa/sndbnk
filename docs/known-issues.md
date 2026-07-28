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

## The signup username `pattern` is silently dead

[`src/routes/signup/+page.svelte`](../src/routes/signup/+page.svelte) sets:

```html
pattern="[a-zA-Z0-9](?:[a-zA-Z0-9-]{1,28}[a-zA-Z0-9])?"
```

Modern browsers compile the `pattern` attribute with the regex `v` flag, under which a bare `-` at the
end of a character class is a syntax error. The browser therefore throws and **discards the pattern
entirely**, so client-side username validation never runs and the console shows:

```
Pattern attribute value … is not a valid regular expression: Invalid character class
```

Verifiable directly:

```js
new RegExp('[a-zA-Z0-9](?:[a-zA-Z0-9-]{1,28}[a-zA-Z0-9])?', 'u'); // fine
new RegExp('[a-zA-Z0-9](?:[a-zA-Z0-9-]{1,28}[a-zA-Z0-9])?', 'v'); // throws
```

Not a security problem — `validateUsername()` in
[`src/lib/server/username.js`](../src/lib/server/username.js) still rejects bad usernames server-side,
and its regex is used without the `v` flag so it is unaffected. The cost is a lost instant-feedback
guardrail plus console noise. The fix is to escape the dash (`[a-zA-Z0-9\-]`) or move it to the front
of the class.

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
