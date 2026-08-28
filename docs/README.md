# sndbnk docs

`sndbnk` is a SoundCloud-style audio host: creators upload tracks, listeners play them from a
global player bar, and every creator gets a public profile reachable by path, subdomain, or their
own custom domain. SvelteKit + Svelte 5 runes, plain JS with JSDoc types, Drizzle over SQLite,
better-auth, all running on Bun.

Read [architecture.md](architecture.md) first. Everything else is reference you open on demand.

## Where to look for what

| I need to…                                            | Read                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| Understand the request lifecycle, layers, or tenancy  | [architecture.md](architecture.md)                                              |
| Add or change a table, column, or query               | [data-model.md](data-model.md)                                                  |
| Manage Drizzle migrations (standalone HTML guide)     | [drizzle-migrations.html](drizzle-migrations.html)                              |
| Keep the product vision / what to build next          | [business-plan.html](business-plan.html) (also Admin → Business planning)       |
| Budget, burn rate, ramp, and money next steps         | [business-finance.html](business-finance.html) (also Admin → Business planning) |
| Add a page, `load`, form action, or API endpoint      | [routing-and-forms.md](routing-and-forms.md)                                    |
| Write or review a `.svelte` / `.svelte.js` file       | [reactivity.md](reactivity.md)                                                  |
| Style anything, or touch colors and dark mode         | [design-system.md](design-system.md)                                            |
| Work on uploads, waveforms, tags, or storage adapters | [media-and-storage.md](media-and-storage.md)                                    |
| Set up env vars, deploy, or debug production          | [operations.md](operations.md)                                                  |
| Understand something that looks wrong                 | [known-issues.md](known-issues.md)                                              |

Normative style rules live in [`.cursor/rules/`](../.cursor/rules), not here. These docs explain
how the system is put together and why; the rules say what to do while editing it.

## Non-negotiables

Four constraints break the app if violated. Everything else is convention.

1. **Bun only.** `src/lib/server/db/index.js` imports `bun:sqlite`. Node cannot run this app.
   Every command goes through Bun.
2. **`#lib/...`, never `$lib`.** The alias is a package `imports` map in `package.json`; the
   `$lib` alias was removed from this project.
3. **`safeRedirect()`, never Kit's `redirect()`** in server code. See
   [`src/lib/server/safe-redirect.js`](../src/lib/server/safe-redirect.js) for the adapter bug it
   works around.
4. **Plain JS with JSDoc.** `jsconfig.json` sets `checkJs: false`. There is no TypeScript build
   step; types are documentation the editor happens to understand.

## Commands

```sh
bun install
bun run db:generate  # schema.js → drizzle/*.sql
bun run db:migrate   # apply pending SQL (see drizzle-migrations.html)
bun run nuke         # wipe DB + media + backups, remigrate (confirms first)
bun run dev          # Vite on http://localhost:5174
bun run build        # svelte-adapter-bun → build/index.js
bun run lint         # prettier --check .
bun run format       # prettier --write .
bun run auth:schema  # regenerate src/lib/server/db/auth.schema.js
```
