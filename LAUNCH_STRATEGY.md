# Superdub Release & Monetization Strategy

> Strategy document. The tier split, pricing, trial, and paywall experience are decided; two items in §8 remain. This is the reference the eventual implementation plan hangs off. An interactive prototype of the paywall lives at the link in §5.

---

## Context — why we're doing this

Superdub is a finished, feature-rich habit + weight + nutrition tracker with a real backend (accounts, JWT, Neon Postgres, Render). It has never charged money and has **zero billing infrastructure**. The goal now: turn it into a sustainable product by (1) shipping it as a real **App Store + Play Store** app and (2) introducing a **generous, value-first trial to paid subscription** that stays true to Superdub's "we're here to make your life better, no drama, no fuss" voice.

The intended outcome is a monetization model that a Superdub user would find *fair*, not a dark pattern, while giving the app a revenue base. The trial is the emotional centre of the pitch: **give people 25 days to actually build a habit and bond with Dub before we ever mention money.** Free stays genuinely useful, and quitting is absolutely free.

---

## 1. The honesty problem, and the early-adopter gift

`src/About.tsx` currently sells Superdub as being **"without subscriptions, dark patterns, or paywalls"** and criticises apps that "gate features behind paywalls." A paywall contradicts that published promise, so we handle it head-on, because honesty is the brand.

- **Reframe the About copy** from "no subscriptions ever" to "no dark patterns." A subscription that is generous, no-card-to-try, cancel-in-one-tap, and never holds your data hostage is not a dark pattern. Say that plainly.
- **Grandfather early adopters with Pro for life.** Pre-2026-08-01 users (`EARLY_ADOPTER_BEFORE = '2026-08-01'` in `src/levels.ts`) keep **Superdub Pro free, forever**, honouring the "no paywall" promise they joined under. This turns the broken promise into a loyalty gift and a launch-day goodwill story.
- **Greet them once.** On their next launch after release, those users get a **one-time welcome-back greeting** thanking them for being here first and reminding them they keep Pro and the exclusive **"Freer" colourway** free.
- **"Freer" is theirs alone.** The colourway is an early-adopter badge of honour. It is **hidden from everyone else** after launch, never offered or unlockable by later users.
- **Keep a real free tier** (see §3) so no one who trusted us early is locked out of their own habits and history.

---

## 2. The trial — 25 days, no card, value-first

Model it as an **app-managed trial**, not a store free trial.

**Mechanics:**
- On account creation, the server stamps `trial_ends_at = created_at + 25 days` and the user has **full Pro access** for those 25 days.
- **No payment method is collected up front.** No card, no store enrolment. Just the app.
- **Day 21 nudge** ("your first habit should be taking hold"): a warm reminder, framed as encouragement, not a sales countdown.
- **Day 25:** the trial ends. The user is invited to subscribe through the App Store / Play Store to keep Pro, and gently drops to the free tier if they do not. Free is still useful, so this is not a lockout.

**Important caveat — this is deliberately NOT a store "free trial."** Apple and Google introductory free trials require a payment method up front, auto-converting unless cancelled. That is the opposite of "no card, no fuss." So our 25 days are **entitlement our own server grants**, and conversion at day 25 is a plain paid subscription purchase via IAP. Fully allowed (we are gating our own features), it just means the trial clock lives on **our** server, and we do not stack a second store-side free trial on top.

**Day-21 reminder channel (pending, §8).** The intent says "remind text" (SMS), but we do not collect phone numbers today and SMS needs a provider (e.g. Twilio). We already have Web Push (`server/routes/push.ts`) and email (Resend). Recommendation: launch on **push + email**, treat **SMS as a fast-follow** needing phone capture in onboarding.

---

## 3. Tiers — decided

Superdub's soul: the **core loop is honest and free** (log, see the trend, get a plain read, do one small thing). Pro is the *amplifier*, not a gate on the basics. The premium value is **Dub's advice** and the **intelligence/analytics layer**, plus room to grow (more habits, more cadences).

### Superdub Free (forever, genuinely useful)
- **Daily habits, up to 5** (raised from 3 so the free tier breathes)
- **The Adaptive Weight Plan in full** (we need the data flowing, so the plan itself is free)
- Weight logging, the trend chart, basic charts
- The honest calorie target (our identity, always free)
- **Dub as a companion** but **without the coaching advice**
- **Limited Dub customization** (cannot switch species to the cat; premium species are Pro)
- **A subset of cosmetics**, earned through **longer XP unlock gates**
- **Friends and the social core**, with the **premium friends list shown but locked** as an upgrade tease
- XP and levels
- **Full access to your own data; quitting is absolutely free**
- **90-day history window** (Pro unlocks full history)

### Superdub Pro (the subscription)
Everything in Free, plus:
- **Weekly, monthly, and yearly habit cadences**
- **Unlimited habits** (no cap)
- **Advanced analytics, insights, and patterns**
- **Dub's advice and coaching in full**: chat, morning/evening brief, the live room, per-habit insights
- **Full Dub customization** (cat, wizard, all species and colours), no grind
- **The full cosmetics catalogue**, with short or no unlock gates
- **The premium friends list**
- **Full history** (beyond the free 90-day window)

---

## 4. Pricing

One list-price anchor, **$6.99/mo**, so every discount is real and ties back to the same number:

- **Monthly: $4.99/mo** — 29% off list. Shown with a `$6.99` strikethrough and a "Save 29%" badge.
- **Yearly: $39.99/yr = $3.33/mo** — 52% off list, the default/featured option. Shown with the `$6.99` strikethrough, a "Save 52%" badge, and a "like 4 months free" hook (versus paying monthly: $4.99 × 12 = $59.88 vs $39.99, ~$19.89 saved).
- Both plans lead with the **per-month price** so they compare directly; the yearly savings badge is emphasised, the monthly one quiet.
- **Win-back:** a returning subscriber gets a **cheaper first month** on re-subscribe (proposal: ~$2.99 first month, then standard rate)
- **Early adopters:** Pro free for life, the exclusive "Freer" colourway, and a one-time welcome-back greeting (§1)
- Store cut is 30% (or 15% after year one on Apple's small-business / retained-subscriber terms). Price with that in mind.

---

## 5. The premium paywall experience

The upgrade moment should feel like a reward, not a toll booth. It is a **multi-page flow** with a **chevron progress rail** and a **trial timeline**, in Superdub's dark violet-and-gold world. Cool, powerful, honest.

**Interactive prototype:** https://claude.ai/code/artifact/62bb9914-9f7c-4b42-bd69-86f9196f5b34

**Four steps, chevrons filling as you advance:**
1. **The pitch** — one powerful line ("Meet your future self, faster"), a glowing crown, the promise that everything gets turned up.
2. **What Pro unlocks** — Dub fully awake, advanced analytics, habits on your rhythm (weekly/monthly/yearly), no ceiling (unlimited habits + full history), full customization incl. the cat.
3. **The 25-day timeline** — Day 1 start on full Pro (no card), Day 21 nudge, Day 25 you decide, anytime-after leaving is easy. The trial's generosity made visual.
4. **Your plan** — yearly featured as best value ($3.33/mo, $39.99/yr, save 52%, "like 4 months free") above monthly ($4.99/mo, save 29%), both off the $6.99 list anchor, with "no commitment, cancel in one tap, keep the month" right on the page. CTA: **Start 25 days free.**

Design notes: honour `DESIGN_SYSTEM.md` (Kanit italic display, Space Mono for all numbers and eyebrows, semantic accents, no emoji chrome, `--r-card` radii). Violet is the Pro accent; gold is the reward shimmer, used sparingly. The prototype uses system-font stand-ins for Kanit/Sora/Space Mono; the real build reads the actual brand fonts.

---

## 6. Cancellation is a feature, not a formality

Core to the brand and worth building deliberately:

- **"No commitment, cancel anytime"** stated plainly at the point of subscribing, not buried.
- **Make cancelling super easy**: one obvious tap, no retention maze, no guilt screens, no "are you sure" gauntlet.
- **Keep Pro until the period ends**: cancelling never revokes access mid-cycle. You paid for the month, you keep the month.
- **Cheaper to come back**: the win-back first-month discount (§4) makes returning painless.

*(On native, the actual unsubscribe happens in the App Store / Play Store subscription settings. We make the path there one tap and crystal clear from inside the app, and honour the paid-through date via the store's entitlement.)*

---

## 7. Platform & billing architecture

- **Distribution:** harden the existing **Capacitor** shells (`android/`, `ios/`, `capacitor.config.ts`) into shippable App Store + Play Store builds. Keep the PWA/web app alive as the free web surface and marketing entry.
- **Billing:** use **RevenueCat** to unify **Apple StoreKit + Google Play Billing** (and optionally Stripe for web) behind one entitlement. It handles receipt validation, renewals, grace periods, the paid-through date, and cross-platform "is this user Pro?", the hard part we do not want to hand-roll. ~1% on top of store fees. *(Stack pending confirmation, §8.)*
- **Server is the source of truth for entitlement — built (v2.475).** `server/entitlement.ts` resolves every account to `free` | `trial` | `pro` from three `users` columns, and `withEntitlement` (`server/middleware/entitlement.ts`) attaches `req.entitlement` to the routes that gate something. `GET /api/entitlement` tells the client what it may show; the client is only the pretty face.
  - **Two columns, not five.** `users.plan` (`free` | `pro`, written only by the server) and `users.pro_until` (paid-through date; `NULL` on a `pro` plan means forever). The 25-day trial and the early-adopter grant both derive from `users.created_at`, so they need no columns and can never drift.
  - **The 5-habit cap is live.** `PUT /api/habits` and the graveyard restore both refuse a list that would grow past `FREE_HABIT_LIMIT` on a free plan, with a `402` the client explains. Being over the cap already never locks anyone out: you keep, reorder and archive what you built, you just can't grow it. The auto-managed check-in habit never eats a slot. Covered by `server/entitlement.check.ts`.
  - **Still to enforce:** the daily-only cadence gate, the 90-day history window, and the Dub-coaching / analytics / premium-friends gates. Each is now a one-line `req.entitlement` read on the route that serves it.
- **Reuse the existing gate.** Extend the `Unlock` / `isUnlocked` / `UnlockCtx` model in `src/levels.ts` with a `plan`/`pro` dimension so the same picker code that gates cosmetics also gates Pro features and cadences, with the server as the real enforcer behind it.

Billing (RevenueCat, receipts, renewals) is still a future implementation plan. What exists now is the entitlement layer it will write into: a webhook only has to set `plan` and `pro_until`.

**Nothing changes for anyone today.** Every existing account was created before `2026-08-01`, so every account resolves to `pro` and sees no ceiling. The cap only begins to bite for accounts created after the cutoff, once their 25 days are up.

---

## 8. Open decisions still to lock

1. **Day-21 reminder channel:** push + email now with SMS as fast-follow (recommended), or hold for SMS?
2. **Billing stack:** RevenueCat (recommended) vs hand-rolled StoreKit/Play Billing?

Decided: tier split with Free at 5 habits / Pro unlimited (§3); pricing $4.99/mo, ~$39.99/yr, ~$2.99 win-back first month (§4); 25-day no-card trial (§2); the four-step paywall experience (§5); cancel-anytime + easy-cancel + keep-the-month + cheaper-return (§6); early adopters get Pro free for life + the exclusive "Freer" colourway + a one-time greeting (§1); Free 90-day history / Pro full history (§3); server-authoritative enforcement (§7).

---

## 9. Next step

The entitlement schema, the trial clock, and the 5-habit gate are built (§7). What's left, once §8 is closed: RevenueCat integration, the day-21 nudge job, the cadence and history gates, the `UnlockCtx` extension, the early-adopter greeting, the four-step paywall build, and the About/positioning rewrite.
