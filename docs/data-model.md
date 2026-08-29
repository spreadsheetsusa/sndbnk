# Data model

SQLite through Drizzle, opened with Bun's native driver. One client, exported once:

```js
// src/lib/server/db/index.js
export const db = drizzle(DATABASE_URL, { schema });
```

`DATABASE_URL` is a **filesystem path** (`local.db`), not a connection string. The module throws at
import time if it is missing, so a misconfigured deploy fails immediately rather than on first query.

Import tables from `#lib/server/db/schema` — it re-exports the auth tables, so one import covers
everything.

## Naming

| Layer       | Case                | Example                  |
| ----------- | ------------------- | ------------------------ |
| JS property | camelCase           | `customDomainStatus`     |
| SQL column  | snake_case          | `custom_domain_status`   |
| Table name  | singular snake_case | `track`, `track_comment` |

Always pass the snake_case name explicitly as the column-builder argument:
`customDomain: text('custom_domain')`. Never rely on inference.

## Column conventions

```js
id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
	.$defaultFn(() => new Date())
	.$onUpdate(() => new Date())
	.notNull()
```

- **IDs** are `text` UUIDs from `crypto.randomUUID()`, generated in JS, not by SQLite.
- **Timestamps** are `integer` with `mode: 'timestamp_ms'`, so Drizzle hands you a `Date`. Serialize
  to `.getTime()` at the route boundary — never ship a `Date` to the client.
- **Booleans** are `integer` with `mode: 'boolean'`.
- **Every user-owned row cascades**: `.references(() => user.id, { onDelete: 'cascade' })`. Deleting
  a user removes their profile, storage setting, tracks, comments, and likes with no cleanup code.
- **Enums are `text` plus a JSDoc typedef**, not a SQL constraint:
  `/** @typedef {'free' | 'vault' | 'studio' | 'label'} Plan */`. Entitlement helpers live in
  ([`billing/plans.js`](../src/lib/server/billing/plans.js)).

## Tables

### Auth — generated, do not edit

[`src/lib/server/db/auth.schema.js`](../src/lib/server/db/auth.schema.js) is written by the
better-auth CLI. Regenerate with `bun run auth:schema`; hand edits are lost. The CLI emits double
quotes and spaces, so **follow it with `bun run format`** or the file will fail lint.

| Table          | Notes                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| `user`         | `id`, `name`, `email` (unique), `emailVerified`, `image`, timestamps      |
| `session`      | `token` (unique), `expiresAt`, `ipAddress`, `userAgent`, `userId` → index |
| `account`      | credential + OAuth fields; `password` hash lives here, not on `user`      |
| `verification` | `identifier` → index, `value`, `expiresAt`                                |

These tables have no `$defaultFn` on IDs or timestamps — better-auth supplies them.

### `profile` — one per user, created at signup

`userId` is both primary key and foreign key, so the 1:1 relationship is enforced by the schema.

| Column                                     | Purpose                                                    |
| ------------------------------------------ | ---------------------------------------------------------- |
| `username`                                 | unique; the subdomain label and path segment               |
| `plan`                                     | `'free' \| 'vault' \| 'studio' \| 'label'`, default `free` |
| `customDomain`                             | unique, nullable; apex↔`www` paired at lookup time         |
| `customDomainStatus`                       | `'none' \| 'pending' \| 'active'`                          |
| `domainVerifyToken`                        | the `sndbnk-verify=…` value the owner puts in DNS TXT      |
| `customDomainVerifiedAt`                   | timestamp of the last successful verification              |
| `stripeCustomerId`, `stripeSubscriptionId` | Stripe customer / active subscription ids                  |
| `planInterval`, `subscriptionStatus`, …    | billing interval, Stripe status, or `grandfathered`        |

A user without a `profile` row is in a broken half-registered state. Loaders that need one
redirect to `/signup` rather than rendering.

### `site` — optional 1:1 tenant branding

Keyed on `userId`, lazy-created on first Settings → Site save or site-builder entry. Missing row
means fall back to profile name / bio / avatar and SNDBNK defaults. Applied on subdomain and
custom-domain hosts only; apex `/users/{username}` ignores it. Owner management lives at
`/sites/{id}` (apex only).

| Column                                      | Purpose                                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`                                        | UUID route key for `/sites/{id}` (unique; `userId` remains PK)                                                        |
| `name` / `description`                      | Tenant title and meta description                                                                                     |
| `logoFilename` / `logoMime`                 | Local-disk logo (`site-logo/`); also used as favicon when set                                                         |
| `ogImageFilename` / `ogImageMime`           | Social share image (`site-og/`); falls back to logo then avatar                                                       |
| `accentColor`                               | `#RRGGBB` tenant accent; null keeps listener/default accent                                                           |
| `appearance`                                | `light` \| `dark` \| `user` — locked modes, or visitor toggle via header blocks                                       |
| `themePersona`                              | Persona id (`mono` \| `analogous` \| `complementary` \| `split` \| `soft` \| `vivid`); seeds slot palette from accent |
| `themePalette`                              | JSON `{ primary, secondary, tertiary, surface, success, error }` hex map; null = derive from accent + persona         |
| `hideBranding`                              | Hide “Powered by SNDBNK”; honored only when `allowRemoveBranding`                                                     |
| `sidebarEnabled`                            | Master toggle for profile sidebar on **custom domains** only                                                          |
| `sidebarStats`                              | Stats card (counts, Follow, reposts); default on                                                                      |
| `sidebarFansAlsoLike`                       | Fans Also Like card; default on                                                                                       |
| `sidebarFollowers`                          | Followers card; default on                                                                                            |
| `sidebarActivity`                           | Last Comments card; default on                                                                                        |
| `setupCompletedAt`                          | Set when the `/sites/{id}` setup wizard finishes                                                                      |
| `siteIntent`                                | `tracks` \| `mixes` \| `podcast` \| `label` \| `other` (prefs)                                                        |
| `wantBlog` / `wantEvents` / `wantEcommerce` | Feature interest flags from the wizard (prefs only)                                                                   |
| `headerBlock` / `footerBlock`               | JSON `{ id, type, props }` site chrome (nullable until seeded)                                                        |

Sidebar defaults: master off, cards on (so enabling the master restores a full sidebar). Apex and
subdomain hosts ignore these flags. `resolveSidebarVisibility()` in
[`site.js`](../src/lib/server/site.js) resolves them for the profile loader.

Site chrome (header/footer) is site-wide, not per-page. `ensureSiteChrome()` seeds defaults
(`header.logo-links-cta` + `footer.minimal`, brand text from `site.name`) on setup complete and
builder load; it also lifts any legacy header/footer instances out of page `blocks`. Edited via
`PUT /api/sites/{id}/chrome`. Accent + appearance + theme persona edit via Inspector **Site** theme or
`PUT /api/sites/{id}/theme` (also Settings → Site / setup wizard).

Service: [`site.js`](../src/lib/server/site.js). Public files: `/api/site-logo/[userId]`,
`/api/site-og/[userId]`. Edit gate: Vault+ (`canUseSubdomain`) or Studio+ (`canUseCustomDomain`);
`hideBranding` needs Studio+ (`canRemoveBranding`); sidebar toggles need Studio+
(`canUseCustomDomain`).

### `site_page` — builder pages for a tenant site

Keyed on `id`; belongs to `site` via `siteId` (FK → `site.id`, cascade). Every site gets a root
page at `path = '/'` (empty `slug`) via `ensureRootPage()` when setup completes or the builder
loads. Legacy empty root pages receive one `catalog.profile` block once; `catalogSeeded` prevents
re-adding it after an artist deliberately deletes it. `parentId` is ready for a folder hierarchy;
the current UI creates flat sibling pages only.

| Column                        | Purpose                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `id`                          | UUID PK                                                                  |
| `siteId`                      | Owner site (`site.id`)                                                   |
| `parentId`                    | Optional parent page (self-FK)                                           |
| `slug` / `path`               | Root uses `''` / `'/'`; path unique per site                             |
| `title`                       | Page title (default `Home`)                                              |
| `seoTitle` / `seoDescription` | Optional SEO fields                                                      |
| `blocks`                      | JSON body blocks only (`{ id, type, props, layout? }`; no header/footer) |
| `catalogSeeded`               | One-time legacy Home catalog seed guard                                  |
| `sortOrder`                   | Sibling order                                                            |

Service: [`site-pages.js`](../src/lib/server/site-pages.js). Edited from `/sites/{id}/builder`
(`?/createPage`, `?/deletePage`, `?/updatePage` for page management;
`PUT /api/sites/{id}/pages/{pageId}/blocks` for the canvas). Root slug/path stay locked. Body types
exclude `header.*` / `footer.*` (those live on `site` chrome). Allowlist:
[`types.js`](../src/lib/components/blocks/types.js).

### `plan` — entitlement catalog

Seeded by [`scripts/migrate-sqlite.js`](../scripts/migrate-sqlite.js) as Free / Vault / Studio /
Label. Admin edits copy, prices, and flags; Stripe price ids are filled by
`bun run stripe:bootstrap`.

| Column                                      | Purpose                                                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxTracks` / `maxLocalBytes`               | Caps (`null` = unlimited). Free seeds **15 tracks** / no byte cap; paid tiers seed unlimited tracks + hosted GiB. Bytes meter **local** adapter only; track count is all adapters. |
| `allowStorageAdapters`                      | BYO (SSH today; S3/R2 later) — true on every seeded tier                                                                                                                           |
| `allowSubdomain`                            | Vault+                                                                                                                                                                             |
| `allowCustomDomain` / `allowRemoveBranding` | Studio+                                                                                                                                                                            |
| `maxTeamSeats`                              | Label team seats (UI not built yet)                                                                                                                                                |
| `monthlyAmount` / `yearlyAmount`            | Display cents; Stripe remains charging authority                                                                                                                                   |

Helpers: `canUseSubdomain`, `canUseCustomDomain`, `canUseStorageAdapters`, `canRemoveBranding`,
`hasTeamSeats` in [`billing/plans.js`](../src/lib/server/billing/plans.js). Site edit gate lives in
`canEditSite` ([`site.js`](../src/lib/server/site.js)).

### `storage_setting` — one per user, lazily created

Also keyed on `userId`. `getOrCreateStorageSetting()` inserts a default `local` row on first read,
so callers never handle a missing row. SSH credentials are stored in `sshPrivateKeyEnc` /
`sshPassphraseEnc` as AES-256-GCM blobs; optional `sshPublicBaseUrl` is plain text (HTTPS base that
mirrors `sshRemotePath` for direct browser reads) — see [media-and-storage.md](media-and-storage.md).

### `track`

Four groups of columns:

| Group               | Columns                                                                                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editable metadata   | `title` (required), `description`, `artist`, `album`, `albumArtist`, `genre` (free text; comma-separated for multiple values), `mediaType` (`track` \| `mix` \| `sample` \| `loop` \| `podcast`, default `track`), `year`, `trackNumber`, `discNumber`, `bpm`, `isrc`, `composer`, `comment` |
| Files               | `audioFilename`, `audioMime`, `audioBytes` (playback file the player serves), `originalFilename`, `originalMime`, `originalBytes` (preserved source when playback is a derivative, e.g. WAV kept after MP3 encode; null otherwise), `coverFilename`, `coverMime`, `coverBytes`               |
| Probed technical    | `durationMs`, `bitrate`, `sampleRate`, `channels`, `codec`, `encoder`, `tagTypes`, `trackGainDb`, `container`                                                                                                                                                                                |
| Derived / placement | `waveform` (JSON string of ~1000 ints), `published`, `isPrivate`, `storageAdapter`, `folderKey`                                                                                                                                                                                              |

`storageAdapter` is a **snapshot of the owner's adapter at upload time**, and `folderKey` equals the
track `id`. Reads pass the stored value back in — `getStorageAdapter(userId, row.storageAdapter)` —
so switching your storage setting never orphans existing tracks.

`published` defaults to `1`; `isPrivate` defaults to `0`. Link access (`/tracks/[id]`, media) uses
`published` — private published tracks stay reachable by URL. Public listings — profile pages, the
feed, the landing hero, sitemap, likes tabs, playlists, and discover sidebars — require
`published && !isPrivate`. The owner's library lists every track and carries Published + Private
toggles.

### `track_comment`

`atMs` optionally pins a comment to a playback position, which is what makes timeline comments
work. Indexed on `trackId`. Authors can drag their own timed-comment pins on the waveform to update
`atMs` (`PATCH /api/tracks/[id]/comments/[commentId]`); there is no `updatedAt` — repositioning is
treated as a position tweak, not an edit.

### `track_like`

Composite primary key `(trackId, userId)`, so the "one like per user" rule is a schema guarantee and
the toggle endpoint needs no uniqueness check. Indexed on `(userId, createdAt, trackId)` for the
profile Likes tab keyset, matching `track_repost`.

### `track_repost`

Same shape as `track_like` — composite primary key `(trackId, userId)` plus a
`(userId, createdAt)` index, because reposts are read back in reverse-chronological order for a
profile listing and for the Following feed. `createdAt` is the repost time, which is what a reposted
track sorts by; the track's own `createdAt` is ignored for placement. Reposting your own track is
rejected in `toggleRepost()`, not by a constraint.

### `follow`

Composite primary key `(followerId, followingId)` and an index on `followingId` for follower counts.
Self-follow is rejected in `toggleFollow()` with a result object, per the no-exceptions rule.

### `account_link`

Mutual account linking so one person can switch between moniker accounts without signing out.
`requesterId` / `recipientId` both FK to `user.id` (cascade). Status is `pending` until the recipient
accepts, then `accepted`. Unique on `(requesterId, recipientId)`; the service also rejects a second
row in the reverse direction. Cap of 4 accepted links per user (device multi-session budget). Trusted
switch after accept — no password on hop. See `#lib/server/account-links`.

### `playlist`

A named collection of published tracks owned by one user. `published` gates Feed, Profile, and
`/playlists/[id]` the same way track publishing does. Optional cover fields mirror `track`; when
absent the UI falls back to the first member’s cover. Comments are never stored on playlists —
comment chrome on a playlist card posts to the active member track.

### `playlist_track`

Composite primary key `(playlistId, trackId)` with a dense `position` (0..n-1) for order. Both FKs
cascade, so deleting a track or playlist drops membership. Only publicly listed tracks
(`published && !isPrivate`) may be added
(enforced in the service).

### `playlist_like`

Same shape as `track_like` — composite primary key `(playlistId, userId)` plus a
`(userId, createdAt, playlistId)` index for the Likes tab. Playlist likes are independent of likes
on member tracks.

## Relations

```mermaid
erDiagram
  user ||--o| profile : "1:1"
  user ||--o| site : "1:1"
  site ||--o{ site_page : "pages"
  user ||--o| storage_setting : "1:1"
  user ||--o{ track : owns
  user ||--o{ playlist : owns
  user ||--o{ session : has
  user ||--o{ account : has
  track ||--o{ track_comment : has
  track ||--o{ track_like : has
  track ||--o{ track_repost : has
  track ||--o{ playlist_track : in
  playlist ||--o{ playlist_track : contains
  playlist ||--o{ playlist_like : has
  user ||--o{ track_repost : makes
  user ||--o{ playlist_like : gives
  user ||--o{ follow : follows
  user ||--o{ account_link : links
```

Drizzle `relations()` are declared for every table but the code overwhelmingly uses explicit
`select().innerJoin()` with a projection object instead of the relational query API. Follow that:
selecting named columns keeps the wire payload honest and makes the joined shape obvious at the
call site.

```js
const rows = await db
	.select({ userId: profile.userId, username: profile.username, name: user.name })
	.from(profile)
	.innerJoin(user, eq(profile.userId, user.id))
	.where(eq(profile.username, username))
	.limit(1);

return rows[0] ?? null;
```

Single-row lookups always `.limit(1)` and return `rows[0] ?? null`. Callers decide whether `null`
means 404, redirect, or lazy create.

## Query patterns

- **Ownership gate for mutations.** `getOwnedTrack(userId, trackId)` filters on both columns; there
  is no "fetch then compare" step to forget.
- **Public reads are separate functions.** `getTrackById`, `getTrackWithUploader`,
  `listTracksWithUploader` — no viewer identity required.
- **Batch the social counts.** `getSocialForTracks(trackIds, viewerId)` returns a
  `Map<trackId, { likeCount, commentCount, likedByViewer }>` so a profile page with 40 tracks does
  not fire 40 queries. Add new per-track aggregates to that map rather than looping.

## Changing the schema

sndbnk uses **Drizzle Kit generate + migrate** (codebase-first). The human-facing walkthrough is the
standalone page [`docs/drizzle-migrations.html`](drizzle-migrations.html).

1. Edit [`src/lib/server/db/schema.js`](../src/lib/server/db/schema.js) (auth tables: regenerate with
   `bun run auth:schema && bun run format` first).
2. `bun run db:generate` — writes SQL under [`drizzle/`](../drizzle/) plus a snapshot in
   `drizzle/meta/`. Commit those files with the schema change.
3. **Review the SQL.** Renames may show up as drop+add; `NOT NULL` without a default fails on SQLite
   for existing rows.
4. Apply locally: `bun run db:migrate`.
5. Verify: `bun run dev` and exercise the affected surface.

Production deploy runs `bun run db:backup` (when the DB file exists) then `bun run db:migrate` before
build/restart.

### Why migrate is a Bun script

`drizzle-kit migrate` / `push` / `studio` load `better-sqlite3`, which Bun cannot open. Generate still
uses Drizzle Kit; apply uses [`scripts/migrate-sqlite.js`](../scripts/migrate-sqlite.js) and
`drizzle-orm/bun-sqlite/migrator`. `bun run db:push:kit` and `bun run db:studio` run the Kit CLI
under Node for local prototyping / browsing. The old hand-written
[`scripts/push-sqlite-schema.js`](../scripts/push-sqlite-schema.js) is retired and exits with
instructions.

Existing databases created before `drizzle/` existed are cut over automatically: if app tables are
present and `__drizzle_migrations` is empty, the migrate script records `0000_baseline` as applied
without re-running its `CREATE TABLE` statements, then applies any newer migrations.

### Adding a column

Prefer nullable columns (or supply a `DEFAULT`). SQLite's `ADD COLUMN` cannot add `NOT NULL` without
a default on a table that already has rows. Generate the migration, read the `ALTER TABLE`, migrate
locally, then ship.
