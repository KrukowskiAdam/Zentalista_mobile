 krok‑po‑kroku plan wdrożenia w tym repo.

---

## 1) Gdzie co robić (VS Code vs Chrome vs Android Studio)

### VS Code (tu edytujesz)
- CSS/HTML/EJS/JS
- logika UI i wygląd
- konfiguracje projektu

### Chrome DevTools (tu sprawdzasz UI web)
- inspect element (HTML/CSS)
- console
- network
- szybkie testy wyglądu

### Android Studio (tu budujesz i uruchamiasz apkę)
- instalacja APK na fizycznym telefonie
- test realnego zachowania na Samsungu
- logcat i błędy natywne Android

W skrócie:
- edycja: VS Code
- podgląd web i debug CSS/DOM: Chrome
- uruchomienie aplikacji na telefonie: Android Studio

---

## 2) Daily workflow (Samsung po Wi‑Fi) — najwygodniejszy loop

### Folder roboczy
Wszystkie komendy poniżej uruchamiaj z katalogu projektu:

```bash
cd /Users/adamkrukowski/Desktop/WEB/ZENTLIST/mellowcards
```

### Terminal A (lokalny serwer aplikacji)
1. Przejdź do katalogu projektu:

```bash
cd /Users/adamkrukowski/Desktop/WEB/ZENTLIST/mellowcards
```

2. Uruchom emulatory (hosting + functions):

```bash
npx firebase-tools emulators:start --only hosting,functions
```

3. Zostaw ten terminal uruchomiony podczas testów na telefonie.

### Terminal B (style CSS live)
1. Przejdź do katalogu projektu:

```bash
cd /Users/adamkrukowski/Desktop/WEB/ZENTLIST/mellowcards
```

2. Uruchom watcher Tailwind (jeśli zmieniasz style w src/input.css):

```bash
npm run tailwind
```

3. Zostaw ten terminal uruchomiony, żeby public/css/style.css aktualizował się automatycznie.

### Android Studio (Samsung po Wi‑Fi)
1. Uruchom aplikację raz na urządzeniu (Run).
2. Po zmianach UI zwykle wystarczy odświeżyć widok w aplikacji.
3. Pełny Run rób co jakiś czas jako kontrolę finalną.

### Gdzie podgląd
1. Telefon Samsung: rzeczywisty wygląd i zachowanie aplikacji.
2. Chrome DevTools: inspect CSS/HTML, console, network (gdy działa zdalny podgląd WebView).
3. Android Studio Logcat: błędy Android/Capacitor.

### Szybki loop po zmianie UI
1. Edytuj pliki w VS Code.
2. Upewnij się, że Terminal A i B działają.
3. Odśwież ekran aplikacji na Samsungu.
4. Zweryfikuj wygląd na telefonie.

---

## 3) Kiedy trzeba robić pełny rebuild

Pełny "copy + run" jest wymagany, gdy zmieniasz:
- kod natywny Android (katalog android)
- pluginy Capacitor
- konfigurację Capacitor
- tryb uruchamiania (np. local bundle vs URL dev)

Komendy (z katalogu projektu):

```bash
cd /Users/adamkrukowski/Desktop/WEB/ZENTLIST/mellowcards
npx cap copy android
```

Następnie w Android Studio:
1. Build > Clean Project
2. Run na Samsungu

---

## 4) Kiedy nie trzeba robić pełnego rebuildu

Pełny rebuild zwykle nie jest potrzebny przy zmianach:
- CSS
- HTML/EJS
- JS frontend

Warunek: aplikacja jest uruchomiona w trybie dev URL i pobiera aktualny widok z lokalnego serwera.