# CLAUDE.md

Coding rules for this repo — the Ponytail "lazy senior dev" ruleset applies:

@AGENTS.md

## Git workflow — branch, verify, then land on master

Ali runs several chats on this repo at once. Every chat ships the same way, and does
it seamlessly without stopping to ask (approval is standing):

1. **Work on your own branch, never on `master` directly** (own `git worktree` if you
   can). This is what keeps concurrent chats from committing each other's edits.
2. **Verify on the branch before landing** — both must pass:
   `CI=true npm run build` (eslint-as-errors + tsc) **and** `npm run check`. Green only.
3. **Bump `src/version.ts` `BUILD_TAG`** so the deploy is identifiable.
4. **Land on master seamlessly:** `git fetch origin` → `git rebase origin/master` →
   re-run the checks if the rebase pulled in changes → `git push origin HEAD:master`
   (fast-forward). `master` auto-deploys to Render, so only a green build ever lands.

Before staging: `git branch -vv` first. Anything in the tree you didn't change belongs
to another chat — leave it, stage explicit paths, never `git add -A`. Full detail and
the collision failure mode: [PARALLEL_CHATS.md](PARALLEL_CHATS.md).

## Project reference
- [APP_OVERVIEW.md](APP_OVERVIEW.md) — what Superdub does + the insight services
- [PAGES.md](PAGES.md) — routes → components → accents
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — colours, type, surfaces, constraints (binding guide: `Superdub Swatches.pdf`)
- [SUPERDUB_VOICE.md](SUPERDUB_VOICE.md) — how Superdub talks (no dashes, no jargon, one name per feature)
- [PROMPTS.md](PROMPTS.md) — every daily prompt + notification, timing, and the daily order
- [CALCULATIONS.md](CALCULATIONS.md) — every formula (mirrored live at `/maths`)
- [UPDATE_ARTICLES.md](UPDATE_ARTICLES.md) — every major update ships a Success Kit article
- [ROADMAP.md](ROADMAP.md) — the prioritized backlog; pick the top unblocked task
- [CLICKUP.md](CLICKUP.md) — the LayerDigital ClickUp mirror of the roadmap (IDs + sync rules)
- [ORCHESTRATION.md](ORCHESTRATION.md) — lead/worker agent workflow for shipping tasks
- [PARALLEL_CHATS.md](PARALLEL_CHATS.md) — several chats on this repo at once: one worktree per chat, check git state before committing
