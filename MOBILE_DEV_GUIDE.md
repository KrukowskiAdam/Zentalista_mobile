# Zentalist Mobile — Dev Guide

---

## 1) Tools

| Tool | Use for |
|------|---------|
| **VS Code** | UI/logic edits (CSS, EJS, JS), config changes |
| **Chrome DevTools** | DOM/CSS inspection, Console, Network |
| **Android Studio** | Build, run on device, Logcat |
| **Xcode** | iOS builds, archives, signing |

---

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
| JSON (8 języków × 9 plików = 72 pliki) | **Pre-cache przy instalacji SW** + cache-first + background revalidate | Od drugiego uruchomienia apki |
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

## 3) Ważne dane i ścieżki

| Co | Wartość |
|---|---|
| Bundle ID | `com.zentalist.app` |
| Team ID | `6UZA69TBHY` |
| Firebase Project | `costam-3f612` |
| Mobile hosting | `zentalist-mobile.web.app` |
| Web hosting (nie ruszać!) | `zentalist.app` |
| Mobile function | `ssrMobile` |
| Web function | `ssr` |
| Mobile repo | `KrukowskiAdam/Zentalista_mobile` |
| Web repo | `KrukowskiAdam/mellowcards` |
| IPA path | `~/Desktop/ZentalistExport/App.ipa` |
| Archive path | `~/Library/Developer/Xcode/Archives/2026-04-12/` |
| Signing cert (development) | `Apple Development: krukowski.adam@gmail.com (VGQ69UMLQJ)` |
| Keystore path | `android/app/zentalist-release.keystore` |
| Keystore alias | `zentalist` |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` |
| JAVA_HOME (AGP 9.1.0) | `/Library/Java/JavaVirtualMachines/jbr-21.jdk/Contents/Home` |
| ADB Samsung device | `RFCW600MBWD` |
| Test device iOS | iPhone XR |
| Google Play Console | play.google.com/console |
| Review account | `review@zentalist.app` / `Review2026!` (premium: true w Firestore) |

---

## 4) IAP / RevenueCat

### Klucze API

| Platform | Klucz |
|---|---|
| iOS | `appl_DupvlMtnItoOiGvOuEwNtCDhimu` |
| Android | `goog_yUZKhlfcSpSoovWugIOOBRdjCWx` |

Oba klucze w `public/scripts/config/iapConfig.js`. Entitlement ID: `ZentaWeb Premium`.

### Produkty

| Plan | Product ID | Cena | iOS | Android |
|---|---|---|---|---|
| Monthly | `zentalist_premium_monthly` | $9.99/mies | ⬜ App Store Connect | ✅ Google Play |
| Annual | `zentalist_premium_annual` | $59.99/rok | ⬜ App Store Connect | ✅ Google Play |
| Lifetime | `zentalist_premium_lifetime` | $99.99 | ⬜ App Store Connect | ✅ Google Play |

### RevenueCat dashboard — stan

- ✅ Android products zaimportowane, podpięte do entitlement `ZentaWeb Premium` i offering `default`
- ✅ Service account RevenueCat dodany do Google Play z uprawnieniami
- ✅ Webhook skonfigurowany → `https://zentalist.app/revenuecatwebhook` (status 200 zweryfikowany)
- ⬜ iOS products — dodać po wgraniu buildu do App Store Connect (blokada: brak uploadu IPA)

### Webhook → Firestore (premium sync)

Zakup lub anulowanie w mobile automatycznie aktualizuje `users/{uid}.premium` w Firestore:

| Event RevenueCat | Akcja Firestore |
|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `NON_RENEWING_PURCHASE` | `premium: true` |
| `CANCELLATION`, `EXPIRATION`, `REFUND` | `premium: false` |
| `BILLING_ISSUE` | `paymentFailed: true` |

**Ważne:** `app_user_id` w RevenueCat musi być Firebase UID.
Weryfikacja: `iapService.initialize(user.uid)` jest wywoływane z `window.currentUser?.uid` w `premiumPaywall.js:245` — poprawne. ✅

Secret: `REVENUECAT_WEBHOOK_SECRET` zapisany w Firebase Secrets (wersja 2).
Cloud Function: `revenuecatWebhook` w `zentalist_web/functions/index.js`.

---

## 5) Publication Status

### Wspólne prerequisity

| Zadanie | Status |
|---------|--------|
| **Privacy Policy URL** | ✅ Istnieje |
| **Ikona app** (1024×1024 iOS, 512×512 Android) | ✅ Gotowe |

### 🔴 iOS — pozostałe kroki

| # | Zadanie | Status |
|---|---------|--------|
| 1 | **Testy na iPhone XR** | ⬜ Logowanie, nauka fiszek, safe-area, IAP paywall, logout |
| 2 | **Upload IPA do App Store Connect** | ⬜ Xcode → Organizer → Distribute App → App Store Connect (Xcode sam stworzy cert "Apple Distribution") lub Transporter z `~/Desktop/ZentalistExport/App.ipa` |
| 3 | **Produkty IAP w App Store Connect** | ⬜ Subscriptions → "Zentalist Premium" → Monthly ($9.99), Annual ($59.99). In-App Purchases → Lifetime ($99.99) |
| 4 | **Produkty iOS w RevenueCat** | ⬜ Dodać po kroku 3 — Products → 3 produkty iOS → podpiąć do entitlement i offering |
| 5 | **Screenshoty** | ✅ 7 szt. 1284×2778 — wgrane w App Store Connect |
| 6 | **Age Rating** | ⬜ App Store Connect → Age Rating → 4+ (brak przemocy, gambling, adult content) |
| 7 | **Submit for Review** | ⬜ Auto-release after approval ustawiony |

### 🟡 Android — pozostałe kroki

| # | Zadanie | Status |
|---|---------|--------|
| 1 | **Upload AAB do Closed Testing** | 🔄 Wersja `1.0.0-alpha` otwarta, AAB jeszcze nie wgrany |
| 2 | **12 testerów akceptuje zaproszenie** | ⬜ Od tego momentu startuje 14-dniowy zegar |
| 3 | **Produkty IAP w Google Play** | ✅ Wszystkie 3 utworzone |
| 4 | **Czekaj 14 dni z min. 12 testerami** | ⬜ Wymagane przez Google przed produkcją |
| 5 | **Złóż wniosek o dostęp produkcyjny** | ⬜ Po 14 dniach → Production |
| 6 | **Upload AAB do Production i Submit** | ⬜ |

---

## 6) Daily Dev Workflow

Wszystkie komendy z katalogu projektu:

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
1. Run app raz via Android Studio / Xcode.
2. Po zmianach UI — odśwież w apce. Full Run tylko jako ostateczny check.

### Quick loop
1. Edit w VS Code → 2. Terminale działają → 3. Refresh na urządzeniu → 4. Verify.

---

## 7) When to Rebuild

**Full rebuild wymagany** przy zmianach:
- Native Android/iOS code
- Capacitor plugins lub config
- App launch mode

```bash
npx cap copy android   # or: npx cap copy ios
```
Potem w Android Studio: Build > Clean Project > Run.

**Rebuild niepotrzebny** dla: CSS, HTML/EJS, frontend JS (w dev mode ładującym z lokalnego serwera).

---

## 8) Security Reminders

- Nigdy nie commituj `firebase-service-account.json` (nawet jeśli jest w .gitignore).
- Sekrety trzymaj poza repo — używaj zmiennych środowiskowych.
- Przed release buildem sprawdź że `capacitor.config.json` nie ma `server.url`.

---

## 9) Pre-release Quick Check

1. Brak `server.url` w `capacitor.config.json`
2. Brak sekretów śledzonych przez git
3. Finalny build + test na fizycznym urządzeniu (iOS + Android)
4. Sprawdź Logcat/Console pod kątem krytycznych błędów

---

## 10) Mobile QA Checklist (per page)

### 10.1) Challenge Page

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open `/challenge` during auth resolving | Spinner visible, no layout jumps |
| 2 | Open `/challenge` logged out | Login-required screen, easy tap CTA |
| 3 | Logged-in category list | Cards stack correctly, buttons aligned |
| 4 | No ready category (empty state) | Clear instruction to complete in Learn first |
| 5 | Start challenge — quiz readability | Header wraps, text readable, buttons easy to tap |
| 6 | Results screen (pass/fail) | Message readable, buttons stack, no safe-area overlap |

### 10.2) Stats Page

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open `/stats` during auth/sync | Spinner + loading copy visible |
| 2 | Open `/stats` logged out | Login-required screen |
| 3 | Logged-in synced state | Sync status clears, stats render without flicker |
| 4 | Slow sync / timeout | Local-data fallback, stats still usable |
| 5 | Empty stats | Empty-state card with next-step guidance |
| 6 | All Languages table on narrow phone | Horizontal scroll works, readable |

### 10.3) Premium Page

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Header readability | Title/subtitle readable, no cramped spacing |
| 2 | Pricing cards | Consistent spacing, tappable CTAs, no badge clipping |
| 3 | Paywall/restore actions | Status text readable, price note visible |

### 10.4) Profile Page

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Header and card spacing | Scales correctly, balanced paddings |
| 2 | Account info rows | Stack cleanly, labels/values don't collide |
| 3 | Save + Back buttons | Align correctly, comfortable tap targets |

---

## 11) Defect Logging Template

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
