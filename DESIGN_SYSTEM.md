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

See also: [APP_OVERVIEW.md](APP_OVERVIEW.md) · [PAGES.md](PAGES.md)
