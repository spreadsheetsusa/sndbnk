# Design system

Brutalist and print-inspired: hard 1px ink borders, zero border-radius, offset drop shadows instead
of blur, a single acid-lime accent, and a paper-textured grid background. Display type carries
chromatic aberration; interactive marks glitch on hover.

All of it comes from CSS custom properties defined once in
[`src/routes/layout.css`](../src/routes/layout.css) and consumed by component-scoped `<style>`
blocks.

## Tokens

Defined on `:root`, overridden on `.dark`.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--accent` | `#c8ff3d` | inherited | CTA fills, waveform progress, focus glow |
| `--on-accent` | `#11110f` | inherited | text on an accent fill |
| `--ink` | `#11110f` | `#f2f0e8` | text, borders, shadows |
| `--paper` | `#f2f0e8` | `#141410` | page background |
| `--muted` | `#696861` | `#a8a69c` | secondary copy |
| `--inverse` | `#11110f` | `#050504` | inverted panels (auth intro, eyebrow chips) |
| `--on-inverse` | `#f2f0e8` | `#f2f0e8` | text on an inverted panel |
| `--chroma-red` | `#ff2f4f` | `#ff5a72` | left aberration fringe |
| `--chroma-cyan` | `#21e0ff` | `#57e9ff` | right aberration fringe |
| `--chroma-offset` | `0.022em` | — | heading fringe distance |
| `--glitch-offset` | `0.075em` | — | hover glitch fringe distance |
| `--glitch-blend` | `multiply` | `screen` | blend mode for glitch copies |

Layout rail:

| Token | Value | Use |
| --- | --- | --- |
| `--site-shell-max` | `1600px` | outer page width, shared by header and pages so nothing shifts |
| `--site-shell-pad-x` | `clamp(1rem, 3.5vw, 4rem)`, `1rem` under 620px | horizontal gutter |
| `--site-content-max` | `920px` | main reading column |
| `--site-content-max-wide` | `1100px` | profile pages |

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

## Typography

Three tiers, deliberately different voices:

| Tier | Font | Class / selector | Where |
| --- | --- | --- | --- |
| Display | Audiowide | `.display-face` | wordmark, hero `h1` |
| Editorial | Georgia | `h2` in forms and settings | section titles |
| Body | Inter | `:root` default | everything else |
| Micro-label | Inter 800 | `.eyebrow` | uppercase, `0.15em` tracking |

Audiowide is loaded via `@import url(…fonts.googleapis.com…)` at the top of `layout.css`; `:root` sets
`font-synthesis: none` so no faux bold appears.

## Utilities

Global, defined in `layout.css`:

| Class | Effect |
| --- | --- |
| `.display-face` | Audiowide, uppercase, tight tracking |
| `.eyebrow` | uppercase micro-label |
| `.eyebrow-chip` | in light mode only, wraps accent text in an inverse chip via `box-shadow` spread |
| `.accent-fill` / `.accent-text` / `.accent-border` | apply the accent to background / color / border |
| `.pressable` | tactile press: shadow collapses to `1px` and the element translates `4px, 4px` |
| `.glitch-mark` | hover/focus chromatic split plus a bursty slice animation |
| `.theme-transition` | added to `<html>` during a theme flip |

### `.pressable`

Give any button that is meant to feel physical the class, plus the ink border and `5px 5px 0 var(--ink)`
shadow in its own scoped styles. The transition and `:active` handling come free, and
`:not(:disabled)` keeps a disabled button from moving.

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
- **Expose knobs as custom properties** rather than adding boolean props. `SiteHeader` accepts
  `--site-header-gap`, which the landing page sets to `0`:
  `<SiteHeader --site-header-gap="0" />`.
- **Focus is never removed.** `:focus-visible` gets a `2px solid var(--ink)` outline with `3px`
  offset globally; if you restyle focus, keep it at least that visible.
- **Inputs and buttons are square** — `border-radius: 0`, `1px solid var(--ink)`. Inputs show focus
  as `box-shadow: 4px 4px 0 var(--accent)`.

## Waveforms

Two flavors, both drawn in accent over ink:

- **Real playback**: wavesurfer.js bar chart, `barWidth: 2`, `barGap: 1`, `barRadius: 0`,
  `cursorWidth: 0`. Unplayed bars are ink at 32% alpha, played bars are accent.
- **Decorative**: hand-authored SVG paths with `stroke: var(--accent)`, `vector-effect: non-scaling-stroke`,
  low opacity — behind auth panels and profile names.

Canvas cannot read CSS custom properties, so `Waveform.svelte` resolves `--ink` and `--accent` from
`getComputedStyle(container)` and converts hex to `rgba()` itself. This is the sanctioned exception
to "no color logic in components", and it is why the theme flip needs an explicit effect to re-apply
colors.
