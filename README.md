# Almanaq

Availability app for distributed teams. It answers who on the team is actually
available right now, taking into account each person's local calendar: weekends that
are not Saturday and Sunday, national holidays, and observances that follow
non-Gregorian calendars and therefore move every year.

The case that defines the product: it is Friday noon in Buenos Aires, it looks like an
ordinary working day, and half the team is on a weekend or a public holiday.

## Status

| Piece    | Status                                                             |
|----------|--------------------------------------------------------------------|
| Backend  | Complete. Four endpoints, 79 tests, **contract frozen**            |
| Android  | v1 complete. 28 unit tests, 9 instrumented, run on a device        |
| iOS      | Not started                                                        |

The contract was frozen before either client started: with two apps in flight, a moving
contract doubles the rework.

What is still missing is listed at the end of this file.

## Structure

```
almanaq/
├── CLAUDE.md     standing instructions for the coding assistant
├── PLAN.md       scope, architecture, API contract and design system
├── SETUP.md      bootstrap and starting order
├── design/       colour tokens and mockups
├── backend/      Node + Hono + TypeScript
├── android/      Kotlin + Compose (to be created from Android Studio)
└── ios/          Swift + SwiftUI (to be created from Xcode)
```

## Backend

Requires Node 22 or newer. All business logic lives here: the clients ask for resolved
statuses and paint them.

```bash
cd backend
npm install
npm run dev      # server on http://localhost:3000
npm test         # 79 tests
npm run build    # compiles to dist/
```

### Endpoints

Base `/v1`. No database, no authentication and no state: the team lives on the device
and travels in every request.

| Endpoint                       | What it does                                       |
|--------------------------------|----------------------------------------------------|
| `GET  /v1/locations/search?q=` | City autocomplete when adding a member             |
| `POST /v1/availability`        | Each member's status at a given instant            |
| `POST /v1/calendar`            | Days with conflicts over a date range              |
| `POST /v1/member/detail`       | Work week, local calendar and upcoming holidays    |

Request and response details are in section 4 of `PLAN.md`.

```bash
curl -s "http://localhost:3000/v1/locations/search?q=tel+aviv"

curl -s -X POST http://localhost:3000/v1/availability \
  -H 'content-type: application/json' \
  -H 'accept-language: en' \
  -d '{"at":"2026-08-21T15:42:00Z","members":[
        {"id":"a1","countryCode":"IL","timezone":"Asia/Jerusalem"}]}'
```

### Statuses

The backend returns the enum already resolved and the text already written. The client
maps the status to a colour and nothing else.

| Status          | Meaning                        |
|-----------------|--------------------------------|
| `AVAILABLE`     | Within working hours           |
| `OFF_HOURS`     | Working day, outside hours     |
| `LOCAL_WEEKEND` | Local weekend                  |
| `LOCAL_HOLIDAY` | Local public holiday           |
| `UNKNOWN`       | Not enough data                |

**Holiday coverage is the only gate to `AVAILABLE`.** Without holiday data for a
country we never claim somebody is working: the answer is `UNKNOWN`. Wrong data is
worse than no data, because people schedule meetings with this.

### Language

User-facing text is localized by the backend from the `Accept-Language` header.
Spanish and English ship in v1, Spanish is the fallback, and the catalog lives in
`backend/src/domain/i18n.ts`. Adding a language is a server deploy, not two app store
releases.

```
accept-language: en   ->  "statusDetail": "Weekend in Israel"
accept-language: es   ->  "statusDetail": "Fin de semana en Israel"
```

Machine-readable fields (`status`, `localTime`, `utcOffsetMinutes`) are identical
across locales. Holiday names are not translated: they are provider data.

## Data

Everything is precomputed and committed. There are no network calls at runtime: no
latency, no dependency on a third party staying up, and the data is versioned in git,
where a wrong holiday shows up in the diff.

```bash
npm run build:holidays    # once a year
npm run build:locations   # when the GeoNames dump changes
```

| Data        | Source                              | Current coverage           |
|-------------|-------------------------------------|----------------------------|
| Holidays    | Three sources, in precedence order   | 74 of 75 target countries  |
| Cities      | [GeoNames](https://geonames.org) `cities15000`, CC BY 4.0 | 34,079 cities, 210 countries |
| Calendars   | Node's native ICU (`Intl`)          | Hebrew, Ethiopic, Persian, Hijri, Buddhist, Saka, Japanese |
| Work weeks  | Static table, sourced per row       | 20 countries + majority rule |

### Where the holidays come from

No single source covers the countries this product is about, so the build script tries
three in order and records which one produced each country's file:

| Order | Source | Countries | Why here |
|---|---|---|---|
| 1 | [Nager.Date](https://date.nager.at) | 57 | Verified against ICU and correct |
| 2 | [`date-holidays`](https://www.npmjs.com/package/date-holidays) | 9 | Offline dataset; covers Israel, the UAE, Saudi Arabia, Iran, India, Thailand, Malaysia, Pakistan, Brunei |
| 3 | Google public ICS feeds | 8 | Covers Qatar, Kuwait, Oman, Jordan, Iraq, Syria, Yemen, Lebanon, Afghanistan, Nepal, Maldives |

`date-holidays` is second and not first because it is not always right: it puts
Ethiopian Christmas on 6 January, while ICU puts Tahsas 29 on the 7th, where
Nager.Date also puts it. One wrong date is enough to keep a source from overriding a
verified one.

**Only Palestine has no source.** Its members resolve their weekend from our own work
week table and come back `UNKNOWN` on working days.

Changing any of this is cheap: `backend/scripts/build-holidays.ts` changes and nothing
else, because the data is precomputed.

## Android

Requires Android Studio, JDK 17 and the SDK command-line tools. `minSdk` is 26, which
is a hard floor rather than a preference: the app uses `java.time`, which does not exist
below it without core library desugaring.

```bash
cd android
./gradlew assembleDebug            # builds the APK
./gradlew installDebug             # installs on the connected device or emulator
./gradlew testDebugUnitTest        # 28 tests, run in CI
./gradlew connectedDebugAndroidTest  # 9 more, need a device, not run in CI
```

The backend address is editable in the app's Settings screen. `10.0.2.2` reaches the
host machine from the emulator; a real phone needs the host's address on the local
network, and the backend has to be reachable there.

The screens live under `app/src/main/java/com/phvillegas/almanaq/ui/`, one package per
screen, and hold no availability logic: they map a status to a colour and lay out values
the backend already resolved and localized.

The client computes exactly four things for itself, and the unit tests cover all four:
the ticking clock (from the offset the backend resolved, so no time zone database is
opened on the device), the `UTC±N` label, the phone owner's own weekend from ICU, and
the search for the first day with no conflicts. Anything beyond that list belongs in the
backend.

## Working on it

`main` is never committed to directly. Branches are named `type/short-description` with
the same types as the commit convention, one pull request per logical change, squash
merge only. A pull request says what was verified and what was not — including whether
a visible change was actually seen running, not just compiled.

The full rules are in `CLAUDE.md`.

## Design

The canonical colour values live in `design/tokens.json`, the single source of truth.
The hex values are identical on iOS and Android; what changes is how they are applied.
Every text and background pair must clear 4.5:1 in both themes.

**The type is Inter, bundled**, one variable file carrying every weight. The plan
originally called for the platform system font and no bundled fonts in v1; that was
reversed on 2026-08-31 because the system font read wrong for the product. iOS should
use the same file when it starts, or the two apps stop matching.

The font is deliberately **not subset**, which would have saved a few hundred kilobytes.
This app exists to show city and holiday names from countries nobody on the team thought
about, and a missing glyph is a tofu box in exactly those places.

**The contrast rule outranks the mockups.** One value in the plan does not survive it:
section 7.2 greys the weekend columns of the month grid at `#9C9DB4`, which measures
2.66:1 on the light background. A weekend day is selectable, so it is not an inactive
control and the WCAG exemption does not apply. The app uses `onSurfaceVariant` there
instead — the column still recedes, at 8.90:1 light and 10.91:1 dark.

## Colour

The Material 3 scheme is **generated from the `#4436C7` seed**, not written by hand, by
`backend/scripts/build-theme.ts`. It runs at design time and commits its output, exactly
like the holiday and city data: no colour maths on a device, and a palette change shows
up in a diff.

```bash
cd backend && npm run build:theme
```

One run writes two shapes. `material3` in `design/tokens.json` holds all 36 roles and is
emitted straight into Kotlin as `Material3Colors.kt`; `theme` holds twelve
platform-neutral names for iOS, which has no notion of Material roles. Both come from
the same generation, so the two platforms cannot drift.

The variant is **Fidelity**, chosen because the variants are not interchangeable. From
this seed, TonalSpot desaturates the brand to a grey lavender, Vibrant pushes it past the
icon, and Expressive rotates the hue to green. Fidelity preserves the source colour and
puts `#4436C7` itself into `primaryContainer`.

The availability status colours are **not** generated — green for available and amber for
a holiday are product meaning, and Material has no slot for them. The script re-checks
each one against the regenerated backgrounds at 4.5:1 and **refuses to write** if any pair
fails, so rule 7 is enforced rather than remembered.

## Documents

- `PLAN.md` — scope, architecture, API contract, design system and screens.
- `SETUP.md` — folder structure and bootstrap for each piece.
- `CLAUDE.md` — standing working rules: language, code style, branches and pull requests.
- `CONTRIBUTING.md` — the short version of those rules.
- `SECURITY.md` — what this project holds, and how to report a vulnerability.

## Licence and data

The code is under the [MIT licence](LICENSE).

**The committed data is not, and carries its own obligations.** It is redistributed
here, so the terms travel with it:

| Data | Source | Terms |
|---|---|---|
| `backend/src/data/locations/cities.json` | [GeoNames](https://www.geonames.org/) `cities15000` | **CC BY 4.0** — attribution required by anyone redistributing it |
| `backend/src/data/holidays/*.json` | [Nager.Date](https://date.nager.at), [`date-holidays`](https://www.npmjs.com/package/date-holidays) (MIT), and Google's public holiday calendars | Each file records which provider produced it, in its `provider` field |
| `android/app/src/main/res/font/inter_variable.ttf` | [Inter](https://rsms.me/inter/) v4.1 | **SIL Open Font License 1.1** — the full text travels with it, at `android/app/licenses/Inter-OFL.txt` |

If you fork this, the GeoNames attribution has to come with you. Holiday names appear as
each provider writes them and are not translated.

## Not done yet

Stated plainly so nobody rediscovers it the hard way:

- **iOS.** Not a line. It is half the product.
- **The detail header has no country name.** Section 7.3 of the plan asks for
  "City, Country · UTC±N" and the app shows "City · UTC±N". The member document stores a
  country *code*, and turning a code into a localized country name is exactly the kind of
  table that must not be written once in Kotlin and again in Swift. The backend already
  resolves it for search results, so the fix is a field on `/v1/member/detail` — a change
  to a frozen contract, and therefore a decision rather than a refactor.
- **The instrumented tests do not run in CI.** They need a device, and GitHub's runners
  have none. The nine in `AccessibilityTest`, `TeamScreenTest` and `PushedScreensTest`
  run locally with `./gradlew connectedDebugAndroidTest`.
- **TalkBack was never actually heard.** What a screen reader is handed is asserted
  against the semantics tree; the audio itself was not listened to, because there is no
  way to capture speech from an emulator.
- **"Schedule anyway" does not schedule anything.** It acknowledges the conflict and
  nothing else. Handing the chosen date to the device calendar through
  `Intent.ACTION_INSERT` is not in the section 2 scope, so it stays proposed.
- **The mockups in `design/` are Spanish only.** The app is localized; the reference
  images are not.
