# CLICKUP.md

Superdub is tracked in ClickUp under the LayerDigital workspace. This file records the
mapping so the IDs live in the repo, not just in someone's head.

**The repo's [ROADMAP.md](ROADMAP.md) stays the source of truth for what's next.** ClickUp
mirrors the open items for visibility and team coordination; when a task ships, flip it in
ROADMAP.md first, then close it in ClickUp.

## Location

| Level | Name | ID |
|---|---|---|
| Workspace | Workspace | `90121908443` |
| Space | LayerDigital Sprints | `90128390134` |
| Folder | Backlog Management | `901212443408` |
| List | **Superdub** | `901219662903` |

List: https://app.clickup.com/90121908443/v/l/li/901219662903

## Seeded tasks

Only the **open / in-progress** roadmap items are mirrored (done rows stay in ROADMAP.md's
history). Priority follows the epic, not a separate scale.

| Roadmap ID | Task | Priority | ClickUp |
|---|---|---|---|
| E1.2 | `as any` purge (App, Habits, rest) | high | [869e6caa9](https://app.clickup.com/t/869e6caa9) |
| E1.3 | storageKeys.ts registry | normal | [869e6caad](https://app.clickup.com/t/869e6caad) |
| E1.4 | `.catch(() => {})` triage | normal | [869e6caag](https://app.clickup.com/t/869e6caag) |
| E2.1 | XP trust boundary | high | [869e6caah](https://app.clickup.com/t/869e6caah) |
| E2.3 | energy.ts client/server dedupe | normal | [869e6caaj](https://app.clickup.com/t/869e6caaj) |
| E3.1 | Year-keyed day keys migration | normal | [869e6caan](https://app.clickup.com/t/869e6caan) |
| E4.1 | aria-labels on icon-only buttons | low | [869e6caaq](https://app.clickup.com/t/869e6caaq) |

## Keeping them in sync

- **New backlog item:** add the row to ROADMAP.md, then create the task in the Superdub list.
- **Task shipped:** mark `[x] done vX.XXX` in ROADMAP.md (in the shipping commit), then close it in ClickUp.
- The mapping table above is the join key — update it when IDs change.
