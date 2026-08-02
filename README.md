# sndbnk

A SoundCloud-style audio host. Creators upload tracks with cover art and metadata; listeners play
them from a global player bar that survives navigation, scrub a real waveform, like, and leave
comments pinned to a playback position. Every creator gets a public profile — by path, and on
Premium, at `{username}.sndbnk.com` or their own custom domain.

Built with SvelteKit and Svelte 5 runes on Bun, Drizzle ORM over SQLite, and better-auth. Audio can
live on SNDBNK's disk or on a server you own, over SFTP.

## Quickstart

Requires [Bun](https://bun.sh). The app imports `bun:sqlite`, so it does not run under Node.
Install `ffmpeg` as well — uploads use it to generate real waveforms; without it, tracks fall back
to placeholder bars.

```sh
cp .env.example .env    # then fill BETTER_AUTH_SECRET and STORAGE_SECRET
bun install
bun run db:migrate
bun run dev             # http://localhost:5173
```

Copy `.env.example` to `.env` if you do not already have one. For local tenant
subdomains, keep `PUBLIC_BASE_DOMAIN=localhost` and open profiles at
`http://{username}.localhost:5174` (browsers resolve `*.localhost` to loopback).
Apex routes (`/settings`, `/signup`, `/signin`) stay on `http://localhost:5174`.
Custom domains can be exercised in dev by pointing a hosts-file entry at
`127.0.0.1` after verifying the domain in Settings (Vite allows arbitrary Host
headers so tenant resolution can run).

### Tenant subdomains in dev

With `PUBLIC_BASE_DOMAIN=localhost`:

- apex surfaces (`/`, `/signin`, `/signup`, `/settings`, `/library`) → `http://localhost:5173`
- a Premium profile → `http://{username}.localhost:5173` (browsers resolve `*.localhost` to loopback,
  no hosts-file entry needed)
- a custom domain → add a `127.0.0.1` hosts entry after verifying the domain in Settings; Vite is
  configured to accept arbitrary `Host` headers so tenant resolution runs

## Scripts

| Command                           | What it does                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| `bun run dev`                     | Vite dev server on `:5173`                                   |
| `bun run build`                   | production build via `svelte-adapter-bun` → `build/index.js` |
| `bun run preview`                 | serve the production build                                   |
| `bun run db:generate`             | diff `schema.js` → SQL under `drizzle/`                      |
| `bun run db:migrate`              | apply pending Drizzle migrations (Bun)                       |
| `bun run db:backup`               | copy SQLite (+ WAL/SHM) to a timestamped backup              |
| `bun run nuke`                    | wipe DB + media + backups, then remigrate (confirms first)   |
| `bun run auth:schema`             | regenerate the better-auth Drizzle schema                    |
| `bun run lint` / `bun run format` | Prettier check / write                                       |

## Documentation

`docs/` explains how the system is put together. Start with
[docs/architecture.md](docs/architecture.md), then:

- [docs/data-model.md](docs/data-model.md) — tables, naming, schema-change workflow
- [docs/drizzle-migrations.html](docs/drizzle-migrations.html) — standalone Drizzle migrations guide
- [docs/routing-and-forms.md](docs/routing-and-forms.md) — routes, loads, actions, endpoints
- [docs/reactivity.md](docs/reactivity.md) — the Svelte 5 runes patterns this codebase uses
- [docs/design-system.md](docs/design-system.md) — tokens, dark mode, typography
- [docs/media-and-storage.md](docs/media-and-storage.md) — uploads, waveforms, tags, adapters
- [docs/operations.md](docs/operations.md) — env vars, deploy, production troubleshooting
- [docs/known-issues.md](docs/known-issues.md) — current debts and gotchas

Contributor conventions are enforced through [`.cursor/rules/`](.cursor/rules); [AGENTS.md](AGENTS.md)
is the entry point for AI coding sessions.

## Deployment

Push to `main` deploys to AWS Lightsail over SSH via GitHub Actions: pull, merge env, apply the
schema, build, and restart a systemd unit that runs `build/index.js` under Bun on `localhost:3000`.
Caddy terminates TLS and reverse-proxies, using on-demand TLS gated by `/api/domain-tls-check` so
only verified tenant hosts can obtain certificates. Full details in
[docs/operations.md](docs/operations.md).

## Appendix: project scaffold

This project was created with [`sv`](https://github.com/sveltejs/cli). To recreate the same starting
configuration:

```sh
bun x sv@0.16.5 create --template minimal --no-types \
  --add prettier tailwindcss="plugins:none" \
  drizzle="database:sqlite+sqlite:better-sqlite3" \
  better-auth="demo:password" mcp="ide:cursor+setup:remote" \
  experimental="versions:kit+features:async,remoteFunctions,explicitEnvironmentVariables,handleRenderingErrors" \
  --install bun sndbnk
```

`better-sqlite3` was replaced with Bun's native driver, and `svelte-adapter-bun` was added, after
scaffolding.
