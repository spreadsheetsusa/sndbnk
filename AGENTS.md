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

- **Runtime is Bun, not Node.** The DB layer imports `bun:sqlite` (`src/lib/server/db/index.js`), so the app only runs under Bun. Start dev with `bun run dev` (Vite on `http://localhost:5174`). Standard scripts are in `package.json`.
- **Env vars** live in `.env` (see `.env.example`): `DATABASE_URL`, `ORIGIN`, `BETTER_AUTH_SECRET`. For dev, `ORIGIN=http://localhost:5174`. Both `.env` and the SQLite file are gitignored but persist across sessions via the VM snapshot.
- **DB schema:** apply with `bun run drizzle-kit push --force`. The plain `bun run db:push` (no flag) prompts for TTY confirmation and fails in non-interactive shells. The SQLite file lives at `DATABASE_URL` (`local.db`).
- **Auth schema generation:** `bun run auth:schema` runs the better-auth CLI under Bun so it can load `bun:sqlite`. The generated `src/lib/server/db/auth.schema.js` is committed.
- **Lint:** `bun run lint` (`prettier --check`). A few committed files currently fail the check; that is pre-existing and unrelated to setup.
- **Core flow to smoke-test:** register at `/signup` or log in at `/signin`; both redirect to `/`, where the authenticated header shows the user and provides sign-out.

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

## Learned User Preferences

- Prefer menus that open as local dropdowns/popovers anchored to their trigger, never slide-in drawers or panels.
- In the signed-in header, put Accent, Appearance, Settings, and Sign out (with username) behind an avatar-circle dropdown (grouped with separators), and render primary nav (Library, My Profile) as Winamp-style pressed mode buttons.
- Prefer the global player embedded in the header nav (centered among adjacent controls) rather than a footer bar; it can appear and disappear without slide animation.
- Prefer track listings without card borders or backgrounds; secondary track actions should sit in an ellipsis menu.
- Prefer TrackCard comment forms hidden until row hover (smooth slide+fade), and omit commenting on the personal library page.
- Prefer subtle, low-prominence borders and separators (e.g. reduced opacity) in both light and dark mode; in dark mode, card elevation should stay dim (accent-tinted border, muted shadow) rather than bright white glow.
- Prefer form controls with `rounded-xs` and accent-derived border/surface tints, not bright default input borders.
- Default non-full-width page content to the same max width as the site header/nav.
- Use Tabler icon components for all UI iconography instead of inline SVG glyphs or typographic arrows.
- When changing a shared UI pattern, apply it to every instance site-wide, not just the element the user pointed at.

## Learned Workspace Facts

- The production build uses `svelte-adapter-bun`; `systemd.service` runs `build/index.js` with Bun from `/var/www/sndbnk`, and Caddy proxies public traffic to the app on `localhost:3000`.
- Use the package `#lib` import map for source aliases; this project does not use the removed `$lib` alias.
- After pulls, apply SQLite schema with `bun run db:push` (`scripts/push-sqlite-schema.js`); do not rely on `drizzle-kit push` under Bun.
- Beyond `DATABASE_URL` / `ORIGIN` / `BETTER_AUTH_SECRET`, local/runtime env also needs `PUBLIC_BASE_DOMAIN`, `MEDIA_ROOT`, `BODY_SIZE_LIMIT`, and `STORAGE_SECRET` (see `.env.example`).
- Shared chrome lives in `#lib/components/SiteHeader.svelte` and is included per page (not via a nested layout); global playback is `#lib/components/player/HeaderPlayer.svelte` in that header (the former footer `GlobalPlayerBar` was removed).
- Creator profiles support bio, location, labeled external links, and an avatar; avatars appear in the header, comments, and similar chrome.
- Client upload autofill uses `#lib/media/audio-metadata.js` (`music-metadata`); server-side tag gap-fill uses `#lib/server/media/embed-tags.js` (`taglib-wasm`).
- Import icons from `@tabler/icons-svelte-runes` using per-icon paths (`@tabler/icons-svelte-runes/icons/heart`); the plain `@tabler/icons-svelte` package is Svelte 4 (`$$props`) and fails under the runes mode that `vite.config.js` forces, and barrel imports make Vite compile the whole icon set.
- `vite.config.js` forces runes mode for every non-`node_modules` file and pins the dev server to port 5174.
- The accent color is global: the `accent` writable in `#lib/stores/brand.js` drives `--accent` / `--on-accent` (defaults in `src/routes/layout.css`), with preset swatches plus a custom color via an inline slide-down picker; do not hardcode the accent hex in components.
- Waveforms use Wavesurfer with SoundCloud-like two-tone bars (darker lower half) and drag-to-scrub seeking that previews the playhead before release.
