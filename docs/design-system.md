# Design system

Brutalist and print-inspired: hard 1px ink borders, zero border-radius, offset drop shadows instead
of blur, a single acid-lime accent, and a paper-textured grid background. Display type carries
chromatic aberration; interactive marks glitch on hover.

All of it comes from CSS custom properties defined once in
[`src/routes/layout.css`](../src/routes/layout.css) and consumed by component-scoped `<style>`
blocks.

## Tokens

Defined on `:root`, overridden on `.dark`.

| Token             | Light                   | Dark                     | Use                                         |
| ----------------- | ----------------------- | ------------------------ | ------------------------------------------- |
| `--accent`        | `#c8ff3d`               | inherited                | CTA fills, waveform progress, focus glow    |
| `--on-accent`     | `#11110f`               | inherited                | text on an accent fill                      |
| `--ink`           | `#11110f`               | `#f2f0e8`                | text, borders, shadows                      |
| `--paper`         | `#f2f0e8`               | `#141410`                | page background                             |
| `--muted`         | `#696861`               | `#a8a69c`                | secondary copy                              |
| `--inverse`       | `#11110f`               | `#050504`                | inverted panels (auth intro, eyebrow chips) |
| `--on-inverse`    | `#f2f0e8`               | `#f2f0e8`                | text on an inverted panel                   |
| `--hard-border`   | `var(--ink)`            | `var(--accent)`          | raised panel/menu edges                     |
| `--hard-shadow`   | `var(--ink)`            | accent @ 48% into black  | offset block shadows on raised surfaces     |
| `--cover-shadow`  | `var(--ink)`            | ink @ 28% transparent    | offset shadows on cover art only            |
| `--field-border`  | accent darkened + muted | same recipe, darker mix  | resting borders on inputs/textareas/selects |
| `--field-surface` | accent @ 7% transparent | accent @ 10% transparent | light wash behind form controls             |
| `--chroma-red`    | `#ff2f4f`               | `#ff5a72`                | left aberration fringe                      |
| `--chroma-cyan`   | `#21e0ff`               | `#57e9ff`                | right aberration fringe                     |
| `--chroma-offset` | `0.022em`               | —                        | heading fringe distance                     |
| `--glitch-offset` | `0.075em`               | —                        | hover glitch fringe distance                |
| `--glitch-blend`  | `multiply`              | `screen`                 | blend mode for glitch copies                |

Layout rail:

| Token                     | Value                                            | Use                                                            |
| ------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| `--site-shell-max`        | `1600px`                                         | outer page width, shared by header and pages so nothing shifts |
| `--site-shell-pad-x`      | `clamp(1rem, 3.5vw, 4rem)`, `0.5rem` under 640px | horizontal gutter (header + pages share it)                    |
| `--site-content-max`      | `920px`                                          | main reading column                                            |
| `--site-content-max-wide` | `1100px`                                         | profile pages                                                  |
| `--site-header-height`    | `5rem`                                           | sticky header min-height                                       |
| `--site-header-gap`       | `clamp(0.75rem, 2vw, 1.25rem)`                   | space below the header before page content                     |
| `--site-sidebar-width`    | `20rem`                                          | card sidebar rail on feed/list pages                           |
| `--tap-min`               | `2.75rem` (44px)                                 | minimum comfortable touch target under `pointer: coarse`       |
| `--waveform-height`       | `66px` / `88px` on coarse                        | scrub band height for Waveform and its placeholders            |
| `--track-card-wash`       | `0.5` light / `0.38` dark                        | opacity of the blurred cover behind TrackCard on phones        |

## Breakpoints

Layout changes use width queries; hit-target growth uses `@media (pointer: coarse)` so a narrow
desktop window never inflates controls. Four width rungs:

| Breakpoint | Use                                                          |
| ---------- | ------------------------------------------------------------ |
| `560px`    | phone-narrow: icon-only nav, most aggressive trimming        |
| `640px`    | phone: card/row reflow, banner trimming, single-column forms |
| `960px`    | narrow: sidebars stack; header player becomes two-row strip  |
| `1200px`   | wide-compact layouts (header player keeps now-playing)       |

**Never hardcode a color outside `layout.css`.** Use `var(--ink)` and friends, and reach for
`color-mix(in srgb, var(--ink) 32%, transparent)` for tints rather than inventing a new hex. The one
justified exception is canvas rendering — see the waveform note below.

## Dark mode

Class-based, on `<html>`, wired through a Tailwind v4 custom variant:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Three pieces make it flicker-free and animated:

1. **Pre-paint script** in [`src/app.html`](../src/app.html) reads `localStorage.theme`, falls back
   to `prefers-color-scheme`, and toggles `.dark` plus `style.colorScheme` before first paint. It is
   inline and synchronous on purpose — moving it would reintroduce a flash.
2. **[`src/lib/stores/theme.js`](../src/lib/stores/theme.js)** owns the runtime switch:
   `initTheme()` from the root layout's `onMount`, `toggleTheme()` from `ThemeToggle`, and a
   `matchMedia` listener that follows the OS while the preference is `system`.
3. **`.theme-transition`** is added to `<html>` for 320ms around a flip. Custom properties cannot
   animate, so this class blanket-transitions `background-color`, `border-color`, `color`,
   `box-shadow`, `fill`, and `stroke` for the duration, then removes itself. It is skipped entirely
   under `prefers-reduced-motion`.

Anything you build must be checked in both themes. Accent-on-paper is the trap: lime text on warm
paper fails contrast, which is why `.eyebrow-chip` exists.

## Accent

[`src/lib/stores/brand.js`](../src/lib/stores/brand.js) owns `--accent` and `--on-accent` the same
way `theme.js` owns `.dark`: a pre-paint script in [`src/app.html`](../src/app.html) restores the
stored choice, `initAccent()` re-applies it on mount, and `setAccent()` / `setCustomAccent()` write
both custom properties onto `documentElement`.

Four presets live in `ACCENTS` with a hardcoded `onAccent`. The fifth, `CUSTOM_ACCENT_ID`, is any
hex the user picks: it is stored separately under `accent-custom`, and its `--on-accent` is computed
by `onAccentFor()`, which returns ink or paper depending on which gives better WCAG contrast against
the fill. The account menu renders it as a conic-gradient wheel swatch that slides
[`AccentPicker.svelte`](../src/lib/components/AccentPicker.svelte) open beneath the row; every drag
commits immediately, so the whole site recolors live.

**`--accent` must always be a `#rrggbb` string.** `Waveform.svelte` reads it back through
`getComputedStyle` and parses the hex itself, so `normalizeHex()` is the only door into the custom
value.

## Typography

Four roles, tokenized on `:root` so a rebrand is one swap in `layout.css` (+ the Google Fonts
`@import`):

| Tier        | Font          | Token / selector                    | Where                        |
| ----------- | ------------- | ----------------------------------- | ---------------------------- |
| Display     | Audiowide     | `--font-display` / `.display-face`  | wordmark, hero `h1`          |
| Editorial   | Space Grotesk | `--font-editorial`                  | section titles, form heads   |
| Body        | KoHo          | `--font-body` / `:root` default     | paragraphs, lists, chrome    |
| LCD         | Jersey 20     | `--font-lcd` / `.lcd-face`          | global player now-playing    |
| Micro-label | body @ 800    | `.eyebrow` (inherits `--font-body`) | uppercase, `0.15em` tracking |

Fonts load via `@import url(…fonts.googleapis.com…)` at the top of `layout.css`; `:root` sets
`font-synthesis: none` so no faux bold appears. Components should use the tokens (or utilities),
not hardcode family names.

## Utilities

Global, defined in `layout.css`:

| Class                                              | Effect                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `.display-face`                                    | Audiowide (`--font-display`), uppercase, tight tracking                          |
| `.lcd-face`                                        | Jersey 20 (`--font-lcd`) for Winamp-style LCD readouts                           |
| `.eyebrow`                                         | uppercase micro-label                                                            |
| `.eyebrow-chip`                                    | in light mode only, wraps accent text in an inverse chip via `box-shadow` spread |
| `.accent-fill` / `.accent-text` / `.accent-border` | apply the accent to background / color / border                                  |
| `.pressable`                                       | tactile press: shadow collapses to `1px` and the element translates `4px, 4px`   |
| `.glitch-mark`                                     | hover/focus chromatic split plus a bursty slice animation                        |
| `.theme-transition`                                | added to `<html>` during a theme flip                                            |

### `.pressable`

Give any button that is meant to feel physical the class, plus a border and
`5px 5px 0 var(--hard-shadow)` in its own scoped styles. Accent-filled buttons keep
`border: 1px solid var(--ink)`; paper/ghost raised controls use `var(--hard-border)`. The
transition and `:active` handling come free, and `:not(:disabled)` keeps a disabled button from
moving.

### `.glitch-mark`

Needs `data-text` matching its visible text — the pseudo-elements render `attr(data-text)` as
offset cyan/red copies:

```svelte
<a class="logo display-face glitch-mark" data-text="SNDBNK" href="/">SNDBNK</a>
```

The keyframes sit at `inset(50% 0 50% 0)` (fully collapsed) most of the loop, so the effect reads as
occasional bursts rather than a constant wobble.

### Chromatic aberration on headings

`h1.display-face` gets fringes automatically via `filter: drop-shadow(…)` — `drop-shadow` rather
than `text-shadow` so outline-only headings keep a transparent fill. You do not add anything; use
`h1.display-face` and it happens.

## Motion and reduced motion

`prefers-reduced-motion: reduce` collapses all animation and transition durations to `0.01ms`, drops
the glitch loop while keeping its static color split, and disables smooth scrolling. New animation
inherits this automatically through the global rule — but if you add JS-driven motion, check
`window.matchMedia('(prefers-reduced-motion: reduce)')` the way `theme.js` does.

## Component styling rules

- **Scoped `<style>` in the component**, semantic class names (`.auth-intro`, `.form-error`,
  `.dns-actions`) rather than utility soup.
- **Tailwind is installed but essentially unused in components.** `@import 'tailwindcss'` is present
  and `prettier-plugin-tailwindcss` will sort classes if you write them, but the design language is
  custom properties. Do not convert existing scoped CSS to utilities, and prefer scoped CSS for new
  work so the codebase stays one thing.
- **Expose knobs as custom properties** rather than adding boolean props. `SiteHeader` reads
  `--site-header-gap` (default on `:root` in `layout.css`); the landing page overrides it to `0`:
  `<SiteHeader --site-header-gap="0" />`.
- **Focus is never removed.** `:focus-visible` gets a `2px solid var(--ink)` outline with `3px`
  offset globally; if you restyle focus, keep it at least that visible.
- **Inputs and buttons are square** — `border-radius: 0`. Text controls rest on
  `1px solid var(--field-border)` with `background: var(--field-surface)` so they pick up the
  accent without competing with CTAs; buttons stay on ink / `--hard-border`. Inputs show focus as
  `box-shadow: 4px 4px 0 var(--accent)`.

## Waveforms

Two flavors, both drawn in accent over ink:

- **Real playback**: wavesurfer.js bar chart, `barWidth: 2`, `barGap: 1`, `barRadius: 0`,
  `cursorWidth: 0`. Unplayed bars are ink at 32% alpha, played bars are the accent hex (two-tone
  lower half mixed toward ink). Hovering shows a second opaque fill (accent mixed 40% toward white)
  from the left edge to the cursor without moving the playhead; TrackCard also reveals its comment
  form from that same waveform hover.
- **Decorative**: hand-authored SVG paths with `stroke: var(--accent)`, `vector-effect: non-scaling-stroke`,
  low opacity — behind auth panels and profile names.

`/library` is the exception to per-track waveforms: it is a file manager, so the rows
(`LibraryTrackRow`) are a compact table and the single waveform lives in `LibraryDeck` above the
list, fed by whichever row was last selected or played. The header strip and the rows share the
`--library-grid` column template set on `.track-table`, so changing columns means changing it once.

Canvas cannot read CSS custom properties, so `Waveform.svelte` takes the accent hex from the
`accentColor` store and resolves `--ink` / `--paper` from `getComputedStyle(container)`, converting
to canvas fills itself. This is the sanctioned exception to "no color logic in components", and it is
why theme and accent changes need an explicit effect to re-apply colors.
