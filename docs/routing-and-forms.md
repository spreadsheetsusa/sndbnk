# Routing and forms

## Route map

No nested layouts, no route groups, no `+error.svelte`. One root layout and a flat set of routes.

| Route                       | Auth                   | What it does                                                                  |
| --------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| `/`                         | optional               | Marketing landing on apex; the owner's public profile on a tenant host        |
| `/signin`, `/signup`        | redirects if signed in | email/password auth, then `303 → /`                                           |
| `/forgot-password`          | redirects if signed in | request a reset email (generic success; no enumeration)                       |
| `/reset-password`           | redirects if signed in | set a new password from the emailed token, then `303 → /signin?reset=1`       |
| `/settings`                 | required               | tabbed profile (incl. email change via verify link) / plan / domain / storage |
| `/library`                  | required               | the owner's track list                                                        |
| `/library/new`              | required               | upload form                                                                   |
| `/library/[id]`             | owner only             | edit metadata, embed tags, delete                                             |
| `/tracks/[id]`              | public                 | track detail with waveform and comments                                       |
| `/users/[username]`         | public                 | public profile by path                                                        |
| `/api/media/[id]/[file]`    | public                 | audio/cover streaming with Range support                                      |
| `/api/tracks/[id]`          | required               | `DELETE` a track                                                              |
| `/api/tracks/[id]/like`     | required               | `POST` toggles a like                                                         |
| `/api/tracks/[id]/comments` | required               | `POST` adds a comment                                                         |
| `/api/domain-tls-check`     | internal               | Caddy on-demand TLS gate                                                      |

`/settings`, `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/library`, and
`/api/domain-tls-check` 404 on tenant hosts. See [architecture.md](architecture.md).

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
example: `{ user, profile, urls, baseDomain, planDetails, storageAdapters, storage }`.

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

Track deletion exists on both paths — the form action on `/library/[id]` redirects to `/library`,
the `DELETE` endpoint serves the inline card menu. Both call the same
`deleteTrackForUser()`, which is what keeps them honest.

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
