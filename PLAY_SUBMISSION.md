# Google Play Submission Runbook — Superdub (free beta)

> The repeatable steps + exact Play Console answers for shipping Superdub to a
> **closed / feedback beta track**. This is the *submission* guide;
> [LAUNCH_STRATEGY.md](LAUNCH_STRATEGY.md) is the separate *monetization* plan.
> Beta = **free, no payments** — the entitlement/billing work stays parked.
>
> App id: **`com.superdub.app`** · Play-first (iOS untouched, ignore for beta).

---

## A. Build the signed AAB (do this from `origin/master`)

The CLI gradle path hits a loopback error on this machine, so the bundle is
built in **Android Studio**.

1. `git fetch origin && git checkout master && git pull` — build from what ships,
   not a stale branch. (The store-blocking code — data export, analytics,
   disclaimer, age gate — only exists on master.)
2. `npm ci` (or `npm install`).
3. `npm run build` — the web build (`CI=true` to catch eslint/tsc first).
4. `npx cap sync android` — copies `build/` into the Android shell.
5. Bump the native version in `android/app/build.gradle`:
   - `versionCode` → next integer. Convention in the file: it tracks the web
     `BUILD_TAG` (v2.437 → 2437). For the current tag `vX.YYY` use `XYYY`, and it
     **must be higher than the last uploaded** (last upload was **2437**).
   - `versionName` → match the `BUILD_TAG` string (e.g. `"2.481"`).
6. Android Studio → **Build → Generate Signed Bundle / APK → Android App Bundle**.
   Signing reads the gitignored `android/keystore.properties` (upload keystore
   lives on Ali's machine, never in the repo). Output: `app-release.aab`.

> `android/app/google-services.json` is intentionally absent, so native FCM push
> is off. Superdub uses Web Push/VAPID, which works in the beta — only add the
> Firebase file if you later want native push.

---

## B. Play Console — one-time app setup

1. **Create app** (if not already): name *Superdub*, free, app (not game).
2. **Privacy policy URL:** `https://superdub.onrender.com/privacy` (already live —
   the in-app `/privacy` page is publicly served; no work needed).
3. **App access:** the app needs a login. Provide test credentials (a seeded beta
   account) so the reviewer can get past the auth wall.
4. **Ads:** No ads. Declare "No".
5. **Content rating:** complete the IARC questionnaire — Superdub has no violence,
   sexual content, gambling, or profanity → expect **Everyone / PEGI 3**. Answer
   honestly; weight/calorie content is not a rating category.
6. **Target audience & content:** target age **13 and over** (NOT children). This
   matches the app's own under-13 gate (`src/age.ts`, enforced client + server).
   Do not opt into the Designed-for-Families / Teacher-approved programmes.
7. **Health apps declaration:** Superdub gives weight/calorie guidance, so complete
   the Health declaration. It is **not** a medical device — the in-app
   `HealthDisclaimer` ("not a medical device… talk to a doctor") already states
   this on onboarding, About and The Maths.

---

## C. Data Safety form — answers mapped to the privacy policy

Source of truth: `src/PrivacyPolicy.tsx`. Confirm each against the live form.

- **Does the app collect or share user data?** Collect: **Yes**. Share (transfer
  to third parties for their own use): **No** — Neon/Render/Resend/PostHog are
  service providers/processors, not data sales. **We do not sell data.**
- **Encrypted in transit:** **Yes** (HTTPS).
- **Users can request deletion:** **Yes** — in-app account deletion (Profile →
  Danger Zone) and data export (Profile → Export my data).

| Data type | Collected | Purpose | Required? |
|---|---|---|---|
| Email address | Yes | Account management | Required |
| Name | Yes | Account management, personalisation | Required |
| Date of birth | Yes | Age gate + calorie maths | Required |
| Health & fitness (weight, steps, calories, habits, mood/energy) | Yes | App functionality | Required |
| Other personal info (occupation, country, ethnicity, gender identity, relationship, religion) | Yes | Personalisation / analytics of user base | **Optional** (self-reported, "prefer not to say" allowed) |
| App activity / product interaction (PostHog) | Yes | **Analytics**, consent-gated | Optional (consent) |
| Crash / diagnostics (PostHog `api_error`) | Yes | App performance | Optional (consent) |
| Push subscription endpoint + timezone | Yes (opt-in) | Send the reminders you asked for | Optional |

**NOT collected — declare absent:** precise/approximate **location** (country is
self-reported text, not device location — do not tick Location), financial info,
photos/videos, audio, contacts, calendar, SMS/call logs.

> Special-category note: ethnicity and religion are UK-GDPR special category data
> and are strictly optional in-app. Play's Data Safety has no special-category
> field; declare them under the personal-info types above and keep them optional.

---

## D. Store listing (closed beta can be light, but fill the essentials)

- **Title:** Superdub · **Short description** (≤80 chars) · **Full description.**
- **Graphics:** app icon (512×512), feature graphic (1024×500), ≥2 phone
  screenshots (a 7"/10" tablet shot helps but isn't required for a closed track).
  Assets don't exist in the repo yet — capture from the running app.
- **Category:** Health & Fitness.
- **Contact email:** the support address already in-app (`privacy@superdub.app`
  or Ali's contact from About).

---

## E. Upload & release

1. **Testing → Closed testing** (or Internal/feedback track) → create a track,
   add tester emails or a Google Group.
2. Upload `app-release.aab`. Add release notes.
3. Roll out to the track. Testers get an opt-in link.
4. Play may still run the Data Safety / content-rating / health reviews even on a
   closed track — have B, C, D done before rollout.

---

## F. Per-upload checklist (every future beta build)

- [ ] Build from `origin/master`, green `CI=true npm run build`
- [ ] `npx cap sync android`
- [ ] Bump `versionCode` (> last uploaded) + `versionName` = `BUILD_TAG`
- [ ] Signed AAB via Android Studio
- [ ] Upload to the track, release notes, roll out

## Not part of the beta (deferred)
Billing/IAP, the `entitlement` branch (keep unmerged — a free beta must be
uncapped), the 25-day trial, feature gates, the paywall, and the iOS/App Store
build. See LAUNCH_STRATEGY.md for the paid plan once beta retention data exists.
