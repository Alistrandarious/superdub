# Superdub — Agent Orchestration

How work ships on this repo: **the lead plans and reviews, workers implement.**
The backlog lives in [ROADMAP.md](ROADMAP.md).

## Roles

| Role | Who | Does | Never does |
|---|---|---|---|
| Lead | Fable 5 (main session) | Picks tasks, writes specs, reviews every diff, bumps `src/version.ts`, updates docs, commits, pushes | Delegates security / data-migration / architecture tasks |
| sd-worker | Sonnet subagent | Implements exactly one spec'd task; runs tsc + checks | git, version.ts, package.json deps, *.md docs, npm install |
| sd-mechanic | Haiku subagent | Mechanical recipe edits only (labels, constant swaps) | Everything sd-worker can't, plus creating files |

## The loop (per task)

1. **Pick** — top unblocked ROADMAP task. `git status` must be clean first; a stale
   `[~]` means the last session died mid-task — inspect `git diff` before resuming.
2. **Spec** — lead writes the task spec into the Agent prompt (template below).
3. **Work** — worker implements, runs `npx tsc --noEmit` + `npm run check`, reports.
4. **Review** — lead reads `git diff` against the checklist. Small fixups: lead does
   them directly. Structural problems: ONE bounce back with corrections; if the second
   attempt still fails, the lead takes the task over.
5. **Ship prep** — lead bumps `BUILD_TAG`, updates PAGES.md if routes changed, Success
   Kit article only if user-visible-major (see UPDATE_ARTICLES.md).
6. **Status** — flip the ROADMAP row to `[x] done vX.XXX YYYY-MM-DD` in the same commit.
7. **Ship** — one task = one commit, message starts with the task ID. Push master
   (auto-deploys Render).

## Task spec template

```
TASK <ID>: <one-line goal>
FILES (touch ONLY these): <exact list>
OUT OF SCOPE: <adjacent things it must not do>
ACCEPTANCE: <the ROADMAP acceptance, made concrete and runnable>
DIFF CEILING: if your diff exceeds ~<N> lines, stop and report instead.
DOCS: <DESIGN_SYSTEM.md for UI, CALCULATIONS.md for numeric, day-key convention in DOCS.md>
```

## Review checklist (every diff)

- Only spec'd files touched; no scope creep or drive-by refactors.
- Ponytail rungs held: nothing built that reuse/stdlib covered; no new abstraction,
  dependency, or boilerplate; deletion preferred.
- The check exists and actually fails when the logic breaks (run it broken if unsure).
- No new `as any`, bare `.catch(() => {})`, or stray `superdub.*` storage literal.
- Day keys correct per store: `DD/MM` (habit tracker) vs `YYYY-MM-DD` (steps/check-ins/plan).
- UI: DESIGN_SYSTEM.md tokens only; aria-labels on new icon buttons; no em-dashes in user copy.
- Trust boundaries untouched or strengthened, never weakened.
- Worker stayed in bounds: `git log` unchanged, version.ts untouched, no new deps.

## Hard rules

- **One worker at a time, in the main working tree.** Worktrees under OneDrive are a
  sync-corruption hazard, and the hot files (App.css, App.tsx, api.ts) collide under
  parallelism. Worktree isolation is opt-in for genuinely disjoint tasks only — never
  for anything touching App.css / App.tsx / api.ts.
- **Only the lead pushes.** Workers are forbidden from git in their definitions; worst
  case a rogue worker dirties the tree, never master.
- **Only the lead edits `src/version.ts`** — it lives in ship prep so it can't be missed.
- **Security, data migrations, and architecture are fable-tier.** Ponytail is explicit:
  never lazy about security. Those tasks are marked `fable` in ROADMAP.md.
- **If git behaves oddly, suspect OneDrive sync lag first** — verify against
  `git show HEAD:<file>` before re-creating anything (it may already exist in HEAD).
