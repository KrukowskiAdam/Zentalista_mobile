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
- ⏳ Czekamy na odpowiedź Apple i odblokowanie konta

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
| 1 | **Upload build do App Store Connect** | ⬜ | Otwórz Xcode → Window → Organizer → "Zentalist 2026-04-12" → Distribute App → App Store Connect → Upload. Xcode sam stworzy certyfikat "Apple Distribution" jeśli brakuje. Alternatywnie: Transporter app z `~/Desktop/ZentalistExport/App.ipa` |
| 2 | **Produkty IAP w App Store Connect** | ⬜ | App Store Connect → Twoja app → Subscriptions → Create Subscription Group "Zentalist Premium" → Monthly ($9.99, ID: `zentalist_premium_monthly`), Annual ($59.99, ID: `zentalist_premium_annual`). In-App Purchases → Non-Consumable: Lifetime ($99.99, ID: `zentalist_premium_lifetime`) |
| 3 | **Produkty IAP w RevenueCat** | ⬜ | RevenueCat dashboard → Products → dodaj te 3 produkty. Offerings → Create "default" offering → dodaj 3 packages (Monthly, Annual, Lifetime) |
| 4 | **Screenshoty w App Store Connect** | ⬜ | Mamy 7 screenshotów (1284×2778) na Desktopie. Wgraj w App Store Connect → App Information → Screenshots (wymagane: 6.7" iPhone — nasz rozmiar pasuje) |
| 5 | **Age Rating Questionnaire** | ⬜ | App Store Connect → Age Rating → wypełnij (brak przemocy, brak gambling, brak adult content → Rating 4+) |
| 6 | **Commit ostatnich fixów** | ⬜ | Logout redirect i menu bug fix — `git add -A && git commit && git push` |
| 7 | **Submit for Review** | ⬜ | App Store Connect → Submit for Review. Auto-release after approval jest ustawiony |

### 🟡 Google Play (po iOS)

| # | Zadanie | Status | Szczegóły |
|---|---------|--------|-----------|
| 8 | **Google Play Console — Create App** | ⬜ | play.google.com/console → Create app → "Zentalist", Free, Education |
| 9 | **Store listing (Google Play)** | ⬜ | Opis, screenshoty (min 2), ikona 512×512 (mamy), feature graphic 1024×500 |
| 10 | **Produkty IAP w Google Play** | ⬜ | Monetize → Subscriptions: Monthly, Annual. In-app products: Lifetime |
| 11 | **Content Rating** | ⬜ | Wypełnij IARC questionnaire |
| 12 | **Data Safety form** | ⬜ | Deklaracja zbieranych danych (email, purchases, user ID — analogicznie do PrivacyInfo) |
| 13 | **Build AAB** | ⬜ | `npx cap sync android && cd android && ./gradlew bundleRelease` → `app-release.aab` |
| 14 | **Upload & Submit** | ⬜ | Production → Create release → upload AAB → Submit |

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
