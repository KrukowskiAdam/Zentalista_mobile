# Zentalist Mobile — Dev Guide

> **Status (2026-08-05):** 🟢 **Android jest na produkcji** — https://play.google.com/store/apps/details?id=com.zentalist.app. 🔴 **iOS odrzucony przez App Review** (2026-08-05, submission `5e6782d4-ed61-40fc-97a8-ef010022f95d`) — 4 powody, patrz log **5f**. Poprawki kodu dla 3 z 4 powodów już napisane i **zdeployowane na produkcję** (`zentalist-mobile.web.app`, 2026-08-05). Zostało: kroki w App Store Connect (Monthly/Annual do review + EULA link) + upload nowego builda + nagranie ekranu do Review Notes. **Następna sesja: dokończyć 5f.**

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

## 4a) Analytics (Firebase / GA4)

**Dodane 2026-07-26.** Wcześniej appka (web ani mobile) w ogóle nie wysyłała danych do Firebase Analytics — `measurementId` był pominięty w configu, `getAnalytics()` nigdzie nie było wywoływane (patrz stare stwierdzenia "Analytics: Nie" w sekcjach 5d/5e — nieaktualne od tej zmiany).

Co zrobione:
- `measurementId: "G-QDLH7SX1MF"` dodany do `firebaseConfig` w `public/scripts/utils/config.js`.
- `getAnalytics()` (z guardem `isSupported()`) zainicjalizowane w `public/scripts/auth.js`.
- User property `app_platform` (`web` / `ios` / `android`, wykrywane przez `window.Capacitor`) wysyłane przy starcie — pozwala odróżnić ruch z appki mobilnej od zwykłej przeglądarki, mimo że oba korzystają z tego samego web streamu GA4 (mobile ładuje `zentalist-mobile.web.app` w webview, patrz `server.url` w `capacitor.config.json`).
- Zdeployowane na hosting + functions.

⬜ **Do zrobienia:** zarejestrować `app_platform` jako Custom Dimension w GA4 — Admin → Custom definitions → Create custom dimension, **Zakres: "Właściwość użytkownika"** (nie "Zdarzenie"), wybrać `app_platform` z listy. Bez tego dane się zbierają, ale nie da się ich wygodnie filtrować w standardowych raportach.

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
| 4 | **Produkty iOS w RevenueCat** | ✅ **Zrobione (zweryfikowane 2026-07-24).** 3 produkty iOS (`zentalist_premium_monthly/_annual/_lifetime`) w RevenueCat → App `Zentalist iOS`, każdy podpięty do entitlement `ZentaWeb Premium` i do offeringu `default` (każdy pakiet Monthly/Yearly/Lifetime zawiera teraz oba store'y). App Store Connect API key + In-app purchase key: "Valid credentials". Status produktów nadal pokazuje **"Missing Metadata"** w RevenueCat — to stan Apple (`MISSING_METADATA`), bo produkty są w ASC dopiero "Prepare for Submission"; zniknie automatycznie po kroku 7 (Submit for Review), nic do zrobienia po stronie RevenueCat. |
| 5 | **Screenshoty** | ✅ 7 szt. 1284×2778 — wgrane w App Store Connect |
| 6 | **Age Rating** | ✅ **Zrobione 2026-07-24.** App Store Connect → Age Ratings, kwestionariusz wypełniony. Wynik: **13+** (nie 4+ jak pierwotnie zakładano) dla 172 krajów/regionów — 12+ Wietnam/Korea, A12 Brazylia. Przyczyna: kategoria "Contests" (Chance-Based Activities) zaznaczona jako **Frequent**, bo leaderboard ma być kluczową, motywującą funkcją appki (świadoma decyzja użytkownika — ranking punktów po kategoriach/quizach ma zachęcać do rywalizacji jak w GeoGuessr). Test potwierdził: przy Contests = None/Infrequent wynik to 4+; tylko Frequent podbija do 13+. Reszta kwestionariusza (przemoc, treści dla dorosłych, hazard, itd.) — wszystko None/No, zgodnie ze stanem appki. |
| 7 | **Submit for Review** | ✅ **Zrobione 2026-07-25 20:19 — patrz log w sekcji 5e.** 2 elementy złożone razem: "iOS App 1.0" (App Version) + "Zentalist Lifetime Premium" (In-App Purchase), oba status **Waiting for Review**. Submission ID `5e6782d4-ed61-40fc-97a8-ef010022f95d`. Do 48h na decyzję. |

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

## 5d) Log: Submit for Review — sesja przerwana (2026-07-24)

### Co zrobione w App Store Connect

1. **Build** — dopięty build `1` (wersja 1.0) do "iOS App Version 1.0" (był pusty, Build sekcja pokazywała "Upload your builds..." mimo że IPA było już przetworzone jako VALID). Zapisane przez Save.
2. **App Information** — ustawione:
   - **Category (Primary)**: Education
   - **Content Rights**: "No, this app does not contain, show, or access third-party content"
3. **Pricing and Availability** — ustawione:
   - **Price**: Free (0,00 $), 175 krajów
   - **Availability**: All Countries or Regions
4. **App Privacy → Privacy Policy URL**: ustawione na `https://zentalist.app/privacy` (pole było wymagane osobno od App Information, mimo że support URL już tam był).
5. **In-App Purchase "Zentalist Lifetime Premium"** — dodano zrzut ekranu do Review Information (wymagany rozmiar dla tego pola to jeden z rozmiarów App Store screenshotów, np. 1284×2778 — próba wgrania dowolnego rozmiaru z przeglądarki dawała błąd "dimensions are wrong"; zadziałał zrzut przeskalowany do rozmiaru zgodnego z istniejącymi screenshotami). Status IAP: **Ready for Review**, dodane do Draft Submission razem z wersją 1.0.

### Co zablokowało "Add for Review" (pełna lista z App Store Connect, sprawdzone 2026-07-24)

Przy próbie **Add for Review** dla wersji 1.0 (żeby dołączyć do niej Draft Submission z IAP), ASC zwrócił listę brakujących rzeczy — wszystkie już rozwiązane **poza dwoma**:

- ✅ Primary category — rozwiązane (Education)
- ✅ Content Rights Information — rozwiązane
- ✅ Privacy Policy URL w App Privacy — rozwiązane
- ✅ Price tier w Pricing — rozwiązane (Free)
- ⬜ **Screenshot dla 13" iPad displays** — **NIEZROBIONE, sesja przerwana tutaj.** Wymagany rozmiar (z UI ASC): `2064 x 2752px`, `2752 x 2064px`, `2048 x 2732px` lub `2732 x 2048px`. Trzeba wgrać min. 1 zrzut w zakładce iPad → "13\" Display" w sekcji Previews and Screenshots (obecnie 0 z 10). **Użytkownik wraca z gotowymi screenami iPada — do wgrania przy następnej sesji.**
- ⬜ **App Privacy — kwestionariusz Data Collection** — **NIEZROBIONE.** Kliknięcie "Get Started" na stronie App Privacy otwiera wieloetapowy formularz "jakie typy danych zbiera appka". Wymaga świadomych odpowiedzi (nie robić na szybko — to publiczna deklaracja prawna widoczna na App Store).

### Dane do wykorzystania przy wypełnianiu App Privacy (z analizy kodu, agent Explore, 2026-07-24)

Zweryfikowane w kodzie (`public/scripts/`):

| Typ danych | Zbierane? | Źródło w kodzie | Uwagi |
|---|---|---|---|
| **Email Address** | ✅ Tak | `auth.js` (Firebase Auth email/password) | Linked to identity. Po fixie (patrz niżej) już NIE trafia do publicznego leaderboardu. |
| **User ID** | ✅ Tak | Firebase UID wszędzie (Firestore, RevenueCat `app_user_id`) | Linked to identity, not used for tracking |
| **Purchase History** | ✅ Tak | RevenueCat przez `iapService.js` | Linked to identity. Już zadeklarowane w `ios/App/App/PrivacyInfo.xcprivacy` |
| **Nazwa użytkownika / Avatar** | ✅ Tak (displayName, avatarUrl generowany z Dicebear, nie zdjęcie usera) | `syncService.js`, `premiumService.js` | Firestore `users/{uid}` — prywatne, tylko właściciel |
| **Dane o postępach nauki / statystyki** | ✅ Tak (totalPoints, level, starsEarned, challengesCompleted, languageBreakdown) | `syncService.js` leaderboard + progress sync | Częściowo publiczne przez leaderboard (bez emaila po fixie) |
| **Analytics/Crash reporting** | ❌ Nie | Brak Firebase Analytics/Crashlytics/Mixpanel/Sentry w kodzie ani w Podfile.lock | — |
| **Reklamy** | ❌ Nie | Brak AdMob/ad SDK | — |
| **Lokalizacja/Kamera/Mikrofon/Kontakty/Zdjęcia** | ❌ Nie | Brak `*UsageDescription` w `ios/App/App/Info.plist` — appka fizycznie nie może o to prosić | — |
| **IP / identyfikatory urządzenia** | ❓ Nieznane | Może być zbierane przez SDK RevenueCat poza tym repo — wymaga sprawdzenia dokumentacji RevenueCat | Nie zweryfikowane w tym repo |

### 🔒 Znaleziony i naprawiony bug prywatności: email publicznie widoczny w leaderboardzie

**Problem:** `firestore.rules` linia ~22: kolekcja `leaderboard/{userId}` miała `allow read: if true` (publiczny odczyt przez kogokolwiek, bez logowania). `syncService.js` (funkcja `updateLeaderboard()`, była linia 605) zapisywała tam **prawdziwy adres email użytkownika** (`email: user.email`) obok displayName/avatara/wyników — czyli mail każdego gracza na leaderboardzie był publicznie dostępny (np. przez Firestore REST API bez auth).

**Fix zastosowany (2026-07-24):** usunięto linię `email: user.email,` z zapisu w `syncService.js` → `updateLeaderboard()`. `displayName` już wcześniej miał fallback na `user.email?.split("@")[0]`, więc UI leaderboardu działa bez zmian. Zweryfikowano (agent Explore), że `uiService.js` (odczyt leaderboardu, ranking) nigdzie nie czyta pola `email` — bezpieczne do usunięcia.

**✅ Wyczyszczone 2026-07-25.** Fix w kodzie działa tylko na nowe zapisy (`setDoc` z `merge: true` nie usuwa pól, których nie ma w nowym payloadzie), więc istniejące dokumenty trzeba było wyczyścić osobno. Okazało się, że lokalnie jest zalogowane `gcloud` (`krukowski.adam@gmail.com`, dostęp do `costam-3f612`) — użyto `gcloud auth print-access-token` + Firestore REST API (`PATCH .../leaderboard/{docId}?updateMask.fieldPaths=email` z pustym body `{}`, co usuwa pole zamiast je nadpisywać) do usunięcia `email` ze wszystkich **6** dokumentów w kolekcji `leaderboard` (więcej niż zakładane 1-2 — kolekcja miała już dane testowe/deweloperskie z kilku kont, w tym `review@zentalist.app` i prywatne adresy). Zweryfikowano po fakcie: żaden dokument nie ma już pola `email`, reszta pól (displayName, avatarUrl, statystyki) bez zmian.

Zmiana w `syncService.js` scommitowana do gita (patrz commit z 2026-07-25).

### Stan na koniec sesji (2026-07-24, przerwana)

- ✅ Build, kategoria, Content Rights, Pricing/Availability, Privacy Policy URL — zrobione
- ✅ IAP Lifetime Premium — Ready for Review ze screenshotem
- ✅ Bug prywatności (email w leaderboardzie) — naprawiony w kodzie, niescommitowany
- ✅ Screenshot iPada 13" — dodane w sesji 2026-07-25, patrz 5e
- ✅ Kwestionariusz App Privacy Data Collection — wypełniony w sesji 2026-07-25, patrz 5e
- ✅ **Submit for Review** — zrobione 2026-07-25, patrz 5e
- ⬜ Zweryfikować czy Subscriptions (Monthly, Annual) też potrzebują własnego "Add for Review" + screenshotu jak Lifetime — **okazało się nie**: finalny Draft Submission zawierał tylko 2 pozycje (App Version + Lifetime IAP), Monthly/Annual nie wymagały osobnego dodania (prawdopodobnie dlatego, że to pierwsza wersja appki — subskrypcje idą do review razem z appką automatycznie, bez osobnego kroku Add for Review)
- ⬜ Commit zmiany w `syncService.js` do gita — **nadal niescommitowane**, do zrobienia

---

## 5e) Log: DAC7, App Privacy, iPad screenshot, Submit for Review (2026-07-25)

Dokończenie sesji przerwanej w 5d.

### 1. DAC7 (Directive on Administrative Cooperation – 7th Amendment)

Business → Agreements, Tax, and Banking zgłosił dodatkowy blocker: DAC7 compliance info wymagane przed submitem (unijna dyrektywa podatkowa, Apple raportuje dane sprzedawców cyfrowych usług do urzędów skarbowych UE).

Pytanie: **"Do any of your apps provide personal services in any country or region?"** → odpowiedziane **No** — "personal services" w DAC7 oznacza platformy łączące dwie strony, gdzie jedna wykonuje zleconą usługę dla drugiej (jazda, dostawa, freelancing, korepetycje 1:1 zlecane przez appkę). Zentalist to appka do nauki solo (fiszki, spaced repetition), nie marketplace usług — więc nie kwalifikuje się.

### 2. App Privacy — Data Collection questionnaire (wypełniony w całości)

Odpowiedzi oparte na tabeli z sekcji 5d (zweryfikowanej w kodzie). Finalnie zadeklarowane **4 typy danych**: Email Address, Name, User ID, Purchase History.

Dla każdego z 4 typów — identyczny wzorzec odpowiedzi:

| Pytanie | Odpowiedź | Uzasadnienie |
|---|---|---|
| Linked to user's identity? | **Yes** | wszystko powiązane z Firebase `uid` / kontem, nic anonimowego |
| Used for tracking? | **No** | brak sieci reklamowych, brak udostępniania danych brokerom, brak cross-app/cross-site linkowania |
| Purposes (multi-select) | tylko **App Functionality** | autentykacja, zarządzanie subskrypcją/premium, customer support — nic więcej (bez Analytics, bez Advertising, bez Product Personalization) |

Wynik widoczny w App Store Connect: *"4 data types collected from this app: Email Address, Name, User ID, Purchase History"*.

**Nie zaznaczono** (świadomie): Analytics — appka mobilna nie ma żadnego SDK analitycznego (Google Analytics jest tylko na stronie web, nie w kodzie iOS/Capacitor); Third-Party/Developer Advertising — brak reklam i kampanii marketingowych opartych o te dane.

### 3. Screenshot iPada 13"

Użytkownik dodał zrzuty ekranu iPada (`public/img/appstore_screenshots/`) i wgrał je w zakładce iPad → "13\" Display" w App Store Connect — blocker z 5d zdjęty.

### 4. Submit for Review — finalny

Po uzupełnieniu DAC7 + App Privacy + screenshotów, **Add for Review** → **Submit for Review** przeszło bez dodatkowych blockerów.

Wynik:
- **Draft Submission**, "Items Submitted (2)":
  - **iOS App 1.0** (App Version, build 1.0 (1)) — status **Waiting for Review**
  - **Zentalist Lifetime Premium** (In-App Purchase) — status **Waiting for Review**
- **Date Submitted**: Jul 25, 2026 at 8:19 PM
- **Submission ID**: `5e6782d4-ed61-40fc-97a8-ef010022f95d`
- Obie pozycje recenzowane **razem** — standardowe zachowanie Apple dla pierwszego submitu appki z IAP (pierwszy in-app purchase zawsze idzie do review razem z wersją aplikacji).
- Apple: do 48h na decyzję, powiadomienie mailem.

### Otwarte do zrobienia (następna sesja / po odpowiedzi Apple)

- ⬜ Czekać na mail od Apple (approve / reject / needs info) — jeśli reject, wrócić do rozkminienia powodu
- ✅ Commit `syncService.js` (fix bug prywatności z 5d, punkt "email w leaderboardzie") — zrobione 2026-07-25
- ✅ Czyszczenie pola `email` z istniejących dokumentów `leaderboard` — zrobione 2026-07-25 przez Firestore REST API, patrz 5d

---

## 5f) Log: App Review rejection — 4 powody, poprawki (2026-08-05, sesja w toku)

Apple odrzucił submission `5e6782d4-ed61-40fc-97a8-ef010022f95d` (review 2026-08-05, iPad Air 11" M3). 4 powody, wszystkie typowe dla pierwszego submitu appki z IAP:

### 1. Guideline 5.1.1(v) — zakup Premium wymagał rejestracji

**Problem:** `premiumPaywall.js` blokował każdy przycisk kup/restore/native-paywall komunikatem "sign in first", jeśli `window.currentUser?.uid` było puste. Apple zabrania wymuszania rejestracji przed zakupem IAP niepowiązanego z kontem.

**Fix (✅ zrobiony i zdeployowany):**
- `auth.js` — nowa funkcja `ensurePurchaseUser()`: jeśli nikt niezalogowany, cicho zakłada **anonimowe konto Firebase** (`signInAnonymously`, zero danych osobowych) i na jego UID idzie zakup. Formularz Sign Up wykrywa `auth.currentUser?.isAnonymous` i używa `linkWithCredential` zamiast `createUserWithEmailAndPassword` — czyli późniejsza rejestracja **zachowuje ten sam UID** (zakup/postępy nie gubią się przy "dopięciu" maila/hasła).
- `premiumPaywall.js` — usunięty modal logowania z 3 miejsc (kup, restore, native paywall), zastąpiony przez `ensurePurchaseIdentity()` (używa istniejącego usera albo zakłada anonimowego + `Purchases.logIn` do RevenueCat pod tym UID).
- `index.js` (`setupUI`) — goście (anonimowi) widzą górne menu tak jak niezalogowani (Sign In/Sign Up widoczne, nie "Zalogowany jako undefined"). `mc_auth_state` w cache ustawiane na `logged-out` dla gości, żeby nie było flashu przy odświeżeniu.
- `premiumService.js` — bez zmian: `iap:entitlementChanged` handler już zapisywał premium do Firestore pod `auth.currentUser`, co teraz działa automatycznie też dla anonimowych UID.

### 2. Guideline 2.1(b) — subskrypcje niewysłane do review

**Problem:** Tylko "Zentalist Lifetime Premium" poszło do submission (patrz 5e) — Monthly i Annual nigdy nie dostały "Add for Review".

**Status: ⬜ NIEZROBIONE — to czysto App Store Connect, nie kod.** Do zrobienia następnym razem:
1. App Store Connect → In-App Purchases → Monthly (`zentalist_premium_monthly`) i Annual (`zentalist_premium_annual`) → dodać screenshot w Review Information (jak przy Lifetime w 5d, wymagany rozmiar zgodny ze screenshotami appki).
2. Dołączyć oba do nowego Draft Submission razem z App Version.
3. **Apple wprost wymaga uploadu nowego builda** ("upload a new binary") — zrobić nowy archive/export/upload przez Xcode Organizer (build number +1), mimo że treść appki (server-rendered z `zentalist-mobile.web.app`) już ma poprawki z punktów 1/4 bez potrzeby nowego builda — nowy binary jest wymagany tylko dlatego, że Apple tak napisał w tym konkretnym punkcie.

### 3. Guideline 5.1.1(v) — brak usuwania konta

**Fix (✅ zrobiony i zdeployowany):** `profile.ejs` + `profile.js` — sekcja "Delete Account" (Danger Zone) z modalem potwierdzenia hasłem (reauth przez `reauthenticateWithCredential` przed `deleteUser`, żeby Firebase nie odrzucił jako `auth/requires-recent-login`). Usuwa `users/{uid}`, `leaderboard/{uid}`, czyści localStorage, kasuje konto Firebase Auth, redirect na `/home`. Konta-goście (anonimowe, patrz punkt 1) usuwają się bez hasła — nie mają email/password credentiala do reauth.

**⬜ Do zrobienia:** nagrać na fizycznym urządzeniu (iPad/iPhone) filmik: logowanie na `review@zentalist.app` (albo zakup jako gość) → Profile → Delete Account → potwierdzenie → wynik. Wkleić do Notes w App Review Information przy resubmisji (Apple wprost o to prosi w mailu).

### 4. Guideline 3.1.2(c) — brak wymaganych informacji o subskrypcji

**Fix (✅ zrobiony i zdeployowany):** `premium.ejs` — pod kartami cenowymi dodany zawsze widoczny akapit z warunkami auto-renewal + linkami do `/legals#terms-of-service` i `/privacy`. Nazwa/długość/cena planu już wcześniej były na kartach (Monthly/Yearly/Lifetime + `data-iap-price`).

**⬜ Do zrobienia (App Store Connect, nie kod):** dodać funkcjonalny link do Terms of Use (EULA) w App Description (albo w polu EULA w App Store Connect) — Apple wskazał to jako brakujące w metadanych, niezależnie od linku na samym ekranie zakupu.

### Deploy

Zdeployowano 2026-08-05 przez `firebase deploy --only hosting:mobile,functions` (hosting = statyczne JS, functions = `ssrMobile` renderuje zmienione `.ejs`). **Uwaga — napotkany i obejście problemu z Node:** lokalny `node` (Homebrew, v26.4.0) jest zbyt nowy dla `firebase-tools` — analiza kodu funkcji pada na `buffer-equal-constant-time` (transitywna zależność `firebase-admin` → `google-auth-library` → `jws` → `jwa`, używa starego `Buffer` API usuniętego w Node 26). **Fix:** `brew install node@22` (już było zainstalowane), potem `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` przed `firebase deploy` — nie podmienia domyślnego `node` w PATH na stałe, tylko na czas tej komendy. Jeśli deploy znów padnie na tym samym błędzie, użyć tego samego obejścia.

Zweryfikowane po deployu (`curl`): `/premium` zawiera "Terms of Use", `/profile` zawiera "Delete Account" — obie strony serwują nową wersję.

**Niescommitowane w git:** wszystkie zmiany z tej sesji (`auth.js`, `index.js`, `premiumPaywall.js`, `profile.js`, `profile.ejs`, `premium.ejs`) są na dysku i już zdeployowane, ale jeszcze nie ma commita — do zrobienia w następnej sesji razem z resztą (patrz też niescommitowane zmiany w sekcji 4a, Analytics, z 2026-07-26 — też czekają na commit).

### Otwarte do zrobienia (następna sesja)

- ⬜ Monthly + Annual → Add for Review w App Store Connect (screenshot + dołączenie do Draft Submission)
- ⬜ Nowy build (Xcode archive/export/upload, build number +1) — wymagany przez Apple dla punktu 2.1(b)
- ⬜ EULA link w App Description / polu EULA w App Store Connect (punkt 3.1.2(c), metadata)
- ⬜ Nagranie ekranu: zakup jako gość (lub login) → Delete Account flow → dołączyć do Review Notes
- ⬜ Submit for Review (nowy submission)
- ⬜ Commit zmian z tej sesji do gita (+ zaległy commit z sekcji 4a)

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
