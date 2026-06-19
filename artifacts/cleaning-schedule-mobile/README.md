# Tidy Home Mobile

This is the Expo/React Native version of the cleaning schedule app.

It talks to the Railway API through:

```text
EXPO_PUBLIC_API_URL=https://cleaning-schedule-production.up.railway.app
```

## Local Preview

From the repo root:

```powershell
pnpm --dir artifacts/cleaning-schedule-mobile exec expo start
```

Install Expo Go on your phone and scan the QR code. This is useful for quick UI checks.

## Internal Family Builds

Install EAS CLI:

```powershell
npm install --global eas-cli
```

Log in:

```powershell
eas login
```

Configure the project once:

```powershell
cd C:\Projects\Clean-Home\artifacts\cleaning-schedule-mobile
eas build:configure
```

Build Android:

```powershell
eas build --platform android --profile preview
```

This produces an APK link that Android family members can install directly.

Build iOS:

```powershell
eas device:create
eas build --platform ios --profile preview
```

iOS internal installs require an Apple Developer account and each family iPhone must be registered before it can install the app.
