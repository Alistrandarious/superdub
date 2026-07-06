# Convention — An Article for Every Major Update

> **Rule:** every **major update** to Superdub ships with a matching **Success Kit
> article**. The changelog entry says *what* changed; the article says *why it
> matters and how to use it* — in Dub's plain, warm voice.

## What counts as "major"
A user-visible new capability, a redesigned surface, or a meaningful behaviour
change (e.g. a new page, Dub, Levels, the Liquid ring, calories-first). Bug-fix /
polish releases do **not** need an article — a changelog entry is enough.

## The two places an update lives
1. **Changelog** — `src/updates.ts` (`UPDATE_LOG`). Newest first: `date`, `emoji`,
   `title`, `summary`, `points[]`. Renders as the "What's New" timeline.
2. **Article** — `src/articles.ts` (`ARTICLES`). Long-form: `id`, `title`,
   `author` ("Ali Shah"), `readMins`, `tag`, `accent` (semantic hex),
   `dek` (one-line standfirst), and a `body` of typed blocks
   (`{t:'h'|'p'|'li'|'quote', text}`). Rendered in the Success Kit.

Also bump `BUILD_TAG` in `src/version.ts` on every release (it doubles as the
cache-buster / update-banner trigger).

## Checklist for a major update
- [ ] Add a `UPDATE_LOG` entry (top of the array) in `src/updates.ts`.
- [ ] Write a matching `ARTICLES` entry in `src/articles.ts`.
      - `accent` = the semantic colour of the feature (green/blue/gold/violet — see
        [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)).
      - Voice: warm, honest, second-person; emoji allowed **in article body only**
        (never in UI chrome).
      - Structure: hook `p` → a couple of `h`+`p` sections → optional `quote` →
        a "do this now" close.
- [ ] Bump `BUILD_TAG` in `src/version.ts`.
- [ ] (If the feature is user-facing on a page) update [PAGES.md](PAGES.md).

## Style notes
- Keep articles short (≈2–4 min read); one idea per section.
- Tie the feature back to the core loop: **log → trend → read → one small thing**.
- No marketing fluff — explain the benefit and the exact tap that gets it.
- **Never use em-dashes (—) when writing updates.** Not once. Use a period, comma, colon, or parentheses instead. This applies to every `UPDATE_LOG` and `ARTICLES` entry.

See also: [APP_OVERVIEW.md](APP_OVERVIEW.md)
