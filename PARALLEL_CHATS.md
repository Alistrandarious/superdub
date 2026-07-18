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

## The rule

**One isolated copy per chat.** Two ways to get there:

1. **Git worktree per chat (preferred).** Each chat works in its own worktree on its
   own branch, so their working trees never mix:
   ```
   git worktree add ../superdub-<topic> -b <topic>
   ```
   Point that chat at `../superdub-<topic>` and let it commit to `<topic>`. Open a PR
   into `master` when it's done. Clean up with `git worktree remove ../superdub-<topic>`.

2. **Only one chat in the main folder at a time.** If you'd rather not juggle folders,
   keep just one chat working in the main `superdub/` folder. The others must be in
   worktrees, not the main folder.

## Before any commit or push, in any chat

The repo state may have moved because another chat pushed. Always look first:

```
git fetch origin
git branch -vv          # who is where, ahead/behind
git log --oneline origin/master..HEAD   # what's actually unique to this chat
```

- If `git status` shows changes this chat didn't make, they belong to another chat —
  **don't commit them.** Leave them alone and confirm with Ali.
- If `origin/master..HEAD` is empty, there's nothing to push (another chat already
  landed it). Don't open an empty PR.
- Stage files **explicitly** (`git add <path>`), never `git add -A`, so you can't
  sweep up another chat's work.
