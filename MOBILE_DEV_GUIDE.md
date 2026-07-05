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
| App Store Connect App ID | `6760947012` |
| App Store Connect API Key (CLI/automatyzacja) | Key ID `4X497V8UMJ`, Issuer ID `ed9114eb-f18b-451e-bb69-186e34a51699`, plik `.p8` w `~/.appstoreconnect/private_keys/AuthKey_4X497V8UMJ.p8` (nie commitować, nie wklejać zawartości) |
| App Store Connect API Key (RevenueCat) | `AuthKey_8S3P224QMC.p8` — osobny klucz używany przez RevenueCat do subscription status, zostawić w spokoju |

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
| 2 | **Upload IPA do App Store Connect** | ✅ Zrobione 2026-07-05 21:23 przez Xcode Organizer (Distribute App → App Store Connect → Upload). Build 1.0 (1) → status przetwarzania: **VALID** (zweryfikowane przez App Store Connect API). Archive z poprawnym `server.url` (drugi, po naprawie błędu z sekcji 5a). App ID w App Store Connect: `6760947012` |
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

## 5a) Log: pierwszy Archive + Export iOS (2026-07-05)

Poniżej pełna ścieżka od "release build ma `server.url`" do gotowego `App.ipa`, ze wszystkimi napotkanymi przeszkodami — przyda się przy kolejnych buildach, jeśli błędy signing/provisioning wrócą.

### ⚠️ WAŻNE: `server.url` w `capacitor.config.json` MUSI zostać

Na początku tej sesji usunęliśmy `server.url` z `capacitor.config.json`, myśląc że to zalecane dla release (błędnie wzięte z punktu 9 "Pre-release Quick Check" poniżej). **To był błąd i zostało cofnięte.**

`public/index.html` bundlowany w appce to tylko cienka "shell" strona (`<title>Zentalist Mobile Shell</title>`) z linkiem "Open app" — **nie zawiera prawdziwej appki**. Prawdziwa appka jest renderowana server-side (funkcja `ssrMobile`, patrz sekcja 2) i serwowana z `zentalist-mobile.web.app` — to jest właściwy, produkcyjny mobile hosting, nie jakiś dev/staging URL. Bez `server.url` appka po starcie pokazuje tylko niebieski ekran-shell zamiast prawdziwej treści, bo self-redirect w `index.html` działa tylko w trybie http/https, nie w `capacitor://`.

**Wniosek:** punkt 9 "Brak `server.url`" w Pre-release Quick Check odnosi się najpewniej do lokalnego dev-owego URL-a używanego przy live-reloadzie (np. `http://192.168.x.x:3000`), a NIE do usunięcia produkcyjnego `zentalist-mobile.web.app`. Jeśli kiedyś ta appka faktycznie ma działać w pełni z bundlowanych plików (offline-first SPA), to wymaga osobnego przepisania `public/` na pełną appkę — to nie jest obecny stan projektu.

### Co zostało zmienione w repo (finalnie)

1. **`ios/App/App.xcodeproj/project.pbxproj`** — usunięty stary wpis `CODE_SIGN_IDENTITY = "iPhone Developer"` z **projektowej** (nie targetowej) konfiguracji Release — pozostałość domyślnego szablonu Xcode/Capacitor, kolidująca z automatycznym signing na poziomie targetu.
2. `capacitor.config.json` — **bez zmian względem stanu wyjściowego** (server.url z `zentalist-mobile.web.app/home` zostaje).
3. `npx cap sync ios` uruchamiane po każdej zmianie configu (skopiuje `public/` do `ios/App/App/public` + zaktualizuje `ios/App/App/capacitor.config.json` + `pod install`).

### Wymagane narzędzia (brakowało ich na tym Macu)

- **CocoaPods** nie był zainstalowany → `brew install cocoapods`.
- **`xcode-select` wskazywał na Command Line Tools**, nie na pełne Xcode → `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` (wymaga hasła, trzeba odpalić ręcznie w terminalu, nie przez agenta).

### Signing/Provisioning — dlaczego `xcodebuild archive` failował (4 rundy błędów)

1. **Keychain miał 0 identity code-signing** (`security find-identity -v -p codesigning` → `0 valid identities found`), mimo że w Xcode dodano konto Apple ID (Settings → Accounts). Automatyczne signing nie miało z czego stworzyć certyfikatu.
2. Po dodaniu konta: błąd **"Revoke certificate: ... its private key is not installed in your keychain"** — konto miało już zarejestrowany certyfikat Apple Development z innej maszyny, ale bez lokalnego klucza prywatnego. To wymaga **interaktywnego** potwierdzenia w Xcode GUI (celowe zabezpieczenie Apple — `xcodebuild -allowProvisioningUpdates` samo tego nie zrobi).
3. Po interakcji w Xcode (Signing & Capabilities): błąd **"Your team has no devices from which to generate a provisioning profile"** — nawet dla Release/archive, automatyczne signing Xcode zawsze chce mieć też ważny profil **Development** (dev+distribution trzymane w parze), a to wymaga zarejestrowanego urządzenia.
4. Podłączenie fizycznego iPhone'a XR **nie zadziałało** — przejściówka Lightning nie miała pinów danych (tylko zasilanie), więc Mac w ogóle nie widział urządzenia (`system_profiler`, `xcrun devicectl`, `xcrun xctrace list devices` — wszystkie puste dla urządzeń fizycznych).
5. **iPad z natywnym kablem USB-C zadziałał** — `xcrun xctrace list devices` zaczął go pokazywać. Ale samo podłączenie **nie rejestruje** urządzenia na koncie deweloperskim — potrzebny był:
   - Enable **Developer Mode** na urządzeniu (Ustawienia → Prywatność i bezpieczeństwo → Developer Mode → restart)
   - Faktyczny **Run (▶️) z Xcode GUI** na to urządzenie (build Debug z terminala przez `xcodebuild ... -destination "id=..." build` NIE rejestrował urządzenia mimo `-allowProvisioningUpdates` — rejestracja zadziałała dopiero przez pełną sesję IDE, nie CLI)
6. Dopiero po tym `xcodebuild archive` przeszedł. Archive podpisał się `Apple Development` (bo taki miał w danej chwili aktywny profil), ale **`xcodebuild -exportArchive`** z `method: app-store-connect` w `exportOptions.plist` poprawnie **re-podpisał wszystko certyfikatem "Cloud Managed Apple Distribution"** — to jest oczekiwane zachowanie, nie błąd.

### Komendy użyte do finalnego archive + export

```bash
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -archivePath ~/Desktop/ZentalistExport/App.xcarchive \
  -destination "generic/platform=iOS" -allowProvisioningUpdates archive

xcodebuild -exportArchive \
  -archivePath ~/Desktop/ZentalistExport/App.xcarchive \
  -exportPath ~/Desktop/ZentalistExport \
  -exportOptionsPlist exportOptions.plist -allowProvisioningUpdates
```

`exportOptions.plist` użyty:
```xml
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>6UZA69TBHY</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
```

**Wynik:** `~/Desktop/ZentalistExport/App.ipa` (12.5 MB), build 1, version 1.0, podpisany Apple Distribution, ważny do 12/2027.

**Uwaga:** archiwum zbudowane przez `xcodebuild archive -archivePath <custom path>` **nie pojawia się automatycznie w Xcode Organizer** (Organizer domyślnie skanuje tylko `~/Library/Developer/Xcode/Archives/`). Żeby je tam zobaczyć: `open ~/Desktop/ZentalistExport/App.xcarchive` (otwarcie pliku archiwum rejestruje go w Organizerze).

**Upload do App Store Connect:** zrobiony przez Xcode Organizer → Distribute App → App Store Connect → Upload (Transporter.app nie był zainstalowany na tym Macu, ale nie jest potrzebny — Organizer używa już zalogowanego w Xcode konta Apple ID). Status: "Uploaded to Apple", 2026-07-05 21:23, build 1.0 (1).

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
