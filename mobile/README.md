# Ghana Road Defect Collector — native app

This is the Android and iOS collector application. It is built with Expo SDK 57 and React Native, while the existing Next.js application continues to provide the API, administrator workspace, and public dashboard.

## Run on a phone

```bash
cd mobile
npm install
npx expo start
```

Install Expo Go on an Android or iPhone and scan the QR code. Camera and foreground-location access are requested only when the collector uses those features. Offline reports are saved inside the app and uploaded automatically when a connection returns.

## Build an installable app

```bash
cd mobile
npx eas-cli login
npx eas-cli build --profile preview --platform android
```

The `preview` profile produces an Android APK for internal testing. Production Android and iOS builds require the relevant Google Play or Apple developer credentials.

Remote push notifications require this installable development/preview app and an EAS project ID. Current Expo Go versions on Android do not support remote push notifications. Run `npx eas-cli init` once for the project before the first notification-enabled build; EAS writes the project ID into the Expo configuration.

## Configuration

The production API address is defined in `app.json` as `expo.extra.apiBaseUrl`.

## Privacy protection

The native app uses a mandatory privacy-review gate: a collector must retake any photo containing a recognisable person, vehicle, bicycle, or number plate. Pending images stay private. The administrator can run a stricter browser-based privacy re-check that blurs detected people, faces, vehicles, plates, and shop/storefront signs before verification.

A fully automatic detector running on the phone itself requires a custom native vision module and is therefore not available inside Expo Go. It remains a release requirement before unrestricted public mobile distribution; the administrator privacy re-check is the active technical fallback.
