# Android Wrapper Plan (Archive / Draft)

## Status

This file is a planning document, not the current main runtime documentation for CodeHarbor.

- keep it as a draft/reference if Android wrapper work resumes
- do not treat it as the primary setup guide for this repository

## Goal

Build a Kotlin Android app that wraps the existing CodeHarbor web UI inside a polished mobile shell, keeps connection details manageable on-device, and is stable enough for repeatable smoke testing.

## Working Plan

1. Create a dedicated Android project in `android-app/`.
2. Use a `WebView`-based shell so the app can reuse the existing CodeHarbor UI and backend behavior.
3. Add native mobile controls for:
   - server address
   - username and password
   - quick reload
   - back navigation
   - open in external browser
   - connection status / loading state
4. Persist connection settings locally with `SharedPreferences` so the user does not have to re-enter them every launch.
5. Configure the app for local and remote CodeHarbor servers, including local HTTP development access.
6. Run smoke checks with Gradle builds and fix issues until the app assembles cleanly.
7. Keep this document updated if scope changes during implementation.

## Current Scope

- Android only
- Kotlin only
- Native wrapper shell plus embedded CodeHarbor web experience
- Material-based mobile UI refinements around the wrapper
- No iOS build in this task
- No backend protocol rewrite in the Android layer

## Permissions

The Android app should request only the minimum required permissions.

### Required

- `android.permission.INTERNET`
  - Needed to load the CodeHarbor web UI and reach the OpenCode-backed server.

- `android.permission.ACCESS_NETWORK_STATE`
  - Needed to inspect whether the device currently has a usable network connection and present better status messages.

## Security / Networking Notes

- The wrapper supports HTTPS endpoints and local HTTP endpoints.
- Cleartext traffic is allowed because local CodeHarbor development commonly runs on `http://127.0.0.1:1657` and LAN HTTP addresses.
- Credentials are stored in app-private `SharedPreferences` for convenience. This is acceptable for the wrapper scope, but if stronger device-side protection is needed later, move them to `EncryptedSharedPreferences`.

## Test Plan

- `gradlew.bat assembleDebug`
- `gradlew.bat test`
- Manual smoke test checklist:
  - launch app
  - edit server settings
  - load CodeHarbor page
  - reload page
  - navigate back inside `WebView`
  - open current page in external browser
  - rotate screen and confirm state restore is acceptable

## Developer Notes

- Android-specific setup and usage documentation lives in `android-app/README.md`.
- Chinese Android-specific setup and usage documentation lives in `android-app/README.zh-CN.md`.

## Git / Workspace Notes

- Android work lives on branch `feat/android-wrapper-app`.
- I may create local commits during implementation if requested later, but I will not create commits automatically unless you ask.
- If a generated file or experiment is clearly wrong, I can remove it while iterating so the Android project stays clean.

## Known Constraints

- There is no global Gradle installation in the environment, so the project must include its own Gradle wrapper.
- No Android device is currently connected over `adb`, so smoke testing is limited to build-time validation unless an emulator/device is attached later.
