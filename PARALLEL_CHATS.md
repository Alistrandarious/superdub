# Running several chats on this repo at once

Ali often has multiple Claude Code chats open at the same time, each working on a
different part of Superdub. They all share the same GitHub repo, so they can trip
over each other. This file is the rule for staying out of each other's way.

## What goes wrong

If two chats work in the **same folder**, one chat sees the other's half-finished,
uncommitted edits sitting in the working tree. It can't tell whose they are, so it
can commit another chat's work by accident, or build branches on top of files that
are changing underneath it. The branch/commit picture then shifts mid-task and
nothing lines up. (This happened on 2026-07-18: one chat's streak-chip and API-cache
edits showed up as mystery changes in another chat and got misread as an "automation".)

## Rule 1 — one isolated copy per chat

Two ways to get there:

1. **Git worktree per chat (preferred).** Each chat works in its own worktree on its
   own branch, so their working trees never mix:
   ```
   git worktree add ../superdub-<topic> -b <topic>
   ```
   Point that chat at `../superdub-<topic>` and let it commit to `<topic>`. Clean up
   with `git worktree remove ../superdub-<topic>` once it has landed on master.

2. **Only one chat in the main folder at a time.** If you'd rather not juggle folders,
   keep just one chat working in the main `superdub/` folder. The others must be in
   worktrees, not the main folder.

## Rule 2 — branch, verify, then land on master (seamlessly)

This is the standard ship flow for every chat. Do it end-to-end without stopping to
ask; Ali's approval to push finished green work to master is standing.

1. **Branch.** Do the work on your own branch (see Rule 1), never on `master` directly.
2. **Verify on the branch.** Both must pass — green only:
   ```
   CI=true npm run build     # eslint-as-errors + tsc; a red build is what pins Render
   npm run check             # the *.check.ts self-checks
   ```
3. **Bump the tag.** Update `src/version.ts` `BUILD_TAG` so the deploy is identifiable.
4. **Land on master.** Rebase onto whatever other chats have pushed, then fast-forward
   master:
   ```
   git fetch origin
   git rebase origin/master           # replay your commits on top of the latest master
   # if the rebase pulled in changes, re-run build + check before pushing
   git push origin HEAD:master        # fast-forward; master auto-deploys to Render
   ```
   A rebase conflict means another chat touched the same lines — resolve it (or ask
   Ali), don't force-push over their work.

## Before you stage anything, in any chat

The repo state may have moved because another chat pushed. Always look first:

```
git fetch origin
git branch -vv          # who is where, ahead/behind
git log --oneline origin/master..HEAD   # what's actually unique to this chat
```

- If `git status` shows changes this chat didn't make, they belong to another chat —
  **don't commit them.** Leave them alone and confirm with Ali.
- If `origin/master..HEAD` is empty, there's nothing to push — another chat already
  landed it.
- Stage files **explicitly** (`git add <path>`), never `git add -A`, so you can't
  sweep up another chat's work.
