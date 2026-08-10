# Routing and forms

## Route map

No nested layouts, no route groups, no `+error.svelte`. One root layout and a flat set of routes.

| Route                              | Auth                   | What it does                                                                                                |
| ---------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/`                                | optional               | Marketing landing on apex; the owner's public profile on a tenant host                                      |
| `/signin`, `/signup`               | redirects if signed in | email/password auth, then `303 → /`                                                                         |
| `/forgot-password`                 | redirects if signed in | request a reset email (generic success; no enumeration)                                                     |
| `/reset-password`                  | redirects if signed in | set a new password from the emailed token, then `303 → /signin?reset=1`                                     |
| `/settings`                        | required               | tabbed profile (incl. email change) / linked accounts / plan / domain / site / storage                      |
| `/sites/[id]`                      | owner only (apex)      | first-run site setup wizard; redirects to builder when `setupCompletedAt` is set                            |
| `/sites/[id]/builder`              | owner only (apex)      | site builder workspace (root page + draggable HUDs); redirects back to setup when incomplete                |
| `/library`                         | required               | owner track list; drop/picker upload via `?/create`; `?mediaType=` filters; `?track=` + `?edit=1` deck edit |
| `/library/new`                     | required               | redirects to `/library` (former LOAD console)                                                               |
| `/library/[id]`                    | owner only             | redirects to `/library?track={id}&edit=1`                                                                   |
| `/tracks/[id]`                     | public                 | track detail with waveform and comments                                                                     |
| `/playlists/new`                   | required               | create a playlist                                                                                           |
| `/playlists/[id]`                  | public                 | playlist detail (waveform + member list)                                                                    |
| `/playlists/[id]/edit`             | owner only             | edit metadata, reorder/remove members                                                                       |
| `/users/[username]`                | public                 | public profile by path                                                                                      |
| `/admin`                           | admin only (apex)      | Plans, discounts, users, site play thresholds, business-planning docs                                       |
| `/admin/docs/[slug]`               | admin only (apex)      | Serves `docs/*.html` briefs (plan, finance, migrations)                                                     |
| `/privacy`, `/terms`, `/copyright` | public (apex)          | Privacy Policy, Terms of Service, Copyright / DMCA                                                          |
| `/api/media/[id]/[file]`           | public                 | audio/cover streaming with Range support                                                                    |
| `/api/tracks`                      | mixed                  | paged feed/library/profile/likes/history (`{ items, nextCursor }`)                                          |
| `/api/tracks/[id]`                 | required               | `DELETE` a track                                                                                            |
| `/api/tracks/[id]/like`            | required               | `POST` toggles a like                                                                                       |
| `/api/tracks/[id]/play`            | public                 | `POST` records a play (`{ playCount }`); history when signed in                                             |
| `/api/tracks/[id]/comments`        | mixed                  | `GET` timed comments for markers; `POST` adds a comment (auth)                                              |
| `/api/tracks/[id]/comments/[id]`   | required (author)      | `PATCH` repositions timed `atMs`; `DELETE` removes own comment                                              |
| `/api/playlists`                   | required               | `GET ?mine=1` owner playlist picker                                                                         |
| `/api/playlists/[id]`              | required               | `DELETE` a playlist                                                                                         |
| `/api/playlists/[id]/like`         | required               | `POST` toggles a playlist like                                                                              |
| `/api/playlists/[id]/tracks`       | required               | `POST`/`DELETE`/`PATCH` membership                                                                          |
| `/api/domain-tls-check`            | internal               | Caddy on-demand TLS gate                                                                                    |

`/settings`, `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/library`, `/sites`, and
`/api/domain-tls-check` 404 on tenant hosts. See [architecture.md](architecture.md).

**Site builder** (`/sites/[id]/builder`): Vault+ owner only. Load ensures a root `site_page` and site
chrome (`ensureSiteChrome`), returns `site` (with `header` / `footer`), `pages` + `currentPageId`
(each page includes parsed body `blocks`), and mounts SNDBNK-styled draggable HUDs (toolbar,
inspector, blocks palette). Named action `?/updatePage` saves page title / slug / SEO (root path
stays `/`). Canvas body blocks drag from the Blocks HUD — insertable categories are Blog, Contact,
Content, CTA, Ecommerce, Feature, Gallery, Hero, Pricing, Statistic, Step, Team, and Testimonial
(Header/Footer stay site chrome only). `PUT /api/sites/[id]/pages/[pageId]/blocks` persists the
ordered body list. Site header/footer render outside the page stack on every page preview;
Inspector **Site** tab picks layouts and edits props via `PUT /api/sites/[id]/chrome`. Inspector
**Block** tab edits the selected body instance.

## `load` conventions

**Guard first, then fetch.** Auth guards are one-liners at the top:

```js
export async function load({ locals }) {
	if (!locals.user) safeRedirect(302, '/signin');

	const profileRow = await getProfileByUserId(locals.user.id);
	if (!profileRow) safeRedirect(302, '/signup');
	// …
}
```

`safeRedirect()` returns `never`, so control flow reads like an early return and the type narrowing
holds afterwards.

**Return a flat, serializable shape.** Convert `Date` to milliseconds, pick explicit fields, and
never return a raw DB row where the page only needs three columns. `/settings` is the widest
example: `{ user, profile, site, urls, baseDomain, billing, storageAdapters, storage }`.

**Discriminate modes with a literal.** The root page serves two entirely different views, tagged so
the component can branch on one field:

```js
return locals.tenant
	? { mode: 'tenant-profile', ...profilePage }
	: { mode: 'marketing', user, authNotice };
```

**404 with `error()`, not `null`.** Service functions return `null` for "not found"; the loader
converts: `if (!row) error(404, 'Track not found')`.

## Form actions

### Naming

- A route with one form uses the `default` action and omits the `action` attribute.
- A route with several forms uses **named actions**: `action="?/updateProfile&tab=profile"`. The
  extra query param survives the POST/redirect cycle so `/settings` reopens on the tab you
  submitted from — this is why tab state lives in the URL rather than in a rune.

### Per-section failure keys

`fail()` data lands on the page as the `form` prop, and there is only one `form` prop no matter how
many forms are on the page. So each section of `/settings` owns a distinct key —
`profileMessage`, `planMessage`, `domainMessage`, `storageMessage`, with matching
`profileSuccess` / `planSuccess` / `domainSuccess` / `storageSuccess` — and a failed domain save
cannot render an error above the storage form.

Single-form routes just use `message`.

### Echo the submitted values back

`fail()` carries the user's input so the form repopulates without client-side state:

```js
if (!email || !password) {
	return fail(400, { message: 'Enter your email and password.', email });
}
```

Passwords are never echoed.

### `fail` vs `error` vs `safeRedirect`

| Situation                       | Use                                                               |
| ------------------------------- | ----------------------------------------------------------------- |
| Invalid user input, recoverable | `fail(400, { … })`                                                |
| Not authorized for this action  | `fail(403, { … })` in a form action; `error(401)` in an API route |
| Resource does not exist         | `error(404, '…')`                                                 |
| Unexpected failure              | `fail(500, { message: 'Something went wrong.' })`                 |
| Success that changes location   | `safeRedirect(303, '/library/…')`                                 |

Never `throw redirect()` from `@sveltejs/kit` — always `safeRedirect()`.

## Progressive enhancement

Every form uses `use:enhance` with a busy flag and `try/finally`. The `finally` matters: without it
a thrown update leaves the button disabled forever.

```js
let submitting = $state(false);

function handleSubmit() {
	submitting = true;

	return async ({ update }) => {
		try {
			await update();
		} finally {
			submitting = false;
		}
	};
}
```

For pages with several forms, one factory produces the handler so the flags stay colocated:

```js
function busyHandler(which) {
	return () => {
		if (which === 'profile') profileBusy = true;
		// …
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				if (which === 'profile') profileBusy = false;
			}
		};
	};
}
```

`update({ reset: false })` on long forms (upload, track edit) keeps the user's typing. Those pages
also inspect `result.type === 'failure'` and merge `result.data` back into their local field state.

## Form action or `fetch`?

Both exist, and the split is deliberate:

| Use a **form action** when                           | Use **`fetch` to `/api/*`** when                              |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| the operation belongs in history or changes location | the change is in-place and local to one card                  |
| you want it to work without JS                       | JS is already required (it is a button inside a player)       |
| the page needs fresh `load` data afterwards          | invalidating the whole page would be wasteful                 |
| examples: auth, settings, upload, track edit         | examples: like toggle, add comment, delete from the card menu |

Library upload is a named form action (`?/create`) posted from the page drop/picker (no separate
upload route). Track edit is `?/update` on the same page and expands the library deck; an optional
`writeTags=1` field embeds form metadata into the audio file after a successful save.
Track deletion is `DELETE /api/tracks/[id]` from the library row / card menu (same
`deleteTrackForUser()` service).

## API endpoints

Small and uniform. Guard, load, mutate, return `json()`:

```js
export async function POST({ locals, params }) {
	if (!locals.user) error(401, 'Sign in to like tracks.');

	const row = await getTrackById(params.id);
	if (!row) error(404, 'Track not found');
	// … toggle, then:
	return json({ liked, likeCount });
}
```

- Errors use Kit's `error()`, never a `200` with `{ error }` in the body. Clients check `res.ok`.
- Responses return the **new authoritative state** (`{ liked, likeCount }`), not just `{ ok: true }`,
  so the client can replace its optimistic guess rather than recompute.
- `/api/media/[id]/[file]` is intentionally unauthenticated — tracks are playable from public
  profiles. It sets `accept-ranges` and `cache-control: private, max-age=3600`, and answers a
  `Range` header with a `206` and a lazily sliced body so local files are never read in full.

## Accessibility baseline

Copy these patterns; they are already consistent across every form.

- Error containers: `role="alert"` `aria-live="polite"`. Success: `role="status"`.
- Hide messages while a submit is in flight — `{#if form?.message && !submitting}` — so a stale
  error is not read out during the retry.
- Invalid inputs get `aria-invalid="true"` and `aria-describedby` pointing at the error container's
  id, both conditional on the same `form?.message && !submitting` expression.
- The `<form>` carries `aria-busy={submitting}`.
- Buttons state their own progress: `{submitting ? 'Signing in…' : 'Sign in'}`, and are
  `disabled` while busy.
- Sections use `aria-labelledby` pointing at their heading; standalone forms use `aria-label`.
- The settings tab bar implements `role="tablist"` / `tab` / `tabpanel` with arrow-key navigation.
- Decorative SVG gets `aria-hidden="true"`; meaningful SVG gets `role="img"` and a label.
