# Almanaq

Availability app for distributed teams. It answers who on the team is actually
available right now, taking into account each person's local calendar: weekends that
are not Saturday and Sunday, national holidays, and observances that follow
non-Gregorian calendars and therefore move every year.

The case that defines the product: it is Friday noon in Buenos Aires, it looks like an
ordinary working day, and half the team is on a weekend or a public holiday.

## Status

| Piece    | Status                                                    |
|----------|-----------------------------------------------------------|
| Backend  | All four endpoints working, with tests. Contract not frozen |
| Android  | Not started                                                |
| iOS      | Not started                                                |

The clients do not start until the contract is frozen: with two apps in flight, a
moving contract doubles the rework.

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
npm test         # 78 tests
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
| Holidays    | [Nager.Date](https://date.nager.at) | 57 countries               |
| Cities      | [GeoNames](https://geonames.org) `cities15000`, CC BY 4.0 | 34,079 cities, 210 countries |
| Calendars   | Node's native ICU (`Intl`)          | Hebrew, Ethiopic, Persian, Hijri, Buddhist, Saka, Japanese |
| Work weeks  | Static table, sourced per row       | 20 countries + majority rule |

### Known limitation of the holiday provider

Nager.Date lists 204 countries but covers none of these:

```
IL SA QA KW OM JO PS MV AE AF IR NP BN TH IN MY PK LB
```

That is almost exactly the set of countries with a non-standard work week, which is
the problem Almanaq exists to solve. Their members come back `UNKNOWN` on working
days; weekends still resolve correctly, because those come from our own table.

Switching providers is cheap: `backend/scripts/build-holidays.ts` changes and nothing
else. See the open decision in section 13 of `PLAN.md`.

## Design

The canonical colour values live in `design/tokens.json`, the single source of truth.
The hex values are identical on iOS and Android; what changes is how they are applied.
Every text and background pair must clear 4.5:1 in both themes.

## Documents

- `PLAN.md` — scope, architecture, API contract, design system and screens.
- `SETUP.md` — folder structure and bootstrap for each piece.
- `CLAUDE.md` — standing working rules, including language and code style.
