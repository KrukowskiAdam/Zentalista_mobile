# Zentalist — App Store & Google Play Publication Checklist

---

## CO ZOSTAŁO ZROBIONE (sesja 12 kwietnia 2026)

### Architektura mobilna — Firebase Multi-site Hosting
- Utworzono osobny Firebase Hosting site: **zentalist-mobile.web.app** (mobile)
- Web desktop zostaje na **zentalist.app** — bez zmian, nietknięty
- W `.firebaserc` dodano target `"mobile"` → `"zentalist-mobile"`
- W `firebase.json` hosting sekcja ma `"target": "mobile"`, rewrites kierują na `ssrMobile`
- Funkcja Firebase: zmieniona z `ssr` na **`ssrMobile`** w `functions/index.js` (export name), żeby nie nadpisywać web function `ssr`
- Codebase w firebase.json ustawiony na `"mobile"` — Firebase traktuje to jako oddzielny deploy od web

### Capacitor Config (`capacitor.config.json`)
- `server.url` ustawiony na `"https://zentalist-mobile.web.app/home"` — to strona startowa apki
- `allowNavigation` dodane: `["zentalist-mobile.web.app", "*.googleapis.com", "*.firebaseapp.com"]` — zapobiega otwieraniu linków w zewnętrznej przeglądarce, wszystko zostaje w WebView

### Safe-area / Notch / Dynamic Island (wszystkie EJS templates)
- **Problem:** Content strony był zasłonięty przez navbar na urządzeniach z notchem/Dynamic Island
- **Fix:** Zmieniono `padding-top: 80px` na `padding-top: calc(80px + env(safe-area-inset-top, 0px))` we wszystkich 7 template'ach: `stats.ejs`, `challenge.ejs`, `leaderboard.ejs`, `premium.ejs`, `profile.ejs`, `legals.ejs`, `privacy.ejs`
- W `app.ejs` (strona /home i /learn): `#main-content` dostał `padding-top: calc(60px + env(safe-area-inset-top, 0px))`

### Welcome Card — warunkowo dla zalogowanych (`uiService.js`)
- Avatar/name/rank section na home screen jest teraz widoczny TYLKO gdy `window.currentUser` istnieje
- Dla gości (niezalogowanych) sekcja jest ukryta

### iOS App Store Requirements
1. **PrivacyInfo.xcprivacy** — nowy plik, dodany do projektu Xcode (project.pbxproj)
   - Deklaruje API: NSPrivacyAccessedAPICategoryUserDefaults (cel: AppFunctionality), NSPrivacyAccessedAPICategorySystemBootTime (cel: MeasureAppLaunchTime)
   - Zbierane dane: email (Account), purchase history (Purchases), user ID (Account) — nie do trackingu
   - `NSPrivacyTracking = false`
   - Wymagany od iOS 17 — bez niego Apple odrzuci build
   
2. **Info.plist** — dodane:
   - `NSAppTransportSecurity` — polityka HTTPS. `NSAllowsArbitraryLoads = false` (blokuje nieszyfrowane HTTP). Exception domains dla `firebaseapp.com` i `googleapis.com` (subdomain support)
   - `SKAdNetworkItems` — identyfikator RevenueCat: `cstr6suwn9.skadnetwork`. Pozwala Apple mierzyć konwersje z reklam prywatnie (SKAdNetwork). Wymagane gdy używasz RevenueCat

3. **project.pbxproj** — PrivacyInfo.xcprivacy dodany do:
   - PBXBuildFile section (ref: F1A2B3C4D5E6F7A800000002)
   - PBXFileReference section (ref: F1A2B3C4D5E6F7A800000001)
   - PBXGroup App children (widoczny w nawigatorze Xcode)
   - PBXResourcesBuildPhase files (kopiowany do bundla przy buildzie)

### Bug fix: Logout przekierowanie na web
- **Problem:** `window.location.href = "/"` po logout otwierało landing page, która mogła otwierać się w zewnętrznej przeglądarce zamiast w WebView
- **Fix:** Zmieniono na `window.location.href = "/home"` w `auth.js` linia ~421

### Bug fix: Menu nie pokazywało Profile/LogOut po logowaniu
- **Problem:** Po login → `onAuthStateChanged(user)` jest async (czeka na Firestore `getDoc()`). `setTimeout(reload, 500ms)` ubijał stronę ZANIM `setupUI()` zdążyła zapisać `mc_auth_state = 'logged-in'` do localStorage. Na przeładowanej stronie cache był pusty → menu domyślnie ukryte
- **Fix (auth.js):** W `.then()` handlerach login i signup dodano `localStorage.setItem('mc_auth_state', 'logged-in')` i `localStorage.setItem('mc_current_user_id', cred.user.uid)` PRZED reloadem
- **Fix (index.js):** W `setupUI(null)` dodano guard — jeśli `mc_auth_state === 'logged-in'` w cache, to `return` (nie chowaj menu). Zapobiega flashowi menu gdy Firebase SDK inicjalizuje się i tymczasowo raportuje `user = null`

### Archive & IPA
- Archiwum Xcode utworzone (unsigned) z terminala: `xcodebuild archive ... CODE_SIGNING_ALLOWED=NO`
- Wyeksportowano IPA z podpisem dystrybucyjnym: `xcodebuild -exportArchive` z `ExportOptions.plist` (method: app-store-connect, teamID: 6UZA69TBHY, automatic signing)
- IPA: `~/Desktop/ZentalistExport/App.ipa` (13 MB)
- Archiwum skopiowane do `~/Library/Developer/Xcode/Archives/2026-04-12/`
- Info.plist archiwum naprawiony (dodano Team i SigningIdentity, bo unsigned archive nie miał tych pól)
- **Problem z Organizer:** Archiwum się pojawia ale upload nie testowany z GUI — potrzebny certyfikat "Apple Distribution" (masz tylko "Apple Development"). Xcode Organizer powinien sam stworzyć brakujący cert przy Distribute App

### Commit & Push
- Commit `07cafbd6`: "feat: prepare mobile app for App Store submission" — 19 plików
- Pushed to `KrukowskiAdam/Zentalista_mobile` main branch
- Późniejsze fixy (logout redirect, menu bug) jeszcze nie scommitowane

### Sesja 15 kwietnia 2026

#### Apple Developer — migracja Individual → Organization (ANULOWANA)
- Rozpoczęto migrację konta z Individual na Organization (ZentaWeb)
- Apple zablokował tymczasowo dostęp do Certificates, Identifiers & Profiles
- **Problem:** JDG (sole proprietorship) w Polsce nie jest osobnym podmiotem prawnym — Apple nie akceptuje tego jako "legal entity"
- D-U-N-S: `436441916` — weryfikacja odrzucona: "This organization could not be verified as a legal entity"
- **Decyzja:** Anulowanie migracji, pozostajemy na Individual enrollment
- Wysłany mail do Kierana (Apple Developer Support) z prośbą o cancel
- **Seller name na App Store** będzie: `Adam Krukowski` (nie ZentaWeb) — to normalne dla indie dev
- ✅ Konto odblokowane (maj 2026) — Kieran (Apple Developer Support) przywrócił dostęp po mailowej korespondencji

#### RevenueCat — pełna konfiguracja dashboardu
- **Products** (3 szt., Zentalist iOS):
  - `zentalist_premium_monthly` — Subscription
  - `zentalist_premium_annual` — Subscription
  - `zentalist_premium_lifetime` — Non-consumable
- **Entitlement:** `ZentaWeb Premium` (identifier) z 3 produktami iOS
- **Offering:** `default` (current) z 3 packages: Monthly (`$rc_monthly`), Yearly (`$rc_annual`), Lifetime (`$rc_lifetime`)
- **Kod:** Zaktualizowano `iapConfig.js` — `entitlementId` zmieniony z `"premium"` na `"ZentaWeb Premium"` (dopasowanie do RevenueCat)
- Usunięto testowe produkty (Test Store) z entitlement i packages
- Produkty pokazują "Unverified" — zweryfikują się po stworzeniu w App Store Connect

### Słownictwo — poprawki (web repo)
- Usunięto trailing periods z 2968 angielskich wpisów słownikowych we wszystkich 8 językach (72 pliki JSON w zentalist_web)
- Zachowano podwójne/potrójne kropki (np. "etc...")
- Committed i pushed do zentalist_web main → auto-deployed przez GitHub Actions

---

## KROKI DO ZROBIENIA (REMAINING)

### 🔴 Krytyczne — przed submitem iOS

| # | Zadanie | Status | Szczegóły |
|---|---------|--------|-----------|
| 0 | **Testy na iPhone XR (realne urządzenie)** | ⬜ | Nowo kupiony iPhone XR — przetestować całą apkę: logowanie, nauka fiszek, nawigacja, safe-area/notch, IAP paywall, logout. Zdeployować build deweloperski przez Xcode (Device → Run) lub TestFlight |
| 1 | **Upload build do App Store Connect** | ⬜ | Otwórz Xcode → Window → Organizer → "Zentalist 2026-04-12" → Distribute App → App Store Connect → Upload. Xcode sam stworzy certyfikat "Apple Distribution" jeśli brakuje. Alternatywnie: Transporter app z `~/Desktop/ZentalistExport/App.ipa` |
| 2 | **Produkty IAP w App Store Connect** | ⬜ | App Store Connect → Twoja app → Subscriptions → Create Subscription Group "Zentalist Premium" → Monthly ($9.99, ID: `zentalist_premium_monthly`), Annual ($59.99, ID: `zentalist_premium_annual`). In-App Purchases → Non-Consumable: Lifetime ($99.99, ID: `zentalist_premium_lifetime`) |
| 3 | **Produkty IAP w RevenueCat** | ⬜ | RevenueCat dashboard → Products → dodaj te 3 produkty. Offerings → Create "default" offering → dodaj 3 packages (Monthly, Annual, Lifetime) |
| 4 | **Screenshoty w App Store Connect** | ⬜ | Mamy 7 screenshotów (1284×2778) na Desktopie. Wgraj w App Store Connect → App Information → Screenshots (wymagane: 6.7" iPhone — nasz rozmiar pasuje) |
| 5 | **Age Rating Questionnaire** | ⬜ | App Store Connect → Age Rating → wypełnij (brak przemocy, brak gambling, brak adult content → Rating 4+) |
| 6 | **Commit ostatnich fixów** | ⬜ | Logout redirect i menu bug fix — `git add -A && git commit && git push` |
| 7 | **Submit for Review** | ⬜ | App Store Connect → Submit for Review. Auto-release after approval jest ustawiony |

### Sesja 17 kwietnia 2026 — Android build & QA na Samsung

#### Android Signing & Build Infrastructure
- Wygenerowano keystore: `zentalist_mobile/android/app/zentalist-release.keystore` (RSA 2048, ważny 10000 dni)
- Skonfigurowano signing w `app/build.gradle` — `keystoreProperties` z `keystore.properties`, `signingConfigs.release`
- `keystore.properties` (gitignored): storeFile, storePassword, keyAlias, keyPassword
- AGP 9.1.0 wymagał JetBrains Runtime 21 — zainstalowano JBR 21 do `/Library/Java/JavaVirtualMachines/jbr-21.jdk`
- Dodano `jvmToolchain(21)` w `build.gradle` (root) dla Kotlin
- Release AAB: `app/build/outputs/bundle/release/app-release.aab` (14 MB) — gotowy do uploadu

#### QA na Samsung (device: RFCW600MBWD via ADB)
- Debug APK zainstalowany i testowany bezpośrednio na urządzeniu

#### UI Fixes — mobile
1. **Cookie banner na Capacitor** — `menu.ejs` (~linia 270): dodano `Capacitor.isNativePlatform()` check, auto-akceptuje cookies w native app
2. **Hero padding** — `index.ejs` (linia 17): `pt-20` → `pt-10` (mniej pustej przestrzeni na górze home)
3. **Cards-grid padding** — `card.css` (linia 120): `padding-top: 100px` → `50px`
4. **Continue button logic** — `uiService.js` (~linia 225-242): zmieniono z `.find()` (pierwsza kategoria) na `.filter()+.reduce()` (kategoria najbliższa ukończeniu — najwyższy stosunek locked/total)

#### Splash Screen Fix
- **Problem:** Stare `splash.png` w 10 folderach `drawable-land-*` i `drawable-port-*` nadpisywały nowy splash
- **Fix:** Usunięto wszystkie stare splash.png z folderów gęstości
- `styles.xml` — zmieniono z `android:background` (nie działa z AndroidX SplashScreen) na:
  - `windowSplashScreenBackground` → `#000000`
  - `windowSplashScreenAnimatedIcon` → `@drawable/splash_logo`
  - `postSplashScreenTheme` → `@style/AppTheme.NoActionBar`
- Logo 300x300 osadzone w canvas 480x480 (90px padding) — mieści się w okrągłej masce Android 12+

#### App Name Fix
- `strings.xml` — zmieniono "Kanji Matcher" na "Zentalist" (app_name + title_activity_main)
- `package_name` i `custom_url_scheme` zmienione na `com.zentalist.app`

#### Launcher Icons
- Ręcznie zastąpione przez użytkownika w Android Studio — wszystkie `mipmap-*` foldery z .webp
- Usunięto stare `drawable/ic_launcher_background.xml` i `drawable-v24/ic_launcher_foreground.xml`

#### Firebase Deploy
- `firebase deploy --only functions,hosting` — wszystkie zmiany mobile wdrożone na `zentalist-mobile.web.app`

#### Stan na koniec sesji
- ✅ Debug APK działa poprawnie na Samsung — splash, ikona, nazwa, UI
- ⬜ **Następny krok:** Rebuild release AAB (`bundleRelease`) z wszystkimi fixami i upload na Google Play Console

---

### Sesja 18–19 maja 2026 — Closed Alpha konfiguracja

#### Co zrobiono
- Rebuild release AAB (`bundleRelease`) — wszystkie taski UP-TO-DATE, podpisany, 14 MB
- Google Play Console: Create App → "Zentalist", Free, Education
- Wypełniono całą sekcję "Dokończ konfigurowanie aplikacji":
  - Polityka prywatności: `https://zentalist.app/privacy`
  - Dostęp aplikacji: wszystko dostępne bez specjalnego dostępu
  - Reklamy: brak
  - Ocena treści (IARC): wypełniona → PEGI 3 / Everyone
  - Odbiorcy: 18+, blokada małoletnich włączona
  - Bezpieczeństwo danych: email, user ID, purchase history, crash logs, diagnostyka, interakcje — wypełnione
  - Funkcje finansowe: brak
  - Zdrowie: brak
  - Ad ID: nie używamy
  - Kategoria: Edukacja
  - Dane kontaktowe: krukowski.adam@gmail.com / zentalist.app
  - Store listing: screenshoty Android wgrane, ikona 512×512, feature graphic 1024×500
  - Opisy EN: krótki (80 znaków), pełny z akcentem na globalne rankingi i zbieranie punktów

#### Closed Alpha — sesja 18–19.05.2026

- Weszliśmy w Testing → Closed testing → Alpha
- Kliknięto "Utwórz nową wersję" — wypełniono:
  - Nazwa wersji: `1.0.0-alpha`
  - Release notes (en-US): `Initial alpha release. Try out Zentalist — learn vocabulary with flashcards and compete on global leaderboards.`
- Otwarto sekcję Kraje/regiony — lista widoczna, gotowa do zaznaczenia
- **Problem:** brak 12 testerów — szukamy (znajomi, Reddit r/androiddev/r/betatesting, własne konta Gmail)
- AAB jeszcze nie wgrany do tej wersji

#### Następny krok — Closed Testing (14-dniowy zegar!)

### 🟡 Google Play — pozostałe kroki

| # | Zadanie | Status | Szczegóły |
|---|---------|--------|-----------|
| 10 | **Closed Testing — konfiguracja** | 🔄 | Wersja `1.0.0-alpha` w toku — kraje do zaznaczenia (wszystkie), brak 12 testerów (szukamy: znajomi / Reddit / własne Gmail) |
| 11 | **Upload AAB do Closed Testing** | 🔄 | Wersja otwarta, wypełnione szczegóły — AAB jeszcze nie wgrany. Plik: `android/app/build/outputs/bundle/release/app-release.aab` |
| 12 | **12 testerów akceptuje zaproszenie** | ⬜ | Muszą zainstalować apkę — od tego momentu startuje 14-dniowy zegar |
| 13 | **Produkty IAP w Google Play** | ⬜ | Monetize → Subscriptions: Monthly ($9.99, `zentalist_premium_monthly`), Annual ($59.99, `zentalist_premium_annual`). In-app: Lifetime ($99.99, `zentalist_premium_lifetime`) |
| 14 | **Produkty IAP w RevenueCat (Android)** | ⬜ | RevenueCat dashboard → dodaj 3 produkty Google Play, podepnij do entitlement i offering |
| 15 | **Czekaj 14 dni z min. 12 testerami** | ⬜ | Wymagane przez Google przed dostępem do produkcji |
| 16 | **Poproś o dostęp produkcyjny** | ⬜ | Po 14 dniach → Production → złóż wniosek |
| 17 | **Upload AAB do Production i Submit** | ⬜ | Production → Create release → upload AAB → Submit |

### ✅ Zrobione

| Zadanie | Status |
|---|---|
| Privacy Policy page (URL) | ✅ `/privacy` route |
| Ikona app (1024x1024 iOS, 512x512 Android) | ✅ |
| RevenueCat produkcyjne klucze | ✅ `appl_DupvlMtnItoOiGvOuEwNtCDhimu` (iOS), `goog_yUZKhlfcSpSoovWugIOOBRdjCWx` (Android) |
| RevenueCat dashboard — Products, Entitlement, Offering | ✅ 3 produkty iOS, entitlement `ZentaWeb Premium`, offering `default` z 3 packages |
| iapConfig.js — entitlementId fix | ✅ Zmieniony na `"ZentaWeb Premium"` |
| Keystore Android | ✅ Wygenerowany |
| Mobile Firebase Hosting (zentalist-mobile.web.app) | ✅ Deployed |
| ssrMobile function | ✅ Deployed |
| Safe-area padding (wszystkie templates) | ✅ |
| PrivacyInfo.xcprivacy | ✅ W projekcie Xcode + w bundlu |
| Info.plist (ATS + SKAdNetwork) | ✅ |
| App Store listing texts | ✅ Wypełnione w App Store Connect |
| Review account | ✅ `review@zentalist.app` / `Review2026!` (premium: true w Firestore) |
| Screenshots iOS | ✅ 7 szt., 1284×2778 |
| Auto-release after approval | ✅ Ustawione |
| Archive + IPA | ✅ `~/Desktop/ZentalistExport/App.ipa` (13 MB) |
| Vocabulary fix (trailing periods) | ✅ Deployed to web |
| Logout redirect fix | ✅ `/home` zamiast `/` |
| Menu visibility after login fix | ✅ Cache auth state before reload |
| `npx cap sync` | ✅ |
| Apple migration cancel request | ✅ Mail wysłany 15.04.2026, czekamy na odblokowanie |
| Android signing config (keystore + build.gradle) | ✅ Sesja 17.04 |
| JetBrains Runtime 21 (dla AGP 9.1.0) | ✅ `/Library/Java/JavaVirtualMachines/jbr-21.jdk` |
| Cookie banner hidden on Capacitor native | ✅ `menu.ejs` — auto-accept |
| Hero + cards-grid padding reduced | ✅ `index.ejs` pt-10, `card.css` 50px |
| Continue button — closest to completion | ✅ `uiService.js` — .filter+.reduce |
| Splash screen fix (AndroidX SplashScreen API) | ✅ Czarne tło + padded logo 480x480 |
| App name → "Zentalist" | ✅ `strings.xml` |
| Launcher icons replaced | ✅ Wszystkie mipmap-* (.webp) |
| Firebase mobile deploy (17.04) | ✅ functions + hosting |
| Samsung QA — debug APK verified | ✅ Splash, ikona, nazwa, UI OK |

---

## Ważne dane i ścieżki

| Co | Wartość |
|---|---|
| Bundle ID | `com.zentalist.app` |
| Team ID | `6UZA69TBHY` |
| Firebase Project | `costam-3f612` |
| Mobile hosting | `zentalist-mobile.web.app` |
| Web hosting (nie ruszać!) | `zentalist.app` |
| Mobile function | `ssrMobile` |
| Web function | `ssr` |
| IPA path | `~/Desktop/ZentalistExport/App.ipa` |
| Archive path | `~/Library/Developer/Xcode/Archives/2026-04-12/` |
| ExportOptions | `~/Desktop/ExportOptions.plist` |
| Signing cert (development) | `Apple Development: krukowski.adam@gmail.com (VGQ69UMLQJ)` |
| Distribution cert | ⬜ Brak — Xcode Organizer stworzy automatycznie przy Distribute App |
| Mobile repo | `KrukowskiAdam/Zentalista_mobile` |
| Web repo | `KrukowskiAdam/mellowcards` |
| JAVA_HOME (AGP 9.1.0) | `/Library/Java/JavaVirtualMachines/jbr-21.jdk/Contents/Home` |
| Keystore path | `android/app/zentalist-release.keystore` |
| Keystore alias | `zentalist` |
| ADB Samsung device | `RFCW600MBWD` |
| Test device iOS | iPhone XR (nowo zakupiony, fizyczne testy przed submitem) |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` (14 MB, podpisany, rebuild 17.05.2026) |
| Google Play Console | play.google.com/console — app utworzona 17.05.2026 |
