# AGENTS.md

`sndbnk` is a SoundCloud-style audio host: creators upload tracks, listeners play them through a
global player bar, and every creator gets a public profile reachable by path, by subdomain, or on
their own custom domain. SvelteKit + Svelte 5 runes, plain JS with JSDoc, Drizzle over SQLite,
better-auth, running on Bun.

## Start here

`docs/` is the reference set. Read [docs/architecture.md](docs/architecture.md) before any
non-trivial change; open the rest on demand.

| I need to…                                           | Read                                                   |
| ---------------------------------------------------- | ------------------------------------------------------ |
| Understand the request lifecycle, layers, or tenancy | [docs/architecture.md](docs/architecture.md)           |
| Add or change a table, column, or query              | [docs/data-model.md](docs/data-model.md)               |
| Add a page, `load`, form action, or API endpoint     | [docs/routing-and-forms.md](docs/routing-and-forms.md) |
| Write or review a `.svelte` / `.svelte.js` file      | [docs/reactivity.md](docs/reactivity.md)               |
| Style anything, or touch colors and dark mode        | [docs/design-system.md](docs/design-system.md)         |
| Work on uploads, waveforms, tags, or storage         | [docs/media-and-storage.md](docs/media-and-storage.md) |
| Set up env vars, deploy, or debug production         | [docs/operations.md](docs/operations.md)               |
| Understand something that looks wrong                | [docs/known-issues.md](docs/known-issues.md)           |

Normative style rules live in [`.cursor/rules/`](.cursor/rules) and are applied automatically:
project map and code style always, plus scoped rules for Svelte files, server modules, routes, and
styling.

## Hard constraints

- **Runtime is Bun, not Node.** `src/lib/server/db/index.js` imports `bun:sqlite`, so every command
  goes through Bun. `bun run dev` starts Vite on `http://localhost:5173`.
- **`#lib/...`, never `$lib`.** It is a package `imports` map in `package.json`; the `$lib` alias was
  removed from this project.
- **`safeRedirect()` from `#lib/server/safe-redirect`, never `redirect()` from `@sveltejs/kit`** in
  server code — Kit's version crashes under `svelte-adapter-bun`.
- **Plain JS with JSDoc types.** `jsconfig.json` sets `checkJs: false`; there is no TypeScript build
  step and no test runner.

## Commands

```sh
bun install
bun run db:push      # apply the SQLite schema (non-interactive)
bun run dev          # Vite on http://localhost:5173
bun run build        # svelte-adapter-bun → build/index.js
bun run lint         # prettier --check .  (a few committed files fail; pre-existing)
bun run format       # prettier --write .
bun run auth:schema  # regenerate src/lib/server/db/auth.schema.js
```

`bun run db:push` runs [`scripts/push-sqlite-schema.js`](scripts/push-sqlite-schema.js), which applies
hand-written DDL through `bun:sqlite` because `drizzle-kit push` loads `better-sqlite3` and Bun cannot
open it. That script is the migration system: **a schema change in `src/lib/server/db/schema.js` needs
a matching edit there**, and a new column goes in two places — the `CREATE TABLE` body for fresh
databases, and the `ensureColumns()` list for existing ones. See
[docs/data-model.md](docs/data-model.md). `bun run db:push:kit` runs drizzle-kit under Node as an
escape hatch.

## Environment

Variables are declared in [`src/env.js`](src/env.js) and read through `$app/env/private` /
`$app/env/public`. `.env.example` lists them all: `DATABASE_URL`, `ORIGIN`, `PUBLIC_BASE_DOMAIN`,
`BETTER_AUTH_SECRET`, `MEDIA_ROOT`, `BODY_SIZE_LIMIT`, `STORAGE_SECRET`, plus `PROTOCOL_HEADER` /
`HOST_HEADER` that the Bun adapter needs behind a proxy.

For dev: `ORIGIN=http://localhost:5173`, `PUBLIC_BASE_DOMAIN=localhost`.

**Every declared variable is required.** If your `.env` predates one, the app returns 500 on every
route at boot with `Invalid environment variables` — copy the missing line from `.env.example`.

**`.env` is currently tracked in git** (a temporary deploy workaround, see
[docs/known-issues.md](docs/known-issues.md)), so do not add new secrets to it. The SQLite file is
gitignored. Both persist across sessions via the VM snapshot.

## Smoke test

`/signup` → `/library/new` (upload an audio file) → `/users/{username}` (play it, confirm the global
player bar survives navigation) → `/tracks/{id}` (like and comment) → sign out from the header →
`/signin` back in. Check any visual change in both light and dark mode.

## Svelte MCP

You have access to the Svelte MCP server (configured in [`.cursor/mcp.json`](.cursor/mcp.json)) with
comprehensive Svelte 5 and SvelteKit documentation. Use it rather than recalling API details.

- **`list-sections`** — call this first for any Svelte or SvelteKit topic. Returns titles,
  `use_cases`, and paths.
- **`get-documentation`** — after `list-sections`, fetch every section whose `use_cases` match the
  task. Accepts one or many sections.
- **`svelte-autofixer`** — run on any Svelte code you write, repeatedly, until it returns no issues or
  suggestions.
- **`playground-link`** — only after the user confirms they want one, and never for code written into
  this repo.
