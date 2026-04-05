# Mobile UX/UI QA + Screenshot Checklist

Date: 2026-03-22
Scope: mobile only (no desktop).

## Repository context (important)

- This repository is a mobile-only working base used to build iOS/Android apps (Capacitor).
- It is not the production desktop/web repository.
- Editing HTML/CSS/JS files here is allowed and expected when improving mobile app UX/UI.
- Production web lives in a separate repository/folder and is out of scope for changes done here.

## A) Test environment (mobile only)

- Devices:
  - iOS phone (real device)
  - Android phone (real device)
- Optional:
  - one small phone width (older/smaller screen)
  - one modern larger phone
- Network modes:
  - normal Wi-Fi/LTE
  - weak network
  - airplane mode for offline checks

## B) Mobile QA checklist (1:1)

### B1) Challenge page

1. Auth loading state
- Open /challenge while auth is still resolving.
- Expected:
  - Spinner visible.
  - Loading copy is visible and readable.
  - No layout jumps or overlapping blocks.

2. Logged-out state
- Open /challenge while logged out.
- Expected:
  - Login-required screen visible.
  - CTA button is easy to tap (touch target).
  - Content area for challenge cards stays hidden.

3. Logged-in category list
- Log in and open /challenge.
- Expected:
  - Challenge list appears without overflow.
  - Category cards stack correctly on mobile.
  - Action buttons are full-width or cleanly aligned on narrow screens.

4. Empty state (no ready category)
- Use account/language with no completed category.
- Expected:
  - Clear instruction to complete category in Learn first.
  - No broken placeholders.

5. Start challenge and quiz readability
- Start any available challenge.
- Expected:
  - Header (category + progress) wraps correctly.
  - Question text is readable at small width.
  - Answer buttons are easy to tap and do not clip text.

6. Results screen CTA layout
- Finish challenge (pass and fail).
- Expected:
  - Result message is readable.
  - Buttons stack correctly on phone.
  - No overlap with bottom safe area.

### B2) Stats page

1. Auth loading state
- Open /stats during auth/sync.
- Expected:
  - Spinner + loading copy visible.
  - Status banner messages are readable and not intrusive.

2. Logged-out state
- Open /stats while logged out.
- Expected:
  - Login-required screen visible.
  - CTA tap area is comfortable on mobile.

3. Logged-in synced state
- Log in and wait for sync.
- Expected:
  - Sync status appears then clears.
  - Main stats render without flicker.

4. Fallback state (local data)
- Simulate slow sync / timeout path.
- Expected:
  - Local-data fallback status appears.
  - Stats still render and remain usable.

5. Empty stats state
- Use account with no stats.
- Expected:
  - Empty-state card explains what to do next.
  - No raw warning blocks or broken UI.

6. All Languages table mobile behavior
- Scroll and inspect table on narrow phone.
- Expected:
  - Horizontal scroll works where needed.
  - Content remains readable.
  - Header and rows keep consistent spacing.

### B3) Premium page (visual)

1. Header readability
- Open /premium on phone.
- Expected:
  - Title/subtitle line lengths are readable.
  - No cramped spacing.

2. Pricing cards
- Scroll all plans.
- Expected:
  - Card spacing is consistent.
  - Plan CTA buttons are easy to tap.
  - No clipping in badges/ribbons.

3. Status/notes area
- Interact with paywall and restore actions.
- Expected:
  - Status text is readable.
  - Price note is visible in native-app context.

### B4) Profile page (visual)

1. Header and card spacing
- Open /profile on phone.
- Expected:
  - Header scales correctly.
  - Card paddings feel balanced.

2. Account info rows
- Inspect Email/Account Type/Trial/Member Since rows.
- Expected:
  - Rows stack cleanly on mobile.
  - Labels and values do not collide.

3. Actions row
- Inspect Save + Back buttons.
- Expected:
  - Buttons stack or align correctly.
  - Tap targets are comfortable.

## C) Screenshot checklist (before/after, mobile only)

Rule: each screenshot pair should use same device, orientation, and similar scroll position.

### C1) Challenge

- [ ] Challenge logged-out view (before)
- [ ] Challenge logged-out view (after)
- [ ] Challenge category list with cards (before)
- [ ] Challenge category list with cards (after)
- [ ] Challenge quiz question + answers (before)
- [ ] Challenge quiz question + answers (after)
- [ ] Challenge results screen (before)
- [ ] Challenge results screen (after)

### C2) Stats

- [ ] Stats loading/sync state (before)
- [ ] Stats loading/sync state (after)
- [ ] Stats empty state (before)
- [ ] Stats empty state (after)
- [ ] Stats main content with section table (before)
- [ ] Stats main content with section table (after)
- [ ] All Languages table on narrow width (before)
- [ ] All Languages table on narrow width (after)

### C3) Premium

- [ ] Premium header + first plan cards (before)
- [ ] Premium header + first plan cards (after)
- [ ] Premium CTA/status area (before)
- [ ] Premium CTA/status area (after)

### C4) Profile

- [ ] Profile header + first card (before)
- [ ] Profile header + first card (after)
- [ ] Profile account info rows (before)
- [ ] Profile account info rows (after)
- [ ] Profile action buttons area (before)
- [ ] Profile action buttons area (after)

## D) Defect logging template (mobile)

Use this format for each issue:

- ID:
- Device + OS:
- Page:
- Steps:
- Actual result:
- Expected result:
- Severity: Blocker / High / Medium / Low
- Screenshot/recording link:

## E) Sign-off (mobile UX/UI)

- Product:
- QA:
- Mobile:
- Date:

---

# iOS + Android Store Release Plan (Consolidated)

Last update: 2026-03-22

This section is the release tracker. It includes:
- current status,
- what is done,
- what is next,
- final go/no-go checklist.

## 0) Current External Blocker

- [ ] Apple Developer business verification pending (D&B case in progress)
- [ ] p8 App Store Connect API key cannot be generated yet
- [ ] RevenueCat Apple-side registration is blocked until verification is completed
- [ ] Payment-system updates are pending (workstream temporarily paused)

Tracking notes:
- Inquiry Tracking ID: `10107526`
- Case Number: `10171058`
- Submitted: `2026-03-21 19:30 UTC`
- Status: waiting for D&B / Apple verification completion

Temporary direction (2026-03-22):
- Pause payment-system implementation/QA tasks until updates are available.
- Prioritize UX/UI hardening for mobile release quality.

## 1) Current Status Snapshot

### Phase Status

- [x] Phase 0: Mobile payment path hardening complete
- [x] Phase 1: Capacitor foundation complete (simulator/device level)
- [x] Phase 2: Core mobile UX hardening complete (safe-area + touch targets)
- [ ] Phase 3: Mobile IAP integration complete (on hold: waiting for payment updates)
- [ ] Phase 4: Auth/state/security validation complete
- [ ] Phase 5: UX/UI polish and accessibility pass complete
- [ ] Phase 6: QA/TestFlight/Play testing complete

### Global Done Criteria

- [x] No non-IAP payment path is reachable inside mobile app
- [ ] Premium purchase and restore work on both platforms (fully verified)
- [ ] Premium unlock syncs to Firestore reliably (fully verified)
- [ ] Core app flows work on real iOS and Android devices
- [ ] Legal/privacy/store metadata aligned with app behavior
- [ ] Beta testing confirms release stability

## 2) What Is Already Done

- [x] Mobile runtime flag implemented (`window.__MOBILE_APP__` / platform detection)
- [x] Legacy non-IAP paths removed/disabled in mobile UI flow
- [x] Capacitor iOS + Android projects generated and synced
- [x] iOS build blocker resolved (Pods/script sandbox issue), build succeeds
- [x] First launch tests completed (iOS simulator + Android device)
- [x] Mobile UX baseline added: safe-area handling and touch-target classes
- [x] RevenueCat SDK integrated in app code
- [x] RevenueCat UI paywall plugin integrated (`@revenuecat/purchases-capacitor-ui`)
- [x] One-click native paywall test button added on premium screen
- [x] Restore purchases flow implemented in UI and service layer
- [x] Entitlement event wired to Firestore premium sync
- [x] RevenueCat test API key configured for iOS + Android in app config

## 3) What Is Still Ahead (Critical Path)

### Block UX: UX/UI Priority Track (active now)

- [ ] Audit all mobile screens for spacing, hierarchy, and visual consistency
- [ ] Improve premium/paywall screen readability and CTA clarity (copy + layout)
- [ ] Add loading/empty/error state polish for core learning and profile flows
- [ ] Verify tap target sizes and gesture comfort on real phones (iOS + Android)
- [ ] Improve navigation affordances and reduce accidental back/close actions
- [ ] Run accessibility pass: contrast, dynamic text behavior, and focus order
- [ ] Capture before/after screenshots for top 10 mobile screens

Recent implementation snapshot (2026-03-22):
- [x] Package 2 visual polish shipped for Challenge + Stats + Premium + Profile (responsive typography/spacing/touch targets)
- [x] Top-10 visual fixes documented in `UX_UI_TOP10_VISUAL_FIXES_2026-03-22.md`
- [x] Mobile-only QA + screenshot checklist prepared in this file
- [ ] Execute visual QA checklist and capture before/after screenshots

### Block IAP: Store Product Setup (paused)

Resume when payment updates are available and Apple verification is completed.

- [ ] Create App Store Connect products (monthly/yearly/lifetime) (blocked until Apple verification completes)
- [ ] Create Google Play products (monthly/yearly/lifetime)
- [ ] Map product IDs correctly to RevenueCat offering/packages

### Block IAP-QA: End-To-End IAP Validation (paused)

- [ ] iOS sandbox purchase end-to-end
- [ ] Android test billing purchase end-to-end
- [ ] iOS restore after reinstall
- [ ] Android restore after reinstall
- [ ] Verify cancellation/expiry behavior sync

### Block C: Auth/State/Security Validation

- [ ] Signup/login/logout/reset flows verified in mobile shell
- [ ] Premium state consistency after relog/restart/multi-device checks
- [ ] CSP/CORS/runtime domains validation for mobile environment
- [ ] Purchase transition logs captured for support/debug

### Block D: Compliance + Submission Readiness

- [ ] Legal copy finalized for Apple/Google purchase handling
- [ ] Privacy disclosures completed in store consoles
- [ ] Store metadata/screenshots/reviewer notes completed
- [ ] Account deletion path confirmed (if account creation is present)

## 4) Resume Here Next Time (Exact Steps)

When you come back, do this in order:

1. Run full UX/UI audit for top-priority mobile screens (home, learn, premium, profile, auth).
2. Implement UX/UI polish fixes for readability, spacing, and CTA clarity.
3. Complete state polish (loading/empty/error) in critical flows.
4. Execute accessibility checks on iOS and Android devices.
5. Capture screenshot evidence and update section 6 evidence checklist.
6. Re-run mandatory QA scenarios from section 7 with UX/UI regression focus.
7. Keep payment-system items paused until external updates arrive.
8. After updates arrive: resume product mapping and IAP E2E validation.

### While Waiting For Payment Updates (Work Now)

- [ ] Complete full mobile UX/UI audit pass and create prioritized fix list
- [ ] Polish premium, onboarding, and profile visual hierarchy on small screens
- [ ] Standardize button, input, and card spacing across pages/components
- [ ] Improve loading/empty/error states in core flows
- [ ] Prepare updated screenshot set for section 6 evidence checklist

## 5) Decision Gates

- [x] Gate A: no non-IAP payment path in mobile confirmed
- [ ] Gate B: iOS + Android shells stable on real devices
- [ ] Gate C: iOS + Android purchase and restore reliable (paused)
- [ ] Gate D: compliance + QA fully green

## 6) Mobile Store Readiness Checklist (Integrated)

Purpose: confirm iOS/Android parity for plans, entitlement behavior, and submission compliance.

### A. Plan Catalog Parity

- [ ] Plan names match across iOS and Android: Free, Monthly, Yearly, Lifetime
- [ ] Billing terms match displayed intent: monthly / yearly / one-time
- [ ] Feature promises match for each plan across iOS and Android
- [ ] Trial wording is consistent with actual behavior (duration and eligibility)
- [ ] Paywall CTA labels are clear about in-app purchase channel

Evidence:
- [ ] iOS screenshots captured
- [ ] Android screenshots captured

### B. Price Parity Policy

- [ ] In-app advertised prices are intentionally aligned with current store product strategy
- [ ] Team confirms acceptable differences caused by store tiers/taxes/FX
- [ ] Legal text explains that final in-app charge can vary by store/country
- [ ] No stale hardcoded prices in legal or FAQ pages

Evidence:
- [ ] RevenueCat offering screenshot
- [ ] App Store Connect products screenshot
- [ ] Google Play products screenshot

### C. Purchase and Restore Behavior

- [ ] iOS sandbox purchase succeeds end-to-end
- [ ] Android test billing purchase succeeds end-to-end
- [ ] Restore works after reinstall on iOS
- [ ] Restore works after reinstall on Android
- [ ] Cancellation and expiry behavior is reflected correctly after sync

Evidence:
- [ ] iOS test run notes
- [ ] Android test run notes

### D. Entitlement and Access Parity

- [ ] Single entitlement ID is used consistently: premium
- [ ] Post-purchase unlock appears in UI without manual refresh
- [ ] Firestore user premium state updates after purchase/restore
- [ ] Premium state survives logout/login and app restart
- [ ] Premium-gated routes/components behave the same on iOS and Android

Evidence:
- [ ] Firestore document snapshots captured
- [ ] UI unlock screenshots captured

### E. Legal, Metadata, and Support Parity

- [ ] Privacy policy describes mobile IAP (Apple/Google) correctly
- [ ] Terms clearly describe subscription renewal/cancellation per store
- [ ] Store listing metadata matches actual in-app behavior
- [ ] Reviewer notes include test account and steps to access premium flow
- [ ] Support documentation explains where user can manage/cancel subscription

Evidence:
- [ ] Final legal copy links recorded
- [ ] App Store review notes draft linked
- [ ] Google Play release notes draft linked

### F. Final Go/No-Go

- [ ] All sections A-E fully checked with evidence
- [ ] No known parity mismatch remains open
- [ ] Gate C can be marked complete
- [ ] Gate D can be marked complete

## 7) Mandatory QA Scenarios Before Submission

1. Fresh install -> signup/login -> start learning
2. Purchase premium in iOS sandbox
3. Purchase premium in Google test billing
4. Restore purchases after reinstall
5. Logout/login with same account
6. Weak network and airplane mode
7. Background/foreground transitions
8. Navigation through premium-gated features

Blocking bugs (no submit if present):
- [ ] Any non-IAP checkout path reachable in iOS app
- [ ] Any non-IAP checkout path reachable in Android app
- [ ] Blank/stuck screen without fallback over 3 seconds
- [ ] Purchase success but no premium unlock
- [ ] Restore purchases missing or broken

## 8) Owner Sign-Off

- Product:
- Mobile:
- Backend:
- QA:
- Date:
