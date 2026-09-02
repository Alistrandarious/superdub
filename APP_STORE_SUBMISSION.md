# App Store Submission Runbook — Superdub (iOS)

> The steps and the exact App Store Connect answers for shipping Superdub to the
> **App Store**. Companion to [PLAY_SUBMISSION.md](PLAY_SUBMISSION.md) (Android)
> and [LAUNCH_STRATEGY.md](LAUNCH_STRATEGY.md) (the separate monetization plan).
>
> App id: **`com.superdub.app`** · Launching **free, no in-app purchases**.
>
> Written against the v2.492 release-prep branch. Everything under "Already done
> in code" is committed; everything under "Only you can do this" needs Ali, a Mac,
> and an Apple Developer account.

---

## A. Already done in code (v2.492)

Nothing here needs repeating. It is listed so you can tell a reviewer's question
from a real gap.

| Thing | Where |
|---|---|
| `Package.swift` dependency paths fixed (were Windows backslashes, so the project could not resolve) | `ios/App/CapApp-SPM/Package.swift` |
| HealthKit entitlement file + `CODE_SIGN_ENTITLEMENTS` on both configs | `ios/App/App/App.entitlements`, `project.pbxproj` |
| `ITSAppUsesNonExemptEncryption = false` (stops the export-compliance prompt on every upload) | `ios/App/App/Info.plist` |
| Portrait locked on iPhone **and** iPad, `UIRequiresFullScreen` | `Info.plist` |
| Stale `armv7` device requirement removed | `Info.plist` |
| HealthKit usage strings | `Info.plist` (were already present) |
| Daily reminders work on iOS (local notifications; Web Push stays for web) | `src/push.ts` |
| Update-poll and service worker no longer run in the native shell | `src/UpdateBanner.tsx`, `public/index.html` |
| Lists tab hidden on native, one const | `src/BottomNav.tsx` |
| No unpurchasable "Pro" tier in the UI | `src/Habits.tsx` |
| Privacy policy matches what the app actually collects | `src/PrivacyPolicy.tsx` |
| Marketing version `2.492`, build number `1` | `project.pbxproj` |

---

## B. Only you can do this

### B1. Apple Developer Program
Enrol at developer.apple.com if not already (£79/yr, individual is fine). Allow a
day or two for approval.

### B2. Enable HealthKit on the App ID
The entitlement file in the repo declares the capability; the App ID has to
*grant* it or the build will not sign.

- Xcode → App target → **Signing & Capabilities** → **+ Capability** → **HealthKit**.
  With automatic signing this updates the App ID for you.
- Confirm `App.entitlements` is still selected under Code Signing Entitlements
  (the repo sets it; Xcode sometimes rewrites the path on first open).

> Without this, step sync silently returns nothing on device. It fails quietly,
> so test it on a real phone, not just the simulator.

### B3. Build and archive (on the Mac)

```
git fetch origin && git checkout master && git pull
npm ci
CI=true npm run build        # eslint-as-errors + tsc, must be green
npm run check                # must be green
npx cap sync ios             # copies build/ in and regenerates Package.swift
open ios/App/App.xcodeproj   # SPM project: the .xcodeproj, there is no .xcworkspace
```

In Xcode: select **Any iOS Device**, set your Team under Signing & Capabilities,
then **Product → Archive** → **Distribute App** → **App Store Connect**.

Bump `CURRENT_PROJECT_VERSION` by one for every upload. `MARKETING_VERSION`
tracks `src/version.ts` `BUILD_TAG` (v2.492 → `2.492`), same convention Android
uses.

### B4. App Store Connect — app record

- **Name:** Superdub · **Primary language:** English (UK)
- **Bundle ID:** `com.superdub.app` · **SKU:** `superdub-ios`
- **Category:** Health & Fitness (secondary: Productivity)
- **Price:** Free, no in-app purchases

### B5. Age rating
Answer the questionnaire honestly; Apple spot-checks and can pull a live app for
a wrong answer. Superdub has no violence, gambling, or mature themes. It **does**
have user-generated content in Journal and habit names, and a friends layer.

The app enforces **13+** in code (`src/age.ts`, re-checked server-side in
`server/routes/auth.ts`), which matches the privacy policy. Keep the store rating
consistent with that.

### B6. Privacy nutrition labels

Answer from `src/PrivacyPolicy.tsx` — it was corrected in v2.492 and is now
accurate. Data collected and **linked to the user**:

| Type | What | Used for |
|---|---|---|
| Contact info | Email address | App functionality (account) |
| Health & Fitness | Weight, steps, habit completions, energy/mood check-ins, sleep | App functionality |
| User content | Journal entries, habit names, tasks, goals | App functionality |
| Identifiers | User ID | App functionality |
| Sensitive info | Ethnicity, religion (optional, blank by default) | App functionality |

- **Tracking: No.** Nothing is shared with data brokers or used for cross-app
  advertising.
- **Third-party analytics:** PostHog, consent-gated and **dormant** — it no-ops
  unless `REACT_APP_POSTHOG_KEY` is set. If you ship with a key, declare Product
  Interaction under Analytics.
- **Location: No.** The weather chip is off by default in the native app and
  never sends coordinates to Superdub's servers.
- Health data is not used for advertising and is not stored in iCloud. State this
  in the review notes; it is the thing reviewers check first on a Health app.

### B7. Required URLs
- **Privacy policy:** `https://superdub.onrender.com/privacy` (live, no auth wall)
- **Support URL:** needed, and **does not exist yet.** A page with an email
  address is enough. This is a hard requirement.
- **EULA:** use Apple's standard licence agreement. Superdub has no Terms of
  Service of its own and does not need to write one to ship.

### B8. Screenshots
Required: **6.9" iPhone** (1320 × 2868) and **13" iPad** (2064 × 2752).

> iPad screenshots are a technical requirement, not a suggestion. App Store
> Connect blocks submission without them even though the app is iPhone-shaped.
> This is a common first-submission surprise.

Up to 10 each, at least 4 recommended. Shoot on a populated account, not a fresh
one: Habits with a live streak, Progress with a real weight trend, the Coach read,
the level ring. Capture after `npx cap sync ios` so it is the shipping build.

### B9. Account deletion
Already in the app (Profile → Danger Zone → two-step confirm → `DELETE /profile`,
which deletes the user row). Apple requires this and reviewers do look for it.
Point them at it in the review notes.

### B10. Review notes — write these

Reviewers spend 30 to 90 seconds forming a first impression. Give them:

- **A demo account with real data in it.** Email + password, seeded with several
  weeks of habits, weigh-ins and steps. A reviewer who signs up fresh sees an
  empty app and cannot judge it. This is the single highest-value thing in the
  submission.
- Where account deletion lives (Profile → Danger Zone).
- That health data is read-only from HealthKit (steps), never written, never used
  for advertising, and never stored in iCloud.
- That Superdub is a wellness and habit tracker, **not a medical device**, and
  does not diagnose or treat. `src/HealthDisclaimer.tsx` says so in-app on the
  goal screen, About, and The Maths.

### B11. TestFlight before the real submission
Push the build to TestFlight and use it yourself for a few days on a real phone.
The first external build needs Beta App Review, currently running about two to
seven days; internal testers need no review.

**Test on device, not simulator, at minimum:**
- HealthKit permission prompt appears and steps actually sync (B2 is the thing
  that silently breaks this).
- The three daily reminders fire at the set hours, survive a force-quit, and
  reschedule when you change an hour.
- Sign-up end to end: six screens, the plan is live on `/plan` afterwards, and
  the morning weigh-in prompt appears the next day.
- No landscape, no iPad split-view weirdness.

---

## C. Known gaps, deliberately shipped

Each of these is a decision, not an oversight.

- **No in-app purchases.** Every account resolves to `pro` today
  (`EARLY_ADOPTER_BEFORE` predates now), so nothing is gated and nothing is sold.
  Launching free is the honest version of that. Billing is
  [LAUNCH_STRATEGY.md](LAUNCH_STRATEGY.md)'s problem, and adding it later is a
  normal update.
- **No Sign in with Apple.** Guideline 4.8 only bites when you offer a
  third-party login, and the Google button is hidden on native
  (`src/GoogleAuthButton.tsx`), so the iOS app is email and password only. If you
  ever enable Google on native, Sign in with Apple becomes mandatory in the same
  release.
- **Web-account users who signed up with Google cannot log in on iOS.** They have
  no password. Forgot-password does work and sets one, but nothing signposts it.
  Worth fixing before you market the iOS app to existing users.
- **Offline is read-only.** The service worker never caches `/api/`, and a habit
  tick made offline is lost on reload with no message. Not a submission blocker;
  it is the most user-visible correctness gap left in the app.
