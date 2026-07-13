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
| E0.1 | `npm run check` runs all 13 `*.check.ts` (src + server) via tsx, exits 1 on any assert failure | package.json, scripts/ | S | sonnet | `npm run check` exits 0 clean; breaking one assert exits 1 | [ ] |
| E0.2 | Hygiene: gitignore the personal files at root (never tracked, keep them that way); rename `PROMPT_SYSTEM_DESIGN.MD` → `.md` | .gitignore, root | S | fable | `git status` never shows the personal files; rename cased right on Windows | [ ] |

## Epic 1 — Type safety & hygiene

| ID | Task | Files | Size | Tier | Acceptance | Status |
|---|---|---|---|---|---|---|
| E1.1 | Typed api.ts: `request<T>()` + typed return per endpoint. Types only, zero runtime change | src/api.ts | M | sonnet | tsc passes; no behavioral diff; repo `as any` count doesn't rise | [ ] |
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
| E4.1 | aria-labels: Profile.tsx first (23 buttons / 0 labels), then per-file toward full coverage | src/Profile.tsx, then per file | S ×n | haiku | Every icon-only button labelled; text buttons skipped; zero visual change | [ ] |

## Icebox

Unprioritized ideas — promote to an epic with an ID when ready.

- Referral flow: real invite links + signup attribution (currently the Wizard unlock counts accepted friends — see `LevelCustomizer.tsx` ponytail note)
- App.css split (14,244 lines) into `src/styles/*.css`, move-only, phased per page (selector-count equality proof per phase)
- App.tsx panel extraction (11 story panels, one per task, props-only)
- Level perks (streak freeze, XP multipliers) — deferred after Levels v2
- Scroll-fade for non-overflowing containers (ResizeObserver; see index.tsx ponytail note)
- True solar time for Dub's room window (currently a coarse 3-way clock split)
