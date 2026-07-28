## Project Configuration

- **Language**: None
- **Package Manager**: bun
- **Add-ons**: prettier, tailwindcss, drizzle, better-auth, mcp, experimental

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Cursor Cloud specific instructions

This is `sndbnk`, a SvelteKit app (Vite dev server) using Drizzle ORM over SQLite and better-auth for email/password auth.

- **Runtime is Bun, not Node.** The DB layer imports `bun:sqlite` (`src/lib/server/db/index.js`), so the app only runs under Bun. Start dev with `bun run dev` (Vite on `http://localhost:5173`). Standard scripts are in `package.json`.
- **Env vars** live in `.env` (see `.env.example`): `DATABASE_URL`, `ORIGIN`, `BETTER_AUTH_SECRET`. For dev, `ORIGIN=http://localhost:5173`. Both `.env` and the SQLite file are gitignored but persist across sessions via the VM snapshot.
- **DB schema:** apply with `bun run drizzle-kit push --force`. The plain `bun run db:push` (no flag) prompts for TTY confirmation and fails in non-interactive shells. The SQLite file lives at `DATABASE_URL` (`local.db`).
- **Auth schema generation:** `bun run auth:schema` runs the better-auth CLI under Bun so it can load `bun:sqlite`. The generated `src/lib/server/db/auth.schema.js` is committed.
- **Lint:** `bun run lint` (`prettier --check`). A few committed files currently fail the check; that is pre-existing and unrelated to setup.
- **Core flow to smoke-test:** register at `/signup` or log in at `/signin`; both redirect to `/`, where the authenticated header shows the user and provides sign-out.

## Learned Workspace Facts

- The production build uses `svelte-adapter-bun`; `systemd.service` runs `build/index.js` with Bun from `/var/www/sndbnk`, and Caddy proxies public traffic to the app on `localhost:3000`.
- Use the package `#lib` import map for source aliases; this project does not use the removed `$lib` alias.
