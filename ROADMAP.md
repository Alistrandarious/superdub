# Superdub — Improvement Roadmap

The prioritized backlog. The lead (Fable) picks the **top unblocked task**, runs the
[ORCHESTRATION.md](ORCHESTRATION.md) loop, and flips the task's status **in the same
commit that ships it** — so this file is always the source of truth for what's next,
across sessions.

**Cadence: balanced.** Alternate one debt/enabler task with one visible (E4) task so
the app keeps improving on both fronts.

**Status legend:** `[ ]` todo · `[~]` in progress · `[x] done vX.XXX YYYY-MM-DD` · `[-]` dropped (reason)
**Size:** S ≤ ~1h · M ≤ ~half day · L = multi-session
**Tier:** who implements — `haiku` (sd-mechanic) / `sonnet` (sd-worker) / `fable` (lead only)

## Epic 0 — Enablers

| ID | Task | Files | Size | Tier | Acceptance | Status |
|---|---|---|---|---|---|---|
| E0.1 | `npm run check` runs all 13 `*.check.ts` (src + server) via tsx, exits 1 on any assert failure | package.json, scripts/ | S | sonnet | `npm run check` exits 0 clean; breaking one assert exits 1 | [x] done v2.401 2026-07-13 |
| E0.2 | Hygiene: gitignore the personal files at root (never tracked, keep them that way); rename `PROMPT_SYSTEM_DESIGN.MD` → `.md` | .gitignore, root | S | fable | `git status` never shows the personal files; rename cased right on Windows | [x] done v2.401 2026-07-13 — .gitignore already covered them; only the rename shipped |

## Epic 1 — Type safety & hygiene

| ID | Task | Files | Size | Tier | Acceptance | Status |
|---|---|---|---|---|---|---|
| E1.1 | Typed api.ts: `request<T>()` + typed return per endpoint. Types only, zero runtime change | src/api.ts | M | sonnet | tsc passes; no behavioral diff; repo `as any` count doesn't rise | [x] done v2.402 2026-07-13 |
| E1.2 | `as any` purge, one file per task, after E1.1: DubPage (11) → App (10) → Habits (7) → rest | per file | S ×n | sonnet | File's `as any` count = 0, or each survivor carries a `ponytail:` justification | [ ] |
| E1.3 | `src/storageKeys.ts` registry for the ~55 `superdub.*` localStorage keys; replace literals | new file + callers | M | sonnet | No stray `superdub.` storage literals outside the registry (CustomEvent names exempt) | [ ] |
| E1.4 | `.catch(() => {})` triage (78 sites): tagged `console.warn` or real handling per policy; no UX change without lead sign-off | App.tsx (17), Habits.tsx (12), rest | M | sonnet | Zero bare empty catches; intentional silence gets a policy comment | [ ] |

## Epic 2 — Correctness & trust

| ID | Task | Files | Size | Tier | Acceptance | Status |
|---|---|---|---|---|---|---|
| E2.1 | XP trust boundary: server recomputes/clamps Global-habit XP instead of trusting the client (`server/routes/global.ts:77`) | server/routes/global.ts | M | fable | Out-of-band XP rejected/clamped; check file added + wired into E0.1 | [ ] |
| E2.2 | Single source of truth for plan/profile/weight-settings: one cached client provider; kill the 8× `getPlanStatus()` and 6× `getProfile()` re-fetches | src provider + callers | L | fable | One fetch per resource per page load; all consumers share it | [ ] |
| E2.3 | energy.ts client/server dedupe (logic currently duplicated) | src/energy.ts, server | S | sonnet | One implementation imported by both; energy.check.ts still passes | [ ] |

## Epic 3 — The date model

| ID | Task | Files | Size | Tier | Acceptance | Status |
|---|---|---|---|---|---|---|
| E3.1 | Year-keyed day keys: migrate `DD/MM` + the 9 duplicated `const YEAR` sites to canonical year-aware keys from src/day.ts; data migration for tracker + localStorage | src/day.ts + 9 callers, server tracker | L | fable | day.check.ts covers cross-year; old data reads back correctly; day.ts ceiling comment retired | [ ] |

## Epic 4 — Visible & UX

Ali seeds this epic — add concrete wants as rows, they interleave with the debt epics.

| ID | Task | Files | Size | Tier | Acceptance | Status |
|---|---|---|---|---|---|---|
| E4.1 | aria-labels on symbol/icon-only buttons, per file (text buttons already have accessible names — the button-count audit overstated) | per file | S ×n | haiku | Every symbol-only button labelled; text buttons skipped; zero visual change | [~] Profile.tsx done v2.403 2026-07-13 (3 symbol buttons); other files remain |
| E4.2 | Fix Habits chart header cramming: drop the nowrap override so range chips wrap to their own row, cog stays top-right | src/App.css | S | fable | Title+cog on row 1, chips on row 2 at 400px | [x] done v2.404 2026-07-13 |
| E4.3 | Dub mascot clipped in the Progress dubbar: find the clipping ancestor, give the pet headroom | src/App.css, ChartCarousel.tsx | S | fable | Dub unclipped at 46px, all 3 species | [x] done v2.404 2026-07-13 — root cause was 4px baseline descender mis-centering the pet |
| E4.4 | Stats-slide scroll fade without :has() (device support): ChartCarousel adds a modifier class instead | src/ChartCarousel.tsx, App.css | S | fable | Fade shows on stats slides, lifts at scroll end, no :has() | [x] done v2.404 2026-07-13 — also fixed fade-end latching (page fades were vanishing) |
| E4.5 | Dub page: room spans to the top, insights scroll right below; chat + "!" badge unchanged | src/DubPage.tsx, DubRoom.tsx, App.css | M | fable | Room hero at top, insights visible beneath | [x] done v2.405 2026-07-13 |
| E4.6 | Ring tap swaps Habits page: customization + full level ladder replace the list; tap again restores | src/Habits.tsx, LevelPage.tsx, new LevelLadder.tsx, App.css | M | fable | Habits list hidden while open; ladder shared with /level | [x] done v2.406 2026-07-13 |
| E4.7 | Bottom nav: Habits as the raised center circle, tinted by the customization color | src/BottomNav.tsx, App.css | S | sonnet | Order Progress·Dub·Habits·Global·Lists; circle uses habitsColor | [x] done v2.407 2026-07-13 |
| E4.8 | Friend detail sheet: profile info, nudge (rate-limited push), share-a-habit picker, remove | server/routes/friends.ts, services/push.ts, index.ts, src/api.ts, FriendsPanel.tsx, App.css | M/L | fable+sonnet | Tap friend opens sheet; nudge gated by friendship + 4h limit; share uses all-friends flag | [x] done v2.410 2026-07-13 |
| E4.9 | Scroll dock: pinned XP bar + cadence dotrow unified into one translucent glass capsule with entrance choreography (fill sweep, dot stagger) | src/App.css, CadenceCarousel.tsx | S | fable | Both halves translucent over any background, flush join, animations off under reduced motion | [x] done v2.411 2026-07-13 |
| E4.11 | Scroll fade rebuilt as sticky overlay strips: Safari paints container masks in content coordinates, so the old fades scrolled away with the content | src/App.css | S | fable | Strip pins to visible bottom at any depth; fades out at scroll end | [x] done v2.413 2026-07-14 |
| E4.15 | Fade strip landed ~80px high (mid-page black band): sticky bottom:0 pins ABOVE the container's padding-bottom; drop it by --fade-drop = padding-bottom per container | src/App.css | S | fable | Strip flush at true visible bottom (harness gap 0); band gone | [x] done v2.414 2026-07-14 |
| E4.16 | Glass dock "missing bar": cadence header's hardcoded top:37 drifted on iOS, opening a gap under the XP pill. Measure the pill's real stuck bottom → --dock-top, header abuts exactly | src/Habits.tsx, App.css | S | fable | Harness gap ~0 (sub-px overlap) at all depths; adapts per device | [x] done v2.416 2026-07-14 |
| E4.12 | Prompt sheets clear the iPhone home indicator (safe-area padding); habit day circle pops + ring-bursts on done | src/App.css, Habits.tsx | S | fable | env(safe-area-inset-bottom) on .checkin-modal; pop only on becoming done, never on mount | [x] done v2.413 2026-07-14 |
| E4.13 | Global: richer planet (limb darkening, polar aurora, bright equator); hero unpinned, scrolls with the page | src/GlobalPlanet.tsx, CommunityPage.tsx, App.css | S | fable | Hero is first child of the scroller; planet reads spherical | [x] done v2.413 2026-07-14 |
| E4.14 | Yesterday energy ledger: maintenance + activity vs usual = burned, net kcal vs intake, and a behaviour-based reliability verdict with kg/week pace | src/YesterdayMatrix.tsx, App.css | M | fable | Ledger row above the 2×2; verdict names missing behaviours; no false precision when weigh-in missing | [x] done v2.413 2026-07-14 |
| E4.10 | Fix the dock's mid-scroll break: the two bars are ~370px apart so the capsule only joined at deep scroll, showing severed halves in between. Now each is a complete pill; they morph into one capsule only when a scroll-tracked `docked` flag confirms they're flush | src/Habits.tsx, PinnedXpBar.tsx, CadenceCarousel.tsx, App.css | M | fable | Never severed at any scroll pos; seamless join only when adjacent | [x] done v2.412 2026-07-13 |

## Icebox

Unprioritized ideas — promote to an epic with an ID when ready.

- Referral flow: real invite links + signup attribution (currently the Wizard unlock counts accepted friends — see `LevelCustomizer.tsx` ponytail note)
- App.css split (14,244 lines) into `src/styles/*.css`, move-only, phased per page (selector-count equality proof per phase)
- App.tsx panel extraction (11 story panels, one per task, props-only)
- Level perks (streak freeze, XP multipliers) — deferred after Levels v2
- Scroll-fade for non-overflowing containers (ResizeObserver; see index.tsx ponytail note)
- True solar time for Dub's room window (currently a coarse 3-way clock split)
