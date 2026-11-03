# Plan: Zentalist mobile — offline-first (opcja A)

> Spisane 2026-10-25. Cel: aplikacja iOS/Android działa w pełni bez internetu
> (karty, quiz, audio, postęp), a sieć służy tylko do synchronizacji, zakupów i aktualizacji treści.
> Zostajemy przy Capacitorze — jeden kod dla iOS, Androida i (częściowo) web.
>
> **Wdrożenie na produkcję dopiero po akceptacji obecnej wersji przez Apple** (review z 2026-10-24, patrz `MOBILE_DEV_GUIDE.md` §5f).
> Do tego czasu cała praca tylko na kopii.

## 1. Stan obecny — dlaczego offline nie działa

| Element | Dziś | Offline |
|---|---|---|
| Ekrany (HTML) | `capacitor.config.json` → `server.url: https://zentalist-mobile.web.app/home` — appka to strona renderowana przez Cloud Function `ssrMobile` (EJS) | ❌ tylko zapasowa strona „Offline” z `sw.js` |
| Firebase SDK | importy ES z `https://www.gstatic.com/firebasejs/10.7.1/...` w `auth.js`, `syncService.js` itd. | ❌ import pada → **cały JS appki nie startuje** |
| Czcionki | Google Fonts (6 rodzin) | ⚠️ fallback systemowy, wygląd się rozjeżdża |
| Awatary | `api.dicebear.com` | ❌ puste obrazki |
| JSON słówek (3.8 MB, 9 jęz.) | pobierane z `costam-3f612.web.app`, cache w Service Workerze | ⚠️ tylko jeśli wcześniej się pobrały |
| MP3 (~55 MB / język, ~490 MB razem) | `new Audio(url)` z Firebase Storage, cache SW „on demand” | ⚠️ tylko słówka już kiedyś odsłuchane |
| Postęp nauki | `localStorage` najpierw, potem sync do Firestore (`pendingCloudSync`) | ✅ już działa offline |
| Premium (RevenueCat) | natywny plugin, SDK sam cache'uje status | ✅ status tak, zakup wymaga sieci |
| Analityka (GTM/GA) | zewnętrzne skrypty | ✅ bez znaczenia, ale nie może blokować startu |

**Uwaga techniczna:** po przejściu na pliki wbudowane w appkę (schemat `capacitor://localhost`)
Service Worker na iOS **nie działa** (WKWebView wspiera SW tylko dla https App-Bound Domains).
Dlatego cache JSON/MP3 przenosimy z `sw.js` do natywnego systemu plików (`@capacitor/filesystem`).

## 2. Docelowa architektura

- Wszystkie ekrany, JS, CSS, czcionki, Firebase SDK i JSON-y **wbudowane w paczkę aplikacji**.
- JSON-y: start z wersji wbudowanej → w tle sprawdzenie nowszej wersji na hostingu → zapis do pamięci telefonu.
  Poprawki treści (jak dzisiejsze) dalej trafiają do użytkowników **bez nowego wydania w App Store**.
- Audio: przycisk **„Pobierz audio offline”** per język (≈13 MB po zmianie formatu, dziś ≈55 MB), pobieranie w tle z postępem,
  wznawiane po przerwaniu; odtwarzanie z pliku lokalnego, a jeśli go nie ma — z sieci jak dziś.
- Audio darmowego decku 01 (pierwsza kategoria, darmowa dla wszystkich) **wbudowane w appkę dla 9 języków (~15 MB po zmianie formatu, dziś ~65 MB)** — działa od pierwszego uruchomienia, bez sieci.
- Live updates (Capgo) — poprawki kodu JS/CSS/HTML trafiają do użytkowników bez czekania na review.
- Logowanie/sync/zakupy: bez zmian w logice, tylko odporne na brak sieci (nie blokują startu, kolejkują sync).

## 3. Etapy

Pracujemy na **kopii** (`zentalist_mobile_offline/`), produkcyjny `zentalist_mobile/` zostaje nietknięty do końca testów.

### Etap 0 — kopia i przygotowanie (½ dnia)
- [ ] Skopiować `zentalist_mobile` → `zentalist_mobile_offline` (osobny build, ten sam `appId` dopiero przy wydaniu).
- [ ] Spisać listę ekranów z `functions/index.js`: `/home`, `/learn`, `/premium`, `/profile`, `/stats`, `/challenge`, `/legals`, `/privacy` (leaderboard **zostaje** — kluczowa funkcja appki; offline pokazuje ostatnio pobrany ranking + info „wymaga internetu”).

### Etap 1 — ekrany jako statyczne pliki (2–3 dni)
- [ ] Skrypt `tools/build-static.mjs`: renderuje każdy szablon EJS z tymi samymi danymi co `ssrMobile`
      → `public/home/index.html`, `public/learn/index.html` itd. (zachowuje obecne ścieżki linków).
- [ ] Sprawdzić miejsca, gdzie szablony używają danych z requestu (jeśli są) — przenieść do JS po stronie klienta.
- [ ] Usunąć `server.url` z `capacitor.config.json`, `npx cap sync`, start appki z plików lokalnych.

### Etap 2 — zależności lokalnie (1–2 dni)
- [ ] Firebase SDK 10.7.1 (app, auth, firestore) pobrany do `public/scripts/vendors/firebase/` i podmienione importy.
- [ ] Czcionki Google → lokalne `woff2` + `@font-face` (warto przy okazji zmniejszyć liczbę rodzin z 6).
- [ ] Awatary DiceBear: zapis wygenerowanego awatara lokalnie po pierwszym pobraniu + domyślny awatar offline.
- [ ] GTM/GA ładowane asynchronicznie i tylko gdy jest sieć — błąd nie może zatrzymać appki.

### Etap 3 — JSON-y offline (1–2 dni)
- [ ] Kopiowanie `zentalist_web/public/languages/**` do paczki przy buildzie (jedno źródło prawdy zostaje w `zentalist_web`).
- [ ] `dataService.js`: kolejność: pamięć telefonu (nowsza wersja) → wersja wbudowana → sieć.
      Aktualizacja w tle, gdy jest sieć (porównanie po polu wersji/hashu — dodać `version` do JSON-ów albo osobny `languages/manifest.json`).
- [ ] Zapis pobranych JSON-ów przez `@capacitor/filesystem` (Directory.Data).

### Etap 3b — mniejsze pliki audio (½ dnia, można zrobić wcześniej, niezależnie od reszty)
- [ ] Decyzja 2026-10-25 (po odsłuchu próbek): **format C** — Azure `audio-24khz-48kbitrate-mono-mp3`
      (24 kHz zamiast 16 kHz — wyraźniejsze głoski syczące) + przycięcie ciszy do 0,1 s na początku i 0,25 s na końcu.
      Przycinanie przez `ffmpeg -ss … -to … -c copy` (bez ponownego kodowania). Pliki ~4–5× mniejsze (~23% obecnych).
- [ ] Dopisać to do `_misc/generate-audio-all.mjs` i zregenerować wszystkie 9 języków (te same URL-e — appka web/mobile od razu zyskuje szybsze ładowanie).
- [ ] Najlepiej po raporcie Whispera z 2026-10-25, żeby od razu uwzględnić poprawki tekstów.

### Etap 4 — audio offline (3–4 dni)
- [ ] `services/offlineAudioService.js`: lista URL-i z JSON-ów danego języka → pobieranie po kilka równolegle
      do `Directory.Data/audio/{lang}/...`, z postępem, wznawianiem i sprawdzaniem miejsca na dysku.
- [ ] `buttonComponent.js` / `challengePage.js`: jeśli plik lokalny istnieje → `Capacitor.convertFileSrc(path)`, inaczej URL z sieci.
- [ ] UX pobierania (decyzja 2026-10-25): **pobieranie całego języka naraz, appka sama proponuje** — po wyborze języka
      (i przy pierwszym wejściu w deck 02+) okienko „Pobierz audio dla Hiszpańskiego (13 MB), żeby działało bez internetu?
      [Pobierz teraz] [Później]”. Do tego to samo w profilu/ustawieniach: „pobrane ✓ / Pobierz / Usuń”.
      Ostrzeżenie, gdy telefon nie jest na Wi-Fi (`@capacitor/network`). Bez pobierania pojedynczych słówek przyciskiem.
- [ ] Gdy zmieni się nagranie (np. regeneracja jak dziś) — manifest z hashami plików, żeby dociągnąć tylko zmienione.
- [ ] Audio decku 01 wszystkich 9 języków kopiowane do paczki przy buildzie (~15 MB) — `offlineAudioService` traktuje je jak już pobrane.

### Etap 5 — odporność logowania, sync i zakupów (1–2 dni)
- [ ] Start appki nie czeka na Firebase Auth — tryb gościa/ostatni znany użytkownik od razu.
- [ ] Sync postępu: kolejka `pendingCloudSync` wysyłana przy powrocie sieci (`@capacitor/network`).
- [ ] Ekran Premium offline: status z cache RevenueCat, przycisk zakupu z komunikatem „wymaga internetu”.
- [ ] `sw.js` zostaje tylko dla wersji web (w appce nieużywany).

### Etap 5b — live updates (1–2 dni)
- [ ] Capgo (`@capgo/capacitor-updater`): konto, kanały `production` / `beta`, upload paczki `public/` z CLI.
- [ ] Aktualizacja pobierana w tle, aplikowana przy następnym uruchomieniu; automatyczny rollback, gdy nowa paczka nie wystartuje.
- [ ] Zasada: live update tylko dla zmian JS/CSS/HTML. Nowe wtyczki natywne / zmiany w `ios/`, `android/` → zawsze nowa wersja w App Store.
- [ ] Zgodność z zasadami Apple: live update nie może zmieniać głównego przeznaczenia appki ani omijać review dla nowych funkcji — poprawki i drobne zmiany OK.
- [ ] Sprawdzić aktualny cennik Capgo przed założeniem konta.

### Etap 6 — testy (2–3 dni)
- [ ] Scenariusze w trybie samolotowym: pierwsze uruchomienie bez sieci, karty, quiz, zmiana języka, audio pobrane/niepobrane, deck 01 z wbudowanym audio, leaderboard offline, postęp → powrót sieci → sync.
- [ ] Live update: nowa paczka → restart → działa; zepsuta paczka → rollback.
- [ ] Słaba sieć (Network Link Conditioner na iOS), przerwane pobieranie audio, mało miejsca na dysku.
- [ ] Android: ten sam zestaw (Capacitor — ten sam kod).
- [ ] Sprawdzić `MOBILE_DEV_GUIDE.md` §5f (uwagi z review Apple) — appka z lokalnymi plikami to też mocniejszy argument przy guideline 4.2.

### Etap 7 — wydanie i szablon
- [ ] **Dopiero po akceptacji obecnej wersji przez Apple:** wydanie jako nowa wersja w App Store / Google Play.
- [ ] Przeniesienie zmian do `zentalist_mobile_template` (i dalej do `hanzi_app`).
- [ ] Zaktualizować `MOBILE_DEV_GUIDE.md` (nowy model: pliki w appce, cache w Filesystem zamiast SW).

**Szacunek:** ~3 tygodnie pracy (etapy 1–6 z live updates), zależnie od tego, ile niespodzianek wyjdzie w EJS i `stats.ejs` (1456 linii).

## 4. Ważny kompromis — aktualizacje kodu

Dziś każda zmiana kodu (JS/CSS/HTML) trafia do użytkowników **natychmiast** po `firebase deploy`, bo appka ładuje stronę z sieci.
Po przejściu na pliki wbudowane:
- **treść** (JSON, MP3) — dalej natychmiast, bez App Store ✅
- **kod i wygląd** — dopiero z nową wersją w App Store / Google Play (review 1–2 dni) ⚠️

Jeśli szybkie poprawki kodu bez review są ważne, można później dodać „live updates”
(np. Capgo albo Ionic Appflow — pobierają nową paczkę JS/CSS w tle; dozwolone przez Apple dla kodu webowego, płatne/hostowane usługi).
Decyzja 2026-10-25: **robimy live updates** (etap 5b).

## 5. Decyzje (2026-10-25)
1. **Leaderboard zostaje** — kluczowa funkcja appki.
2. **Audio decku 01 wbudowane** dla wszystkich 9 języków — pierwsza kategoria jest darmowa dla każdego.
3. **Pobieranie audio całego języka**, appka sama proponuje pobranie (okienko po wyborze języka + w ustawieniach) — nie pojedyncze słówka.
4. **Live updates — tak** (Capgo, etap 5b).
5. **Produkcja dopiero po akceptacji obecnej wersji przez Apple.**
6. **Format audio C** — 48 kbps / 24 kHz, przycięta cisza (etap 3b).
