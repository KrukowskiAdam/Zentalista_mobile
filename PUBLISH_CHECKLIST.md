# Zentalist — App Store & Google Play Publication Checklist

## Przed publikacją — checklist techniczny

### 1. Wersjonowanie
- Masz `versionCode 1` / `versionName "1.0"` — OK na start.

### 2. RevenueCat klucze
- Masz `test_` klucze w `public/scripts/config/iapConfig.js`.
- Przed release zamień na **produkcyjne** z dashboardu RevenueCat.

### 3. Build produkcyjny
- Upewnij się że Capacitor web assets są aktualne:
```bash
cd zentalist_mobile
npx cap sync
```

---

## Apple App Store (iOS)

### 1. App Store Connect
- https://appstoreconnect.apple.com
- Kliknij "+" → New App
- Platform: iOS
- Name: **Zentalist**
- Bundle ID: `com.zentalist.app` (musisz najpierw zarejestrować w Certificates, Identifiers & Profiles)
- SKU: `zentalist` (dowolny unikalny string)
- Primary Language: English

### 2. Certificates & Provisioning
- W Xcode → Signing & Capabilities → Team → wybierz swoje konto
- Xcode automatycznie utworzy provisioning profile
- Upewnij się że masz **Distribution Certificate** (nie tylko Development)

### 3. Utwórz subskrypcje w App Store Connect
- App Store Connect → Twoja app → Subscriptions
- Utwórz Subscription Group (np. "Zentalist Premium")
- Dodaj: Monthly ($9.99), Annual ($59.99)
- W In-App Purchases dodaj: Lifetime ($99.99) jako non-consumable
- Skonfiguruj te same produkty w **RevenueCat dashboard**

### 4. Build & Upload
```bash
npx cap sync ios
```
- Otwórz `ios/App/App.xcworkspace` w Xcode
- Product → Archive
- Distribute App → App Store Connect

### 5. App Store Connect — wypełnij szczegóły
- Screenshots (6.7" i 6.5" wymagane, opcjonalnie iPad)
- Opis, słowa kluczowe, kategoria (Education)
- Privacy Policy URL (wymagane!)
- Age Rating
- Submit for Review

---

## Google Play Store (Android)

### 1. Google Play Console
- https://play.google.com/console
- Create app → "Zentalist", Free, Education

### 2. Podpis APK
- Wygeneruj keystore (jednorazowo, **zachowaj go bezpiecznie**):
```bash
keytool -genkey -v -keystore zentalist-release.keystore -alias zentalist -keyalg RSA -keysize 2048 -validity 10000
```
- Dodaj do `android/app/build.gradle` signing config, lub użyj Google Play App Signing (zalecane)

### 3. Utwórz subskrypcje w Google Play Console
- Monetize → Products → Subscriptions: Monthly, Annual
- In-app products: Lifetime (one-time)
- Skonfiguruj w **RevenueCat dashboard**

### 4. Build AAB
```bash
npx cap sync android
cd android
./gradlew bundleRelease
```
Plik: `android/app/build/outputs/bundle/release/app-release.aab`

### 5. Upload & wypełnij
- Production → Create release → upload AAB
- Store listing: opis, screenshots, ikona 512x512
- Content rating questionnaire
- Privacy Policy URL
- Data safety form
- Target audience
- Submit for Review

---

## Krytyczne rzeczy do zrobienia PRZED submittem

| Zadanie | Status |
|---|---|
| Privacy Policy page (URL) | ✅ `/privacy` route added |
| Ikona app (1024x1024 iOS, 512x512 Android) | ✅ Podpięta |
| Screenshots (min 2 per rozdzielczość) | ⬜ Potrzebujesz |
| RevenueCat produkcyjne klucze | ⬜ Zamień test_ → prod |
| Produkty IAP w obu store'ach + RevenueCat | ⬜ Utwórz |
| Keystore Android (i backup!) | ⬜ Wygeneruj |
| `npx cap sync` po ostatnich zmianach | ✅ Done |
