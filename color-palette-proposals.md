# Propozycje palety kolorów — Zentalist Mobile

Kontekst: obecna paleta w `tailwind.config.js` (motyw `one`) opiera się na ciemnych,
zgaszonych granatach (`#232f34`, `#344955`, `#4a6572`) + rozrzuconych "wyjątkach"
(`level-expert`, `level-learning`, `level-mastered`, `light-border`,
`button-disabled`). To za dużo niezależnie dobieranych kolorów bez wspólnego
systemu i nie pasuje do trendu aplikacji edukacyjnych typu Duolingo (jasne tło,
1 mocny kolor marki, wysoki kontrast, dużo "oddechu").

Poniżej: (1) zasady zaczerpnięte z Apple HIG i Material 3, (2) zredukowany zestaw
**ról** kolorów zamiast osobnych zmiennych na każdy przypadek, (3) trzy konkretne
warianty palety zbudowane **wyłącznie z oficjalnych kolorów systemowych Apple**
(więc gwarantowane, przetestowane, bezpieczne wartości — nie zgadywane).

---

## 1. Zasady, które przenosimy do naszej apki

**Z Apple HIG (Color):**
- Kolor ma znaczyć **jedno** w całej apce — ten sam kolor nie może raz oznaczać
  "poprawna odpowiedź", a raz "przycisk drugorzędny".
- Każdy kolor musi mieć wariant **light i dark** (i najlepiej increased-contrast),
  nawet jeśli na razie robimy tylko jeden motyw.
- Kolory nazywamy **semantycznie** (`surface`, `on-surface`, `primary`), nie po
  wyglądzie (`design-1`, `design-2`) — dzięki temu przetrwają zmianę odcienia.
- Neutralne tło ma hierarchię: primary background → secondary → tertiary
  (dokładnie tak jak `systemBackground` → `secondarySystemBackground` →
  `tertiarySystemBackground` w iOS).

**Z Material 3 (Color roles):**
- Rozróżnienie **fill vs "on"**: każdy kolor akcentu (`primary`) ma swoją parę
  tekstu/ikony na nim (`on-primary`), i swój "cichszy" wariant do wypełnień
  (`primary-container` + `on-primary-container`).
- Neutralne powierzchnie (`surface`) mają osobną skalę kontenerów
  (`surface-container-low/…/highest`) zamiast wymyślać nowe szare co chwilę.
- `error` jest zawsze osobną, stałą rolą — nie recyklingujemy czerwonego z gdzie
  indziej.
- `outline` (mocna, np. obramowanie inputa) vs `outline-variant` (subtelna, np.
  linia separatora) — to rozwiązuje nasz obecny `light-border` w sposób, który
  skaluje się na więcej przypadków bez dodawania kolejnych zmiennych.

**Wniosek:** zamiast 7 `learning-app-design-N` + 5 osobnych "wyjątków" (12 zmiennych
bez wspólnej logiki), potrzebujemy ok. **14–16 ról**, ale są to role w jednym
systemie (fill/on/container/surface-poziomy), więc dodanie nowego przypadku w
przyszłości nie wymaga wymyślania nowego koloru — składamy go z istniejących ról.

---

## 2. Wspólny szkielet ról (dla wszystkich wariantów poniżej)

| Rola | Do czego | Odpowiednik z obecnego configu |
|---|---|---|
| `surface` | główne tło ekranu | `learning-app-design-1` |
| `surface-secondary` | tło kart, sekcji | `learning-app-design-2` |
| `surface-tertiary` | zagnieżdżone tło (np. tło w karcie) | `learning-app-design-3` |
| `on-surface` | tekst główny | — (nowe, brakowało jasnego tekstu podstawowego) |
| `on-surface-secondary` | tekst drugorzędny / opisy | — |
| `outline` | obramowania inputów, mocne linie | `light-border` |
| `outline-variant` | separatory, subtelne linie | — |
| `primary` | główny CTA, marka apki | `learning-app-design-4` |
| `on-primary` | tekst/ikony na `primary` | — |
| `primary-container` | tło "miękkich" przycisków/badge'y | — |
| `secondary` | akcent poboczny (info, linki, "w trakcie nauki") | `level-learning` |
| `success` | poprawna odpowiedź, "opanowane" | `level-mastered` |
| `warning` / streak | seria dni, XP, uwaga | `level-expert` |
| `error` | zła odpowiedź, utracone życie | `learning-app-design-6` |
| `disabled` | przyciski nieaktywne | `button-disabled` |

Wszystkie trzy warianty niżej używają **dokładnie tego samego szkieletu ról**,
różni je tylko dobór konkretnych barw (żeby łatwo było porównać "na oko").

---

## 3. Wariant A — "Apple System Safe" (rekomendowany)

Zasada: 1:1 kolory systemowe Apple, zero customowych barw. Najbezpieczniejszy
wybór — te kolory są przetestowane pod kątem kontrastu i dostępności na
miliardach ekranów.

Motyw jasny jako domyślny (zgodnie z trendem apek edukacyjnych — Duolingo,
Anki, Babbel wszystkie mają jasne tło domyślnie), z gotowym mapowaniem dark mode.

| Rola | Light | Dark | Źródło (Apple) |
|---|---|---|---|
| `surface` | `#FFFFFF` | `#000000` | systemBackground |
| `surface-secondary` | `#F2F2F7` | `#1C1C1E` | systemGray6 |
| `surface-tertiary` | `#E5E5EA` | `#2C2C2E` | systemGray5 |
| `on-surface` | `#1C1C1E` | `#F2F2F7` | label |
| `on-surface-secondary` | `#8E8E93` | `#8E8E93` | systemGray (label secondary) |
| `outline` | `#C7C7CC` | `#48484A` | systemGray3 |
| `outline-variant` | `#E5E5EA` | `#3A3A3C` | systemGray5 / systemGray4 |
| `primary` | `#34C759` | `#30D158` | Green |
| `on-primary` | `#FFFFFF` | `#000000` | — |
| `primary-container` | `#D1F5DC` | `#0F3D22` | Green, rozjaśniony/przyciemniony |
| `secondary` | `#0088FF` | `#0091FF` | Blue |
| `success` | `#34C759` | `#30D158` | Green (ta sama rola co primary — w apce do nauki "dobra odpowiedź" = kolor marki, jak w Duolingo) |
| `warning` (streak/XP) | `#FF8D28` | `#FF9230` | Orange |
| `error` | `#FF383C` | `#FF4245` | Red |
| `disabled` | `#AEAEB2` | `#636366` | systemGray2 |

**Dlaczego to jest "bezpieczne":** wszystkie wartości pochodzą wprost ze
specyfikacji Apple (SwiftUI `Color.green`, `.blue`, `.orange`, `.red`,
`.systemGray*`) — więc kontrast tekst/tło jest gwarantowany, a wygląd będzie
naturalnie znajomy dla użytkowników iOS.

---

## 4. Wariant B — "Duolingo-inspired warm"

Ta sama pula kolorów Apple, ale inny przydział ról: `warning`/streak dostaje
żółty (bardziej "gamifikacyjny", kojarzy się z XP/monetami), a `secondary`
(niebieski) jest używany oszczędniej — tylko do linków/info, nie do dużych
powierzchni. Reszta identyczna jak Wariant A.

| Rola | Light | Dark | Źródło (Apple) |
|---|---|---|---|
| `surface` | `#FFFFFF` | `#000000` | systemBackground |
| `surface-secondary` | `#F2F2F7` | `#1C1C1E` | systemGray6 |
| `surface-tertiary` | `#E5E5EA` | `#2C2C2E` | systemGray5 |
| `on-surface` | `#1C1C1E` | `#F2F2F7` | label |
| `on-surface-secondary` | `#8E8E93` | `#8E8E93` | systemGray |
| `outline` | `#C7C7CC` | `#48484A` | systemGray3 |
| `outline-variant` | `#E5E5EA` | `#3A3A3C` | systemGray5 / systemGray4 |
| `primary` | `#34C759` | `#30D158` | Green |
| `on-primary` | `#FFFFFF` | `#000000` | — |
| `primary-container` | `#D1F5DC` | `#0F3D22` | Green (jasny/ciemny tint) |
| `secondary` | `#0088FF` | `#0091FF` | Blue (tylko linki/info, mała powierzchnia) |
| `success` | `#34C759` | `#30D158` | Green |
| `warning` (streak/XP) | `#FFCC00` | `#FFD600` | Yellow |
| `error` | `#FF383C` | `#FF4245` | Red |
| `disabled` | `#AEAEB2` | `#636366` | systemGray2 |

Różnica względem A jest kosmetyczna, ale żółty na streak/XP czyta się bardziej
"nagrodowo" (jak płomień/gwiazdka) niż pomarańczowy, który łatwiej pomylić z
`error` na pierwszy rzut oka.

---

## 5. Wariant C — "Calm learning" (mint/teal jako marka)

Dla odróżnienia się od typowego zielonego "Duolingo-clone" — marka oparta o
Mint/Teal (też natywne kolory Apple, rzadziej używane jako marka appek, więc
bardziej rozpoznawalne). Zielony przesuwa się wyłącznie do roli `success`
(poprawna odpowiedź), więc marka i feedback są rozróżnialne.

| Rola | Light | Dark | Źródło (Apple) |
|---|---|---|---|
| `surface` | `#FFFFFF` | `#000000` | systemBackground |
| `surface-secondary` | `#F2F2F7` | `#1C1C1E` | systemGray6 |
| `surface-tertiary` | `#E5E5EA` | `#2C2C2E` | systemGray5 |
| `on-surface` | `#1C1C1E` | `#F2F2F7` | label |
| `on-surface-secondary` | `#8E8E93` | `#8E8E93` | systemGray |
| `outline` | `#C7C7CC` | `#48484A` | systemGray3 |
| `outline-variant` | `#E5E5EA` | `#3A3A3C` | systemGray5 / systemGray4 |
| `primary` | `#00C3D0` | `#00D2E0` | Teal |
| `on-primary` | `#FFFFFF` | `#000000` | — |
| `primary-container` | `#CDF4F7` | `#00363B` | Teal (tint) |
| `secondary` | `#0088FF` | `#0091FF` | Blue |
| `success` | `#34C759` | `#30D158` | Green (osobno od marki) |
| `warning` (streak/XP) | `#FF8D28` | `#FF9230` | Orange |
| `error` | `#FF383C` | `#FF4245` | Red |
| `disabled` | `#AEAEB2` | `#636366` | systemGray2 |

---

## 6. Rekomendacja

**Wariant A.** Jest najbliżej "bezpiecznego, standardowego" wyglądu, o który
prosisz — zero zgadywania, kolory wprost ze specyfikacji Apple, a `success` =
`primary` = zielony domyślnie kojarzy się z "dobrze/rozwój", co jest naturalne
dla apki do nauki. Wariant B jako wariant do testów A/B (żółty zamiast
pomarańczowego na streak). Wariant C tylko jeśli zależy Ci na odróżnieniu się
wizualnym od Duolingo/innych appek z zielonym jako marką.

## 7. Mapowanie migracji (stare zmienne → nowe role)

| Stara zmienna | Nowa rola |
|---|---|
| `learning-app-design-1` | `surface` |
| `learning-app-design-2` | `surface-secondary` |
| `learning-app-design-3` | `surface-tertiary` / `outline` (14 użyć jako border — do przejrzenia case-by-case) |
| `learning-app-design-4` | `primary` / `success` |
| `learning-app-design-5` | `secondary` |
| `learning-app-design-6` | `error` |
| `learning-app-design-7` | `warning` |
| `level-expert` / `level-expert-progress` | `warning` (+ jego container/tint) |
| `level-learning` | `secondary` |
| `level-mastered` | `success` |
| `light-border` | `outline` |
| `button-disabled` | `disabled` |

Uwaga: `learning-app-design-3` jest dziś używany zarówno jako tło (`bg-`, 50×)
jak i jako border (`border-`, 14×) — w nowym systemie to sygnał, że powinien
zostać rozdzielony na `surface-tertiary` (tła) i `outline` (obramowania),
zamiast dzielić jedną zmienną między dwie różne role.
