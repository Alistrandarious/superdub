# Superdub — Design System

> Lightweight reference for future prompts. The **binding guide is
> `Superdub Swatches.pdf`** (V2 — The Ascension) in the repo root. Tokens live in
> `src/theme.ts` (accents) and the `:root` block of `src/App.css` (surfaces,
> radii, fonts). **No ad-hoc hexes** — every page root takes `--theme` from
> `theme.ts` via `pageTheme()`.

## Colour — meaning is the rule

Colour carries semantics, not decoration. Source: `src/theme.ts`.

| Token | Hex | Means |
|---|---|---|
| `HEALTH` | `#2FD27E` | primary green — habits, food, the body |
| `TEAL` | `#19C5B0` | bridge — mood / check-in surfaces |
| `GROWTH` | `#2E8BFF` | blue — trends, plans, progress, profile |
| `GOLD` | `#FFB928` | **ascension only** — XP, levels, rewards |
| `VIOLET` | `#8B5CF6` | rare rank — goals, milestones |
| `FLAME` | `#FF8A00` | streak / energy |
| `DANGER` | `#FF5470` | over target / off pace |

Per-page theming: set the page-root style with `pageTheme(color)`, which emits
`--theme`, `--theme-dim` (`+66` alpha), `--theme-glow` (`+14` alpha). Components
read `var(--theme)` — never hardcode the accent inside a component.

### Signature gradients (`App.css :root`)
- `--grad-brand` green→blue `#2FD27E → #2E8BFF` (flagship / wordmark)
- `--grad-health`, `--grad-growth`, `--grad-ascension` (gold `#FFB928 → #FFE08A`)

### Cosmetic rewards
- Dub colours live in `DUB_COLORS` (`src/levels.ts`). **Aurora White** (`id: 'white'`,
  body `#FFFFFF → #E6ECF5`, gold accent) is the community reward: it unlocks when The
  Global habit's shared total hits 10k and the user has personally added ≥100 XP. It is
  made available in the Level-page swatch shelf, never auto-equipped.

## Surfaces — dark, glass, navy-black

Single source in `App.css :root`; prefer the semantic aliases going forward.

| Token | Value | Use |
|---|---|---|
| `--void` | `#07090C` | app background floor |
| `--glass-bg` / `--surface` | `#0E0E14` | base card / panel |
| `--glass-bg-strong` / `--surface-raised` | `#15151E` | modals, elevated |
| `--glass-border` / `--line` | `#252532` | default hairline |
| `--glass-border-strong` | `#16323E` | emphasised border |
| `--glass-shadow` | `0 4px 24px rgba(0,0,0,0.5)` | card shadow |

## Radius scale

`--r-xs 6` · `--r-sm 10` · `--r-md 12` · `--r-lg 16` · `--r-xl 20` ·
**`--r-card 18`** (every page-level card/section) · `--r-pill 999px`.
Spacing gutter: `--gutter: 16px`.

## Typography

Three families (`App.css` `--font-*`):
- **`--font-display` = Kanit** — headings. H1/wordmark/greetings: *italic 800*
  (signature voice). H2/titles: upright 700.
- **`--font-ui` = Sora** — body, buttons, inputs, H3/H4 (600).
- **`--font-data` = Space Mono** — **all numbers**, data grids, and section
  eyebrows (700 caps, letter-spaced ~0.14em).

Section header pattern: Space Mono 700 caps eyebrow + hairline rule.

## Iconography & chrome rules (hard constraints)

- **No emoji in UI chrome** — menu items, section headers, badges, icons. Use
  ~15px stroke SVGs (feather-style, `stroke="currentColor"`, `strokeWidth` ~2).
  Emoji is OK *only* as content inside Dub's coach messages / articles.
- No generic grey-glass tile grids ("cheapens the app").
- Reward/theme references show the **actual gradient swatch**, not an icon.
- Numbers are always Space Mono; accents always semantic.

## Layout constraints

- Mobile-first single column; fixed **`BottomNav`** (5 items: Progress · Plan ·
  Habits[center] · Success Kit · Lists). Nav glow + center-button colour are
  user-customisable via `superdub.navGlow` / `superdub.habitsColor`.
- **Flex-collapse pitfall:** column-flex scroll shells crush `overflow:hidden`
  children — add `flex-shrink: 0` guards. Empty preview data can mask this.
- Overlays (`DailyCheckIn`, `EnergyCheckIn`, `StepEntry`, `CoachReport`,
  `LevelUpCelebration`, `UpdateBanner`) mount above the router, outside `<Routes>`.

### Pop-up law — full screen, never see-through

**A pop-up is never translucent.** Every one is its own full screen: the opaque
`--void` ground edge to edge, no scrim, no `backdrop-filter`, no card floating on
a dimmed page. Nothing behind it reads through.

- The ground is `var(--void)`; the panel is `background: transparent`, no border,
  no radius, no shadow — the void _is_ the surface.
- Long pop-ups stretch to the full height and scroll inside themselves; short ones
  (confirm, honesty, goal reached, level up) centre on the ground, capped at
  `100dvh` so they scroll instead of clipping.
- Above the bottom nav (z 500), always. A screen with a nav bar on top isn't one.
- Every pop-up needs its own close control: full screen means there is no backdrop
  left to tap on a phone.
- Enforced in one place — the `POP-UP LAW` block at the end of `App.css`. A new
  pop-up joins those two selector lists. Anchored menus (`.cog-menu`,
  `.chart-cog-menu`, `.diet-sub-menu`) are not pop-ups and stay out of it.

## Components

### Ring-flanking circle buttons (the "Dub circle" pattern)

The two round buttons that flank the level ring on the Habits page — the **Dub**
button (`.hb-dub-by-ring`, right) and the **Global habit** planet
(`.hb-planet-by-ring`, left) — share one shell so they read as a matched pair:

- **56px** circle, `border-radius: 50%`, absolutely positioned to peek out beside
  the ring (`.hb-ring-wrap` is the `position: relative` anchor).
- Fill: `radial-gradient(circle at 50% 35%, <accent-dim>, var(--void))` where the
  accent is the button's semantic colour (Dub = `HEALTH` green; planet = `GROWTH`
  blue, matching the ocean SVG).
- Border: `1.5px solid <accent>`; box-shadow `0 4px 14px rgba(0,0,0,0.45)` **+**
  a `0 0 0 4px var(--void)` halo that cuts the button out from the ring behind it.
- Entrance: `dub-peek-in` (0.5s). Press: `:hover` `scale(1.08)` + brighter border,
  `:active` `scale(0.94)`.

New ring-adjacent circle buttons should conform to this shell and only swap the
semantic accent — don't invent a new size or shadow.

See also: [APP_OVERVIEW.md](APP_OVERVIEW.md) · [PAGES.md](PAGES.md)
