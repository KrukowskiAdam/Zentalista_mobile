# Mobile App Guide

Praktyczny przewodnik pracy nad aplikacją mobilną (Capacitor + Firebase Functions/Hosting) w tym repo.

## 1) Co robić w którym narzędziu

### VS Code
- Edycja UI i logiki: CSS, HTML/EJS, JS.
- Zmiany konfiguracji projektu.

### Chrome DevTools
- Szybka analiza DOM/CSS.
- Console i Network dla warstwy web.

### Android Studio
- Build i uruchamianie na fizycznym urządzeniu.
- Logcat i błędy warstwy natywnej.

## 2) Daily workflow (Samsung po Wi-Fi)

Wszystkie komendy uruchamiaj z katalogu projektu:

```bash
cd /Users/adamkrukowski/Desktop/WEB/ZENTLIST/mellowcards
```

### Terminal A: backend lokalny

```bash
npx firebase-tools emulators:start --only hosting,functions
```

Zostaw terminal uruchomiony podczas testów.

### Terminal B: style live

```bash
npm run tailwind
```

Zostaw terminal uruchomiony, aby odświeżać CSS automatycznie.

### Android Studio: urządzenie fizyczne
1. Uruchom aplikację raz przez Run.
2. Po zmianach UI zwykle wystarczy odświeżyć widok.
3. Pełny Run wykonuj okresowo jako kontrolę końcową.

### Szybki loop po zmianie UI
1. Edytuj pliki w VS Code.
2. Sprawdź, czy Terminal A i B działają.
3. Odśwież ekran aplikacji na Samsungu.
4. Zweryfikuj wygląd i zachowanie.

## 3) Kiedy robić pełny rebuild

Pełny rebuild jest wymagany, gdy zmieniasz:
- Kod natywny Android/iOS.
- Pluginy Capacitor.
- Konfigurację Capacitor.
- Tryb uruchamiania aplikacji.

Przykładowy krok synchronizacji Android:

```bash
npx cap copy android
```

Następnie w Android Studio:
1. Build > Clean Project.
2. Run na urządzeniu.

## 4) Kiedy pełny rebuild zwykle nie jest potrzebny

Zwykle nie trzeba pełnego rebuildu przy zmianach:
- CSS.
- HTML/EJS.
- Frontend JS.

Warunek: aplikacja działa w trybie dev i ładuje aktualny widok z lokalnego środowiska.

## 5) Stan repo po porządkach

### Wykonane
- Metadane repo w package zostały zaktualizowane na Zentalista_mobile.
- Dodano ignorowanie .DS_Store.
- Konfiguracja Capacitor została przygotowana pod release (bez server.url).

### Zalecenia bezpieczeństwa
- Nie trzymaj pliku firebase-service-account.json w katalogu repo (nawet jeśli jest ignorowany).
- Trzymaj sekrety poza repo i podawaj je przez zmienne środowiskowe.

## 6) Szybka checklista przed release

1. Upewnij się, że w capacitor.config.json nie ma sekcji server.url.
2. Zweryfikuj, że sekrety nie są trackowane przez git.
3. Zrób finalny build i test na fizycznym Samsungu.
4. Sprawdź logcat pod kątem błędów krytycznych.