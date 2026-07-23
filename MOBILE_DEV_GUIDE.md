# Zentalist Mobile — Dev Guide

> **Status (2026-07-23):** 🟢 **Android jest na produkcji** — https://play.google.com/store/apps/details?id=com.zentalist.app. 🔴 **iOS jeszcze nie wysłany** — patrz sekcja 5, "iOS — pozostałe kroki".

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

| Plan | Product ID | Cena docelowa (zgodna z web/Stripe) | iOS | Android |
|---|---|---|---|---|
| Monthly | `zentalist_premium_monthly` | $9.99/mies | ✅ App Store Connect, $9.99 | ✅ Google Play |
| Annual | `zentalist_premium_annual` | $59/rok | ✅ App Store Connect, **$59.99** (patrz uwaga) | ⚠️ Google Play skonfigurowany na $59.99 — do poprawy na $59 |
| Lifetime | `zentalist_premium_lifetime` | $99 | ✅ App Store Connect, **$99.99** (patrz uwaga) | ⚠️ Google Play skonfigurowany na $99.99 — do poprawy na $99 |

**Do zrobienia:** cena Annual/Lifetime w Google Play Console nie zgadza się z ceną pokazywaną na web (Stripe: $59/$99). Poprawić ręcznie w Google Play Console → Monetize → Products (zmiana ceny istniejącego produktu nie wymaga nowego Product ID).

**⚠️ App Store Connect nie ma price tieru $59,00 ani $99,00 (sprawdzone 2026-07-23):** lista cenowa USD w App Store Connect składa się wyłącznie z wartości kończących się na `.99` (rzadziej `.90`/`.95` przy niskich kwotach) — przewinięto całą listę w okolicach $59 i $99, nie istnieje płaski `.00`. W przeciwieństwie do Google Play (gdzie dało się ręcznie wpisać $59,00), na iOS **nie da się dopasować dokładnie do ceny ze Stripe**. Zaakceptowana decyzja: **Annual = $59.99, Lifetime = $99.99 na iOS** — świadoma, nieunikniona niespójność platformowa.

### RevenueCat dashboard — stan

- ✅ Android products zaimportowane, podpięte do entitlement `ZentaWeb Premium` i offering `default`
- ✅ Service account RevenueCat dodany do Google Play z uprawnieniami
- ✅ Webhook skonfigurowany → `https://zentalist.app/revenuecatwebhook` (status 200 zweryfikowany)
- ✅ **Google Real-time Developer Notifications (RTDN) — połączone 2026-07-23.** Topic Pub/Sub `projects/costam-3f612/topics/Play-Store-Notifications` podpięty w RevenueCat (Zentalist Android → Google developer notifications → "Connected to Google"). `Track new purchases from server-to-server notifications` włączone, App User ID detection: anonymous (recommended). **Nie wymagało to statusu produkcyjnego w Play Store** — to niezależna konfiguracja, można było zrobić wcześniej.
  - ✅ **Zweryfikowane 2026-07-23 realnym testowym zakupem** (nowe konto Google, subskrypcja monthly, 44 zł). Efekt w Firestore (`users/{uid}`): `premium: true`, `premiumSource: "revenuecat"`, `premiumUpdatedAt` ze świeżym timestampem — czyli RTDN → webhook → Firestore działa end-to-end. (Przycisk "Send test notification" w Play Console nadal nie istnieje w tym UI — patrz niżej — ale nie jest już potrzebny, bo mamy potwierdzenie realnym zakupem.)
- ⬜ iOS products — dodać po wgraniu buildu do App Store Connect (blokada: brak uploadu IPA — **uwaga, ta blokada jest już nieaktualna, patrz sekcja 5 pkt 2, IPA zostało wgrane 2026-07-05**)

**Archiwalna notatka (przycisk "Send test notification" zniknął z Play Console):** opisany w dokumentacji RevenueCat przycisk (Google Play Console → Monetize → Monetization setup → Real-time developer notifications) **nie istnieje już w tym Play Console** — sprawdzone 2026-07-23, brak tej sekcji w całej konsoli (Zarabiaj w Google Play, Ustawienia zaawansowane, Ustawienia konta, `/api-access`). Google widocznie usunął/przeniósł tę funkcję. Jeśli RTDN kiedyś przestanie działać i trzeba będzie to zdiagnozować: nadać `google-play-developer-notifications@system.gserviceaccount.com` rolę **Pub/Sub Publisher** na topicu `Play-Store-Notifications` w GCP (projekt `costam-3f612` → Pub/Sub → Permissions → Add Principal).

### 🔴 Do przetestowania: auto-refresh strony Premium po zakupie (fix 2026-07-23)

Podczas testowego zakupu (opisanego wyżej) wyszło na jaw, że strona `/premium` **nie odświeżała się automatycznie** po udanej płatności — dalej pokazywała karty cenowe/przyciski zakupu zamiast karty "You're Premium!", mimo że transakcja i zapis do Firestore przeszły poprawnie. Trzeba było przeładować stronę / przejść gdzie indziej i wrócić.

**Przyczyna:** `premiumPaywall.js` po sukcesie zakupu ustawiał tylko tekst statusu ("Premium unlocked successfully.") i nic więcej — nie przełączał widoczności `#price-cards` / `#features-list` / `#user-card` (to normalnie robi `index.js` → `setupUI()`, ale tylko przy pełnym ładowaniu strony).

**Fix:** dodano `showPremiumUnlockedUI()` w `public/scripts/pages/premiumPaywall.js`, wywoływaną natychmiast po każdym z 4 miejsc sukcesu (natywny paywall, zakup monthly/annual/lifetime, restore purchases) — chowa karty cenowe, pokazuje kartę "You're Premium!" bez przeładowania.

- ⬜ **Do przetestowania na urządzeniu:** kliknąć "Buy monthly/annual/lifetime in app" (lub Restore) i sprawdzić, czy karta "You're Premium!" pojawia się od razu po zamknięciu okna płatności Google Play, bez ręcznego odświeżania/nawigacji.

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
| 2b | **Agreements, Tax and Banking** | ✅ **Odblokowane 2026-07-23.** Paid Apps Agreement + Free Apps Agreement: Active. Bank account (mBank SA, PLN/USD): Active. Oba formularze podatkowe (**U.S. Form W-8BEN** + **U.S. Certificate of Foreign Status of Beneficial Owner**): Active, złożone 2026-07-23. Bez tego nie dało się założyć żadnych płatnych produktów — patrz log w sekcji 5c. |
| 3 | **Produkty IAP w App Store Connect** | ✅ **Założone 2026-07-23.** Subscription group "Zentalist Premium" → **Monthly** (`zentalist_premium_monthly`, $9.99/mies) + **Annual** (`zentalist_premium_annual`, **$59,99** — nie $59, patrz uwaga niżej). Osobno **In-App Purchase Non-Consumable** → **Lifetime** (`zentalist_premium_lifetime`, $99,99 — nie $99.99→$99.99 zaakceptowane, patrz uwaga). Wszystkie: Availability all countries, lokalizacja EN-US dodana, ceny zapisane. Status: "Prepare for Submission" (wymagają dodania do wersji appki + zdjęcia w Review Information przed faktycznym Submit for Review). |
| 4 | **Produkty iOS w RevenueCat** | ⬜ Dodać po kroku 3 — Products → 3 produkty iOS → podpiąć do entitlement i offering |
| 5 | **Screenshoty** | ✅ 7 szt. 1284×2778 — wgrane w App Store Connect |
| 6 | **Age Rating** | ⬜ App Store Connect → Age Rating → 4+ (brak przemocy, gambling, adult content) |
| 7 | **Submit for Review** | ⬜ Auto-release after approval ustawiony |

### 🟡 Android — pozostałe kroki

**2026-07-07: konto Play Console przełączone z osobistego na organizacyjne** (firma + numer D-U-N-S). Wymóg "12 testerów przez 14 dni ciągłości" dotyczy tylko **osobistych** kont deweloperskich założonych po 13.11.2023 ([źródło](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)) — konta organizacyjne są z niego zwolnione, więc kroki 2 i 4 poniżej najpewniej nie obowiązują i można iść od razu do wniosku o dostęp produkcyjny.

| # | Zadanie | Status |
|---|---------|--------|
| 1 | **Upload AAB do Closed Testing** | ✅ Wgrane 2026-07-07, `versionCode 2` |
| 2 | ~~12 testerów akceptuje zaproszenie~~ | ⬜ Nie dotyczy — konto organizacyjne (potwierdzone w praktyce, patrz krok 6) |
| 3 | **Produkty IAP w Google Play** | ✅ Wszystkie 3 utworzone. ⬜ **TODO: poprawić cenę** Annual $59.99→$59 i Lifetime $99.99→$99 w Google Play Console → Monetize → Products, żeby zgadzało się z web/Stripe (patrz sekcja 4) |
| 4 | ~~Czekaj 14 dni z min. 12 testerami~~ | ⬜ Nie dotyczy — konto organizacyjne |
| 5 | **Złóż wniosek o dostęp produkcyjny** | ✅ Nie wymagany — konto organizacyjne poszło od razu do produkcji bez blokady |
| 6 | **Upload AAB do Production i Submit** | ✅ Wgrane 2026-07-22, `versionCode 3` / `targetSdk 36`. Patrz log w sekcji 5b |
| 7 | **Review Google — app live** | ✅ **Potwierdzone 2026-07-23** — aplikacja przeszła recenzję i jest publicznie dostępna: https://play.google.com/store/apps/details?id=com.zentalist.app |

**🔴 Deadline Google Play — targetSdk:** od 31 sie 2026 aplikacje kierowane na API < 36 nie będą mogły być aktualizowane. **Rozwiązane 2026-07-22** — patrz 5b.

**🟢 Android jest na produkcji od 2026-07-23.** iOS pozostaje jedyną niedokończoną platformą (patrz sekcja iOS wyżej).

---

## 5b) Log: Android 16 (API 36) targetSdk upgrade (2026-07-22)

### Powód

Google Play Console zgłosił krytyczne ostrzeżenie: aplikacja celowała w API 35 (Android 15), a od 31 sie 2026 wymagane jest API w przedziale 1 roku od najnowszego Androida — czyli minimum API 36 (Android 16).

### Co zostało zmienione w repo

1. **`android/variables.gradle`** — `compileSdkVersion` i `targetSdkVersion`: `35` → `36`.
2. **`android/app/build.gradle`** — `versionCode`: `2` → `3` (wymagane przez Play Console dla nowego uploadu; poprzedni `versionCode 2` był już wykorzystany w Closed Testing).

### Build lokalny

Brak `JAVA_HOME` w środowisku domyślnym — użyty JBR dołączony do Android Studio:

```bash
export ANDROID_HOME=~/Library/Android/sdk
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android
./gradlew assembleDebug   # weryfikacja kompilacji, BUILD SUCCESSFUL
./gradlew bundleRelease   # podpisany release AAB
```

Wynik: `android/app/build/outputs/bundle/release/app-release.aab` (13,7 MB), podpisany kluczem `zentalist-release.keystore`.

**Uwaga:** wcześniejsza tabela w sekcji 3 podaje inny `JAVA_HOME` (`/Library/Java/JavaVirtualMachines/jbr-21.jdk/Contents/Home`) — na tym Macu ta ścieżka nie istniała, zadziałał dopiero JBR z Android Studio. Jeśli któraś ścieżka przestanie działać, sprawdzić obie.

### ⚠️ Ryzyko do przetestowania: edge-to-edge

`MainActivity.java` zawiera `WindowCompat.setDecorFitsSystemWindows(getWindow(), true)` — świadomy opt-out z trybu edge-to-edge. **Android 16 usuwa możliwość tego opt-outu** dla aplikacji z `targetSdk 36` — system wymusi edge-to-edge niezależnie od tego wywołania. Jeśli zdalna appka webowa (`zentalist-mobile.web.app`, patrz sekcja 5a) nie obsługuje w pełni `env(safe-area-inset-*)` w CSS, treść może wyjechać pod pasek statusu/nawigacji na urządzeniu z Android 16. **Nie zweryfikowane fizycznie — do sprawdzenia przy najbliższym teście na urządzeniu** (dodać do checklisty w sekcji 10).

### Upload do Play Console

1. Pierwsza próba uploadu AAB do wersji produkcyjnej: w wersji roboczej zostały **dwa** pakiety (stary `versionCode 2`/SDK 35 + nowy `versionCode 3`/SDK 36) → błąd "Ten plik APK nie zostanie wysłany do żadnego użytkownika...". **Fix:** usunięcie starego pakietu (`versionCode 2`) z wersji roboczej, zostawienie tylko `versionCode 3`.
2. **Produkcja:** `versionCode 3` wysłany bezpośrednio na produkcję (bez Closed/Open Testing) — zgodnie z ustaleniem w sekcji 5 (linia "Wspólne prerequisity"/wiersz 2 i 4), konto organizacyjne jest zwolnione z wymogu 12 testerów/14 dni.
3. Próba dodatkowego uploadu tego samego `versionCode 3` do **Open Testing** → błąd "Nie możesz wdrożyć tej wersji... nie pozwala uaktualnić" + "Ta wersja nie dodaje ani nie usuwa żadnych pakietów". Powód: `versionCode 3` już opublikowany w Production, więc Play nie widzi sensu w dołączeniu go też do Open Testing (brak upgrade path). **Fix:** odrzucona wersja robocza Open Testing — niepotrzebna, skoro produkcja już ma tę wersję.
4. Przy okazji porządków ścieżka **Test zamknięty - Alpha** została ustawiona na "Wstrzymaj ścieżkę" — zmiana wysłana do sprawdzenia przez Google (ekran "Przegląd publikowanych zmian"), stan: oczekująca na review, zwykle kilka minut–godzin.

### Stan na koniec sesji (2026-07-22)

- ✅ Produkcja: `versionCode 3`, `targetSdk 36` — wgrane i wysłane
- ✅ Weryfikacja statusu review produkcyjnego — **potwierdzone 2026-07-23**, appka przeszła recenzję Google i jest live na Play Store: https://play.google.com/store/apps/details?id=com.zentalist.app
- ⬜ Test na fizycznym urządzeniu z Android 16 — priorytet: edge-to-edge / safe-area (patrz wyżej) — **nadal nie zweryfikowane, mimo że appka jest już live**
- ⬜ Ścieżka Test zamknięty - Alpha wstrzymana — potwierdzić, że zmiana przeszła review

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

## 5c) Log: Agreements, Tax and Banking (2026-07-23)

### Blocker odkryty

Przed założeniem jakichkolwiek płatnych produktów IAP w App Store Connect trzeba mieć **Paid Apps Agreement** ze statusem Active (Business → Agreements). U nas był **"New"** (niepodpisany) — bez tego App Store Connect nie pozwala tworzyć subskrypcji ani in-app purchases.

### Kolejność działań

1. **Podpisanie Paid Apps Agreement** — Business → Agreements → "View and Agree to Terms" (Schedule 2 do Apple Developer Program License Agreement — Apple staje się agentem/komisantem sprzedaży).
2. Po podpisaniu odblokowały się dwa **osobne** formularze podatkowe (Apple traktuje je jako różne dokumenty, mimo że wyglądają podobnie — łatwo pomyśleć że jeden wystarczy):
   - **U.S. Certificate of Foreign Status of Beneficial Owner** — krótszy formularz, wymaga uzupełnienia pola **Title** (wpisane: "Owner").
   - **U.S. Form W-8BEN** — pełny formularz IRS.
3. **Konto bankowe** (mBank SA, PLN, royalty currency USD) dodane osobno w sekcji Bank Accounts.

### ⚠️ Pułapka w W-8BEN — Line 10 ("Special rates and conditions")

Formularz w App Store Connect ma pole 10 z gotowym radio-buttonem **"Income from the sale of applications"** i polami na Article/paragraph + % rate — wygląda jak coś, co trzeba wypełnić, żeby dostać obniżoną stawkę traktatową. **To jest błędne założenie.**

Oficjalny dokument Apple "Tips for Completing Form W-8BEN" (link na stronie formularza, PDF) mówi wprost:
> *"Complete this item only if you are eligible to claim any applicable treaty benefits that require you to meet conditions not covered by the representation on line 9. **It is expected that Line 10 would not normally be applicable.**"*

**Poprawne wypełnienie (dla zwykłego JDG bez PE w USA):**
- Linia 5 (U.S. TIN) — puste
- **Linia 6.a (Foreign TIN) = polski NIP** — to jest to pole, które faktycznie odblokowuje obniżoną stawkę traktatową (cytat z tips sheet: *"A U.S. TIN or Foreign TIN is required in order to receive any applicable benefit of the reduced tax treaty rate for your country."*)
- **Checkbox 9** (rezydencja podatkowa w Polsce) — zaznaczyć
- **Linia 10 — zostawić całkowicie puste** (żaden Article, żadna stawka, żaden radio button)

### Adres "Permanent Residence" bez numeru mieszkania

Formularze pobierają adres z **Apple Developer Program → Membership details** (developer.apple.com/account), nie z samego formularza podatkowego — tam nie da się tego edytować bezpośrednio. Nasz adres pokazuje "Sliczna 32c" bez "/9". **Świadomie zostawione bez zmian** — zmiana adresu członkostwa wymaga formalnego review/weryfikacji przez Apple (ostrzeżenie: *"any changes to this information will need to be reviewed and verified"*) i zablokowałaby/opóźniła bieżący proces. Drobna nieścisłość (brak numeru mieszkania), nie błąd w kraju/mieście/kodzie pocztowym — nie krytyczne.

### Stan końcowy (2026-07-23)

- ✅ Paid Apps Agreement: Active
- ✅ Free Apps Agreement: Active
- ✅ Bank Account (mBank SA): Active
- ✅ U.S. Form W-8BEN: Active (złożony 23 lip 2026)
- ✅ U.S. Certificate of Foreign Status of Beneficial Owner: Active (złożony 23 lip 2026)
- 🟢 **Odblokowane zakładanie produktów IAP** — patrz sekcja 5, punkt 3

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
