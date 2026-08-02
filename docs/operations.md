# Operations

## Local development

```sh
cp .env.example .env    # then fill BETTER_AUTH_SECRET and STORAGE_SECRET
bun install
bun run db:migrate
bun run dev             # http://localhost:5173
```

Install `ffmpeg` too. Uploads shell out to it for waveform peaks; without it, tracks get
placeholder bars. Production deploy installs and verifies ffmpeg before restarting the service.

### Testing tenant hosts locally

With `PUBLIC_BASE_DOMAIN=localhost`:

- apex surfaces (`/`, `/signin`, `/signup`, `/settings`, `/library`) → `http://localhost:5173`
- a Vault+ profile → `http://{username}.localhost:5173` (browsers resolve `*.localhost` to
  loopback with no hosts-file entry)
- a custom domain → add a `127.0.0.1` hosts entry and verify the domain in Settings first;
  `vite.config.js` sets `server.allowedHosts: true` specifically so arbitrary `Host` headers reach
  the tenant hook

A Free-plan user on a subdomain is redirected to the apex path URL, which is the fastest way to
confirm plan gating works.

### Full local reset (`bun run nuke`)

Wipes app data and re-initializes a fresh empty database (schema + plan seeds):

- deletes `DATABASE_URL` and its `-wal` / `-shm` / `-journal` sidecars
- deletes `MEDIA_ROOT` (recreates an empty directory)
- deletes the DB backups directory (`BACKUP_DIR`, default `<db-dir>/backups`)
- runs `bun run db:migrate`

Interactive confirmation requires typing `nuke`. Non-interactive shells need
`NUKE_CONFIRM=nuke`. If `ORIGIN` is not localhost (or the DB path is under `/var/www/`), a second
phrase is required: type `reset production`, or set `NUKE_PRODUCTION=reset production`. Does not
touch `.env`, source, or `drizzle/` migration files. Afterward you may want
`bun run createsuperuser`.

## Environment variables

Registered in [`src/env.js`](../src/env.js) and read through `$app/env/private` /
`$app/env/public`. Anything not in that registry is invisible to the app.

| Variable             | Visibility | Dev                     | Prod                 | Purpose                                                                 |
| -------------------- | ---------- | ----------------------- | -------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`       | private    | `local.db`              | `local.db`           | SQLite **file path**, not a URL                                         |
| `ORIGIN`             | private    | `http://localhost:5173` | `https://sndbnk.com` | better-auth `baseURL`; must match the browser origin exactly            |
| `PUBLIC_BASE_DOMAIN` | **public** | `localhost`             | `sndbnk.com`         | apex hostname for tenant classification                                 |
| `BETTER_AUTH_SECRET` | private    | any                     | 32+ chars            | signs sessions; changing it logs everyone out                           |
| `MEDIA_ROOT`         | private    | `./media`               | `./media`            | local upload root                                                       |
| `BODY_SIZE_LIMIT`    | private    | `110M`                  | `110M`               | max request body; the adapter default of 512K rejects uploads           |
| `STORAGE_SECRET`     | private    | any                     | 32+ chars            | encrypts BYOS credentials; changing it invalidates every stored SSH key |
| `PROTOCOL_HEADER`    | adapter    | unset                   | `X-Forwarded-Proto`  | lets the Bun adapter rebuild URLs behind Caddy                          |
| `HOST_HEADER`        | adapter    | unset                   | `X-Forwarded-Host`   | same                                                                    |

**Every variable in `src/env.js` is required** unless it declares a validator saying otherwise. A
`.env` missing one makes the app return 500 on _every_ route at boot, not just on the feature that
needs it. If your checkout predates a variable, copy it from `.env.example`.

`PROTOCOL_HEADER` and `HOST_HEADER` are read by `svelte-adapter-bun` itself, not by `src/env.js`.
Without them the app sees `http://localhost:3000` as its origin and better-auth rejects sign-ins with
`INVALID_ORIGIN` — that is the single most likely cause of "login works locally, fails in prod".

`BODY_SIZE_LIMIT` must exceed the app's own ceilings (100MB audio + 5MB cover + form overhead), or the
adapter answers `413` before `validateAudioFile()` ever runs — which presents as a broken upload form
rather than a size rejection.

**`.env` is currently committed to the repo** with live secrets, as a temporary deploy workaround.
See [known-issues.md](known-issues.md).

## Production topology

```mermaid
flowchart LR
  push["push to main"] --> gha["GitHub Actions<br/>lightsail-deploy.yml"]
  gha -->|SSH| box["Lightsail /var/www/sndbnk"]
  box --> unit["systemd sndbnk.service<br/>bun run build/index.js"]
  unit --> port["localhost:3000"]
  caddy["Caddy :443"] --> port
  apex["sndbnk.com<br/>managed certs"] --> caddy
  tenants["*.sndbnk.com + custom domains<br/>on-demand TLS"] --> caddy
```

### Deploy

`.github/workflows/lightsail-deploy.yml` triggers on push to `main` and runs one SSH script. Secrets:
`LIGHTSAIL_HOST`, `LIGHTSAIL_USERNAME`, `LIGHTSAIL_SSH_KEY`, `LIGHTSAIL_PORT`.

Steps, in order:

1. Put Bun on `PATH` explicitly — a non-interactive SSH session does not load shell rc files.
2. Snapshot the existing `.env`, `git pull --ff-only origin main`, then run a Python script that
   merges it back: `BETTER_AUTH_SECRET`, `STORAGE_SECRET`, `DATABASE_URL`, and `MEDIA_ROOT` are
   preserved from the live server, while `ORIGIN`, `PUBLIC_BASE_DOMAIN`, `PROTOCOL_HEADER`, and
   `HOST_HEADER` are forced to their production values. Missing secrets are generated, and
   `BODY_SIZE_LIMIT` is raised to `110M` if it is absent or parses below that.
3. Fix ownership and permissions on the SQLite file **and its `-wal` / `-shm` / `-journal`
   sidecars** — SQLite needs write access to all of them, and getting this wrong produces
   read-only-database errors at runtime.
4. Copy `systemd.service` from the repo to `/etc/systemd/system/sndbnk.service`, `daemon-reload`.
5. Ensure `ffmpeg` is on PATH (install via apt if missing); fail the deploy if it is still absent.
6. `bun install`, source `.env`, `bun run db:backup` (when the SQLite file exists),
   `bun run db:migrate` (Drizzle SQL under `drizzle/` via the Bun migrator), `bun run build`.
7. `systemctl restart sndbnk`, confirm `is-active`.
8. Smoke-test auth: POST a bogus credential to `http://127.0.0.1:3000/api/auth/sign-in/email` with
   `origin: https://sndbnk.com`. A `400`/`401` means the origin was accepted and the deploy passes.
   A `403 INVALID_ORIGIN` or a `500` fails the job and dumps `journalctl -u sndbnk -n 50`.

That last step is the reason production auth regressions get caught by CI rather than by users.

### The service

[`systemd.service`](../systemd.service) runs as `ubuntu` from `/var/www/sndbnk`,
`ExecStart=/home/ubuntu/.bun/bin/bun run build/index.js`, `Restart=always`, and
`EnvironmentFile=-/var/www/sndbnk/.env` (Bun also auto-loads `.env`; the `EnvironmentFile` makes the
values visible to non-Bun helpers).

Useful commands on the box:

```sh
sudo systemctl status sndbnk
sudo journalctl -u sndbnk -n 100 -f
sudo systemctl restart sndbnk
```

### Caddy

[`Caddyfile`](../Caddyfile) defines four blocks:

| Block                | Behavior                                                                        |
| -------------------- | ------------------------------------------------------------------------------- |
| global               | `on_demand_tls { ask http://127.0.0.1:3000/api/domain-tls-check }`              |
| `www.sndbnk.com`     | permanent redirect to the apex                                                  |
| `sndbnk.com`         | managed certs, gzip/zstd, security headers, `reverse_proxy localhost:3000`      |
| `https://` catch-all | `tls { on_demand }`, same proxy — serves entitled subdomains and custom domains |

All proxied requests get `X-Real-IP`, `X-Forwarded-Proto`, and `X-Forwarded-Host`. The tenant hook
reads `x-forwarded-host`, so this header is load-bearing, not cosmetic.

Security headers set on both site blocks: HSTS, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
`Permissions-Policy`, and `-Server`.

### On-demand TLS gate

Caddy will only mint a certificate for a hostname when
[`/api/domain-tls-check`](../src/routes/api/domain-tls-check/+server.js) returns `200`. It returns
`200` only for:

- `{username}.{PUBLIC_BASE_DOMAIN}` where that username exists and `canUseSubdomain(plan)` (Vault+)
- a custom hostname that matches `profile.customDomain` exactly, `canUseCustomDomain(plan)` (Studio+),
  and `customDomainStatus === 'active'`

Everything else — including the apex, which uses managed certs — gets `400`. Without this gate,
pointing any domain at the server would let it obtain a certificate.

DNS requirements: `sndbnk.com` and `*.sndbnk.com` A records at the server; a creator's custom domain
CNAMEs to `{username}.sndbnk.com` after verification.

## Troubleshooting

| Symptom                                                  | Likely cause                                                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Every route 500s with `Invalid environment variables`    | your `.env` predates a variable added to `src/env.js`; copy it from `.env.example`                                    |
| Sign-in returns `403 INVALID_ORIGIN` in prod             | `ORIGIN` mismatch, or `PROTOCOL_HEADER`/`HOST_HEADER` missing so the adapter reports `localhost:3000`                 |
| `SQLITE_READONLY` / attempt to write a readonly database | ownership or mode on the db file or its `-wal`/`-shm` sidecars                                                        |
| Cookies do not persist across a subdomain                | `crossSubDomainCookies` is disabled when `PUBLIC_BASE_DOMAIN` is `localhost`, enabled otherwise — check the value     |
| Tenant host returns 404                                  | profile missing, plan lacks subdomain/custom-domain entitlement, or `customDomainStatus` is not `active`              |
| Custom domain will not get TLS                           | `/api/domain-tls-check?domain=…` is returning `400`; hit it directly to see which check fails                         |
| Waveforms are flat placeholder bars                      | `ffmpeg` missing or decode failed — check `journalctl -u sndbnk` for `[waveform]` errors                              |
| Upload returns `413` before any validation message       | `BODY_SIZE_LIMIT` too low or unset; the adapter defaults to 512K                                                      |
| A query fails on a column that exists in `schema.js`     | the column was added to `schema.js` but no migration was generated/applied — run `bun run db:generate` + `db:migrate` |
| `bun run build` fails on `bun:sqlite`                    | something is running under Node; every command must go through Bun                                                    |

`.github/workflows/prod-auth-diagnose.yml` is a manually dispatchable diagnostic that probes env,
permissions, systemd, the build, and both the API and public HTTPS surfaces. It is marked temporary
but is the fastest way to inspect a broken production box.

## Repo hygiene

- `scratch-seed.js` and `scratch-verify.js` at the repo root are one-off probes from the tag-embedding
  work, with hardcoded `/tmp` paths. They are committed but wired to nothing. Do not build on them.
- `bun run lint` is `prettier --check .`, which covers markdown and CSS too. There is no ESLint and
  no test runner in this project.
