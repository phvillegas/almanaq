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
| Android  | v1 scope complete, verified running against the backend            |
| iOS      | Not started                                                        |

The contract was frozen before either client started: with two apps in flight, a moving
contract doubles the rework.

What Android is still missing is listed at the end of this file.

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
./gradlew assembleDebug     # builds the APK
./gradlew installDebug      # installs on the connected device or emulator
```

The backend address is editable in the app's Settings screen. `10.0.2.2` reaches the
host machine from the emulator; a real phone needs the host's address on the local
network, and the backend has to be reachable there.

The screens live under `app/src/main/java/com/phvillegas/almanaq/ui/`, one package per
screen, and hold no availability logic: they map a status to a colour and lay out values
the backend already resolved and localized.

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

If you fork this, the GeoNames attribution has to come with you. Holiday names appear as
each provider writes them and are not translated.

## Not done yet

Stated plainly so nobody rediscovers it the hard way:

- **iOS.** Not a line. It is half the product.
- **"Find a time" does not find anything.** The button opens the month view; it does not
  filter to the days without conflicts, which section 7.2 of the plan asks for.
- **No loading states.** Section 7.4 asks for skeletons; screens currently appear empty
  and then fill in at once.
- **The clock does not tick.** Local times refresh when the screen is reopened, not every
  minute, and there is no refresh on returning from the background.
- **No client tests.** The backend has 79; Android has none.
- **Accessibility is unverified.** TalkBack and large font sizes were never tried.
- **The launcher icon is a placeholder**, on-brand but not a designed mark.
