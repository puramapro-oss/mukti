# Affirmations MUKTI — iOS

This is the source of the optional iOS widget and the local Capacitor 7 plugin.
The generated `ios/` directory remains disposable. No independent catalogue,
account, reminder scheduler or network service is created here.

## Integrating the generated Xcode project

Run from the repository root on a Mac with Xcode, CocoaPods and its `xcodeproj` gem:

```sh
npx cap add ios --packagemanager CocoaPods
npx cap sync ios
ruby scripts/widgets/apply-ios.rb
```

Then run the existing final `pod install` and `xcodebuild` steps. The installer
adds the shared sources to both targets, registers `AffirmationWidget` through a
custom Capacitor bridge controller, embeds the extension, merges the app's
existing entitlements and registers `mukti://`. It rejects an unknown bridge
controller or locally edited generated widget files instead of overwriting them.
Running it twice does not add targets, sources, URL schemes or embed entries twice.

Signing needs the App Group `group.dev.purama.mukti.affirmations` available to both
the existing application ID `dev.purama.mukti` and the extension ID
`dev.purama.mukti.affirmations`. A successful unsigned simulator build does not
prove those provisioning profiles or real-device behaviour.

## Contract and boundaries

- Plugin methods: `getState()`, `configure({ payload: string })`, `clear()`.
- `getState` returns `supported`, `configured`, optional `payload` and, when
  WidgetKit answers successfully, `installed`. Configuration never means that
  the user has installed the widget.
- Below iOS 16, `getState` reports `supported: false`; the existing application's
  minimum iOS deployment version is preserved.
- Calls are accepted only from the exact HTTPS origin `mukti.purama.dev`.
- Schema v1 has exactly `schemaVersion`, `cadence`, `items`, `configuredAt`.
  Cadence is `daily` or `moments`; 1–30 unique UUID-backed items have only `id` and
  `text`. Text is at most 100 Unicode code points. Unknown fields, controls,
  directional overrides, duplicates and JSON larger than 20 KiB are rejected.
- Public catalogue provenance is enforced by the server route. Structural
  validation cannot prove that an arbitrary `{ id, text }` pair exists in the DB;
  there is no claim of cryptographic catalogue verification.
- The canonical JSON cache uses the key/filename `affirmationWidget.v1` in the
  App Group. Writes are atomic. On iOS, data is available after the first device
  unlock. No login token, session or user-created affirmation is stored.
- The widget links to exactly `mukti://affirmations`; the application's existing
  Capacitor App launch/open listener owns navigation to the allowed web route.

## Rotation and refresh

Rotation matches the web and Android contract. For daily cadence, the ordinal is
the local civil day since 1970. For moments, it is `day * 3 + slot`, with 07:00,
13:00 and 20:00 for slots 0, 1 and 2. Before 07:00 it remains the previous day's
slot 2. The item index is the positive modulo of the ordinal by the pool size.
No adjacent items repeat when the validated pool contains more than one item.

Calendar arithmetic preserves local hours across daylight-saving transitions.
Every provider invocation uses the current system time zone. The app requests
reloads on foreground, significant time changes and time-zone changes; iOS still
controls when a suspended widget refreshes. The timeline contains future entries
as an offline fallback. It does not promise an exact refresh minute.

## Verification

The Foundation checks exercise actual payload validation, local rotation, DST,
time-zone differences and atomic cache writes. They do not require an iOS SDK:

```sh
swiftc native/affirmations/ios/Shared/*.swift native/affirmations/ios/tests/main.swift -o /tmp/mukti-affirmations-tests
/tmp/mukti-affirmations-tests
ruby native/affirmations/ios/tests/installer_test.rb
```

The Ruby integration test creates a temporary real `xcodeproj` fixture and checks
target membership, embedding, entitlements, idempotence and safe conflicts.
The separate iOS build must compile both the app and embedded widget. Device QA
must cover adding/removing the widget, denied/missing App Group access, native
configuration restoration, cold/warm deep links, clearing, offline display,
local-day transitions and the small/medium/Lock Screen layouts with large text.

## Official API references

- [Capacitor 7 local native plugins](https://capacitorjs.com/docs/v7/ios/custom-code)
- [Apple widget extensions](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension)
- [Apple timeline refresh](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
- [Apple accessory widgets](https://developer.apple.com/documentation/widgetkit/creating-accessory-widgets-and-watch-complications)
- [Xcodeproj source](https://github.com/CocoaPods/Xcodeproj)
