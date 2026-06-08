# Zentalist Mobile — Dev Guide

---

## 1) Tools

| Tool | Use for |
|------|---------|
| **VS Code** | UI/logic edits (CSS, EJS, JS), config changes |
| **Chrome DevTools** | DOM/CSS inspection, Console, Network |
| **Android Studio** | Build, run on device, Logcat |
| **Xcode** | iOS builds, archives, signing |

## 2) How the App Works

### 2.1) /learn — Data Flow

#### Flashcard JSON

JSON-y z fiszkami są pobierane przez `dataService.js` z **Firebase Hosting** web-projektu (`costam-3f612.web.app`) — nie z Firestore. Na język przypada 9 plików:

```
https://costam-3f612.web.app/languages/{lang}/{lang}_en_01.json  ← free
https://costam-3f612.web.app/languages/{lang}/{lang}_en_02.json  ← premium1
...
https://costam-3f612.web.app/languages/{lang}/{lang}_en_09.json  ← premium8
```

URL-e są budowane w `public/scripts/utils/config.js` przez funkcję `getJsonUrls()`.

`dataService.js` dodaje `?nocache=timestamp` do każdego URL-a żeby zapobiec cache'owaniu przez przeglądarkę — tym zajmuje się Service Worker (patrz niżej).

#### MP3 audio

Każdy wpis w JSON-ie ma pole `audio` z bezpośrednim URL-em do **Firebase Storage**:

```
https://storage.googleapis.com/costam-3f612.firebasestorage.app/audio/es/03/es_0001.mp3
```

Odtwarzanie przez `new Audio(word.audio)` w `buttonComponent.js` (z cache) i `challengePage.js`.

#### Offline — Service Worker (`public/sw.js`)

SW obsługuje offline w trybie hybrydowym:

| Zasób | Strategia | Kiedy dostępne offline |
|-------|-----------|------------------------|
| JSON (wszystkie 8 języków × 9 plików = 72 pliki) | **Pre-cache przy instalacji SW** + cache-first + background revalidate | Od drugiego uruchomienia apki |
| MP3 | **Cache on demand** — sieć → zapis do cache → przy kolejnym odtworzeniu serwowane z cache | Po pierwszym odtworzeniu danego słowa |
| Strony HTML | Network-first z fallbackiem na stronę offline | Zawsze (wbudowany offline HTML) |

SW stripuje `?nocache=timestamp` z URL-a JSON-a i używa czystego URL-a jako klucza cache (`zentalist-json-v2`). MP3 trafiają do osobnego cache (`zentalist-audio-v2`).

**Ograniczenie:** pierwsze uruchomienie apki bez internetu nie zadziała — SW musi się najpierw zainstalować przy połączeniu online.

#### Firestore

Firestore **nie** przechowuje treści fiszek. Używany tylko do:

| Co | Gdzie w kodzie |
|----|----------------|
| Progress / stan nauki użytkownika | `syncService.js` — `getDoc` / `getDocFromServer` |
| Leaderboard | `uiService.js` — `getDocs` z kolekcji `leaderboard` |
| Status premium | `premiumService.js` — `getDoc` |

---

## 3) Daily Workflow

All commands from the project directory:

```bash
cd /Users/adamkrukowski/Desktop/WEB/ZENTALIST/zentalist_mobile
```

### Terminal A — backend

```bash
npx firebase-tools emulators:start --only hosting,functions
```

### Terminal B — styles

```bash
npm run tailwind
```

### Device testing
1. Run app once via Android Studio / Xcode.
2. After UI changes — refresh in-app. Full Run only as final check.

### Quick loop
1. Edit in VS Code → 2. Check terminals running → 3. Refresh on device → 4. Verify.

## 4) When to Rebuild

**Full rebuild required** when changing:
- Native Android/iOS code
- Capacitor plugins or config
- App launch mode

```bash
npx cap copy android   # or: npx cap copy ios
```
Then in Android Studio: Build > Clean Project > Run.

**No rebuild needed** for: CSS, HTML/EJS, frontend JS (if running in dev mode loading from local server).

## 5) Security Reminders

- Never commit `firebase-service-account.json` (even if gitignored).
- Keep secrets out of repo — use environment variables.
- Verify `capacitor.config.json` has no `server.url` before release builds.

## 6) Pre-release Quick Check

1. No `server.url` in `capacitor.config.json`
2. No secrets tracked by git
3. Final build + test on physical device (iOS + Android)
4. Check Logcat/Console for critical errors

---

## 7) Mobile QA Checklist (per page)

### 7.1) Challenge Page

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open `/challenge` during auth resolving | Spinner visible, no layout jumps |
| 2 | Open `/challenge` logged out | Login-required screen, easy tap CTA |
| 3 | Logged-in category list | Cards stack correctly, buttons aligned |
| 4 | No ready category (empty state) | Clear instruction to complete in Learn first |
| 5 | Start challenge — quiz readability | Header wraps, text readable, buttons easy to tap |
| 6 | Results screen (pass/fail) | Message readable, buttons stack, no safe-area overlap |

### 7.2) Stats Page

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open `/stats` during auth/sync | Spinner + loading copy visible |
| 2 | Open `/stats` logged out | Login-required screen |
| 3 | Logged-in synced state | Sync status clears, stats render without flicker |
| 4 | Slow sync / timeout | Local-data fallback, stats still usable |
| 5 | Empty stats | Empty-state card with next-step guidance |
| 6 | All Languages table on narrow phone | Horizontal scroll works, readable |

### 7.3) Premium Page

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Header readability | Title/subtitle readable, no cramped spacing |
| 2 | Pricing cards | Consistent spacing, tappable CTAs, no badge clipping |
| 3 | Paywall/restore actions | Status text readable, price note visible |

### 7.4) Profile Page

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Header and card spacing | Scales correctly, balanced paddings |
| 2 | Account info rows | Stack cleanly, labels/values don't collide |
| 3 | Save + Back buttons | Align correctly, comfortable tap targets |

---

## 8) Home UX Plan

### Phase 1 — Done
- `/home` shows Learn Home block (continue learning CTA, daily plan, progress, quick actions)
- `/learn` stays focused on flashcards
- Logo/menu routes to `/home`

### Phase 2 — Next
- Tune info hierarchy based on reference apps (Quizlet, GeoGuessr)
- Decide final top metrics (streak, minutes, words, stars)
- Consider bottom quick-nav (without duplicating drawer UX)

### Phase 3 — Motion polish
- Card reveal stagger on first load
- Progress bar count-up animation
- Optional lightweight Lottie in Home hero
- Respect `prefers-reduced-motion`

### Acceptance
- First screen answers: "What should I do now?"
- Main CTA visible without scrolling
- First learning interaction in ≤ 2 taps
- No regression in sidebar/category/cards

---

## 9) RevenueCat / Google Play — Status konfiguracji

### Produkty Android (Google Play Console)

| Plan | Typ | Cena | Product ID | Status |
|---|---|---|---|---|
| Monthly | Subskrypcja | $9.99/mies | `zentalist_premium_monthly` | ✅ Utworzony, base plan `monthly-base` |
| Annual | Subskrypcja | $59/rok | `zentalist_premium_annual` | ✅ Utworzony, base plan `annual-base` |
| Lifetime | Produkt jednorazowy (non-consumable) | $99 | `zentalist_premium_lifetime` | ✅ Utworzony, opcja `lifetime-base` |

### Produkty iOS (App Store Connect)

| Plan | Product ID | Status |
|---|---|---|
| Monthly | `zentalist_premium_monthly` | ⬜ "Not found" w RevenueCat — trzeba dodać w App Store Connect |
| Annual | `zentalist_premium_annual` | ⬜ "Not found" w RevenueCat — trzeba dodać w App Store Connect |
| Lifetime | `zentalist_premium_lifetime` | ⬜ "Not found" w RevenueCat — trzeba dodać w App Store Connect |

### RevenueCat — co zostało skonfigurowane

- ✅ Android API key: `goog_yUZKhlfcSpSoovWugIOOBRdjCWx` (w `iapConfig.js`)
- ✅ iOS API key: `appl_DupvlMtnItoOiGvOuEwNtCDhimu` (w `iapConfig.js`)
- ✅ Entitlement ID: `ZentaWeb Premium`
- ✅ Service account RevenueCat dodany do Google Play Console z uprawnieniami (View financial data + Manage orders)
- ✅ Android products — zaimportowane do RevenueCat
- ✅ Entitlements — wszystkie 3 Android produkty podpięte do `ZentaWeb Premium`
- ✅ Offerings `default` — każdy package (Monthly/Yearly/Lifetime) ma Android produkt
- ⬜ iOS products — dodać w App Store Connect (blokada: czekamy na fizyczny iPhone do testów)

### Następny krok

1. Poczekać na 12 testerów (closed testing) → przetestować zakupy na Android
2. iOS — gdy gotowy: App Store Connect → In-App Purchases → dodać 3 produkty z tymi samymi ID
3. Po naprawieniu iOS "Not found" w RevenueCat — zrobić test zakupu na iPhone

---

## 10) Defect Logging Template

```
- ID:
- Device + OS:
- Page:
- Steps:
- Actual result:
- Expected result:
- Severity: Blocker / High / Medium / Low
- Screenshot/recording link:
```
