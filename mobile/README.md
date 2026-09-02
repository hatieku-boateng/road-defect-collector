# Ghana Road Defect Collector — native app

This is the Android and iOS collector application. It is built with Expo SDK 57 and React Native, while the existing Next.js application continues to provide the API, administrator workspace, and public dashboard.

## Run on a phone

```bash
cd mobile
npm install
npx expo start
```

Install Expo Go on an Android or iPhone and scan the QR code. Camera and foreground-location access are requested only when the collector uses those features.

## Build an installable app

```bash
cd mobile
npx eas-cli login
npx eas-cli build --profile preview --platform android
```

The `preview` profile produces an Android APK for internal testing. Production Android and iOS builds require the relevant Google Play or Apple developer credentials.

## Configuration

The production API address is defined in `app.json` as `expo.extra.apiBaseUrl`.

## Privacy status

The native pilot uses a mandatory privacy-review gate: a collector must retake any photo containing a recognisable person, vehicle, bicycle, or number plate. Automatic on-device blurring remains enabled in the web collector; the native automatic detector will be added as a custom development-build module before public mobile distribution.
