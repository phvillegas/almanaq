# Almanaq — Product and technical plan

Availability app for distributed teams.

Reference document for the coding assistant. It holds the scope, the architecture, the
API contract, the design system and the screen specifications.

**Read this whole document before writing code.** The "Working rules" section at the
end defines limits that are not to be crossed.

---

## 1. Product

### What it is

An app that answers one question: **who on my team is actually available right now,
and which days are worth avoiding?**

What separates it from any time zone converter is that it accounts for each person's
**local calendar**, not just the clock: weekends that are not Saturday and Sunday,
national holidays, and observances that follow non-Gregorian calendars and therefore
move every year.

### Who it is for

People coordinating with colleagues in other countries. The case that defines the
product: it is Friday noon in Buenos Aires, it looks like an ordinary working day, and
half the team is on a weekend or a public holiday.

### What it is not

- Not an app about curious calendars, and not a cultural catalogue.
- Not multiplayer. **Nobody but the user installs anything.**
- Not a chat, not a scheduler, not a CRM.

### Single-player model (critical)

The user adds people with **a name and a city**. The app infers everything else (time
zone, country, work week, holidays) from public data.

The people added **have no account, receive nothing and confirm nothing.** This
decision is what makes the product viable: it does not depend on anyone else adopting
it.

---

## 2. v1 scope

### In

1. Add and remove team members (name and city).
2. "Now" view: each member's availability status in real time.
3. "Pick a date" view: a monthly calendar with conflicting days marked and a summary
   of who is unavailable on the chosen date.
4. "Detail" view: work week, local calendar and upcoming holidays for one person.
5. Manual correction: the user can override any member's work week or working hours.

### Out (explicitly)

- Accounts, login, cross-device sync (v1 uses local storage).
- Widgets. Deferred to v1.1 — they are separate native code on each platform
  (Glance / WidgetKit) and add nothing to the core.
- Push notifications.
- Google Calendar / Outlook integration.
- Multiplayer mode or invitations.
- Any "calendars of the world" view detached from the team.

### Decision rule when scope is unclear

If a feature does not help answer "are they available?" or "which day should I pick?",
it stays out of v1.

---

## 3. Architecture

### Central principle

> **The client never computes availability.**

All the logic about calendars, time zones, work weeks and holidays lives in the
backend. Clients ask for resolved statuses and paint them.

The reason: there are two native apps. Any logic living in the client has to be
written, tested and fixed twice. And any holiday data correction would require
shipping a new version to two stores.

### Components

```
┌─────────────────┐     ┌─────────────────┐
│ Native Android  │     │   Native iOS    │
│ Kotlin + Compose│     │ Swift + SwiftUI │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │  HTTPS / JSON
            ┌────────▼────────┐
            │     Backend     │
            │  All the logic  │
            └────────┬────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼───┐  ┌─────▼────┐  ┌────▼─────┐
   │  ICU   │  │ Holiday  │  │ Zone and │
   │(native │  │ JSON in  │  │ work week│
   │ to Node│  │ the repo │  │ tables   │
   └────────┘  └──────────┘  └──────────┘
```

### Backend — stack

**Node + Hono.** Decided, not up for choice.

The main reason: **Node ships full ICU out of the box.** `Intl.DateTimeFormat` with
extensions (`-u-ca-hebrew`, `-u-ca-ethiopic`, `-u-ca-persian`) works with nothing to
install and nothing to configure. All the calendar conversion logic is a few lines.

Hono rather than Express: lighter, and it runs the same on a traditional server or
serverless.

**No database. No ORM. No authentication. No state.**
The team is stored on the device and travels in every request.

Deployment: Vercel or Railway. Cost is effectively nil.

### Why not Supabase (in v1)

Supabase solves Postgres, auth and storage. v1 needs none of the three. Using it would
mean dragging in the whole platform only to end up using Edge Functions, which are
ordinary serverless functions.

**Reconsider it in v1.1 if accounts and sync get added** (see section 12). At that
point it is a good choice and solves auth and data in one move.

### Warning about alternative runtimes

If Cloudflare Workers, Deno or another runtime is evaluated for price or latency:
**check `Intl` support for non-Gregorian calendars first.** It has historically been
trimmed down, and it is precisely the capability the product rests on. Write a test
that converts a date to the Hebrew, Ethiopic and Persian calendars before committing
to a runtime.

### Build order (important)

1. **Backend complete and frozen**, with tests.
2. Only then, both clients in parallel.

Do not start the clients until the API contract is closed. If the contract moves while
two apps are in flight, the rework doubles.

---

## 4. API contract

Base: `/v1`. All dates and times in ISO 8601. All responses in JSON.

User-facing text is localized from the `Accept-Language` header. Spanish and English
ship in v1 and Spanish is the fallback, so the same request in a different language
returns the same `status` with different `statusLabel` and `statusDetail`. Examples
below use English.

### Member model (stored by the client)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Nadia Peretz",
  "city": "Tel Aviv",
  "countryCode": "IL",
  "timezone": "Asia/Jerusalem",
  "overrides": {
    "workDays": null,
    "workStartLocal": null,
    "workEndLocal": null
  },
  "updatedAt": "2026-08-18T14:20:00Z"
}
```

`overrides` set to `null` means "use the value inferred from the country".

**`id` must be a UUID v4, never auto-incrementing.** This is not optional: it is what
allows migrating to a shared database later with a direct `INSERT`, without having to
reassign keys. See section 12.

`updatedAt` is unused in v1, but it is stored from day one for the same reason.

---

### `GET /v1/locations/search?q=tel+aviv`

City autocomplete when adding a member.

```json
{
  "results": [
    {
      "city": "Tel Aviv",
      "region": "Tel Aviv",
      "country": "Israel",
      "countryCode": "IL",
      "timezone": "Asia/Jerusalem"
    }
  ]
}
```

`country` is localized; `city` and `region` keep their local spelling.

---

### `POST /v1/availability`

The main endpoint. The client sends its team and an instant; it receives statuses.

Request:

```json
{
  "at": "2026-08-21T15:42:00Z",
  "members": [
    { "id": "a1", "countryCode": "IL", "timezone": "Asia/Jerusalem", "overrides": null }
  ]
}
```

Response:

```json
{
  "at": "2026-08-21T15:42:00.000Z",
  "availableCount": 2,
  "totalCount": 6,
  "members": [
    {
      "id": "a1",
      "localTime": "18:42",
      "localDate": "2026-08-21",
      "localWeekday": "friday",
      "utcOffsetMinutes": 180,
      "status": "LOCAL_WEEKEND",
      "statusLabel": "Weekend",
      "statusDetail": "Weekend in Israel"
    }
  ]
}
```

**The `status` enum** — the client maps this to a colour, nothing more:

| Value           | Meaning                              | Colour       |
|-----------------|--------------------------------------|--------------|
| `AVAILABLE`     | Within working hours                 | green        |
| `OFF_HOURS`     | Working day, outside hours           | grey         |
| `LOCAL_WEEKEND` | Local weekend                        | Meridian     |
| `LOCAL_HOLIDAY` | Local public holiday                 | Meridian     |
| `UNKNOWN`       | No data for that country             | grey         |

The backend sends `statusLabel` and `statusDetail` already written and localized.
**The client does not compose this text.**

Members come back sorted by status: available, off hours, weekend, holiday, unknown.
The client sorts by name within each group, because the backend never receives names.

---

### `POST /v1/calendar`

Feeds the month view: which days have conflicts.

Request:

```json
{
  "from": "2026-08-01",
  "to": "2026-08-31",
  "members": [ /* same as above */ ]
}
```

Response:

```json
{
  "days": [
    {
      "date": "2026-08-21",
      "conflictCount": 3,
      "conflicts": [
        { "memberId": "a1", "reason": "LOCAL_WEEKEND", "detail": "Weekend in Israel" },
        { "memberId": "b2", "reason": "LOCAL_WEEKEND", "detail": "Weekend in United Arab Emirates" },
        { "memberId": "c3", "reason": "LOCAL_HOLIDAY", "detail": "Holiday in Ethiopia: Buhe" }
      ]
    }
  ]
}
```

Only return days with `conflictCount > 0`. Absent days are clear.

---

### `POST /v1/member/detail`

Request:

```json
{
  "member": { /* member model */ },
  "at": "2026-08-21T15:42:00Z"
}
```

Response:

```json
{
  "localTime": "18:42",
  "localDateFormatted": "Friday, August 21",
  "utcOffsetMinutes": 180,
  "status": "LOCAL_WEEKEND",
  "statusLabel": "Local weekend",
  "workWeek": {
    "daysLabel": "Sun to Thu",
    "weekendLabel": "Fri and Sat",
    "hoursLabel": "9:00 to 18:00"
  },
  "localCalendar": {
    "system": "hebrew",
    "label": "Hebrew",
    "currentYear": "5786",
    "note": "The day starts at sunset, not at midnight."
  },
  "upcomingHolidays": [
    { "name": "Rosh Hashanah", "dateLabel": "September 11", "startDate": "2026-09-11" },
    { "name": "Yom Kippur", "dateLabel": "September 20", "startDate": "2026-09-20" }
  ]
}
```

`localCalendar` may come back as `null`, and so may `localCalendar.note`. Only show
them when present.

---

### Errors

Not part of the original contract; added while building and still to be confirmed
before freezing. Every failure returns the same shape:

```json
{ "error": { "code": "INVALID_MEMBER", "message": "members[0].timezone is not a known IANA time zone: Mars/Olympus" } }
```

| Code             | HTTP | When                                            |
|------------------|------|-------------------------------------------------|
| `INVALID_BODY`   | 400  | Missing or malformed field                      |
| `INVALID_MEMBER` | 400  | A member with an invalid time zone or override  |
| `INVALID_RANGE`  | 400  | Inverted date range, or longer than 366 days    |
| `NOT_FOUND`      | 404  | Unknown route                                   |
| `INTERNAL`       | 500  | Unhandled error                                 |

Error messages address whoever is building a client, so they are not localized.

---

## 5. Calendar and holiday data

### Calendar systems

Use Node's `Intl.DateTimeFormat`, which already bundles full ICU. Example:

```js
new Intl.DateTimeFormat('en-u-ca-ethiopic', { dateStyle: 'long', timeZone: 'Africa/Addis_Ababa' })
  .format(new Date('2026-08-17T00:00:00Z'))
```

Always pass `timeZone`. Without it ICU formats in the process time zone and the date
shifts a day in any negative offset.

The systems available through CLDR:

```
buddhist, chinese, coptic, dangi, ethiopic, ethioaa, gregory, hebrew,
indian, islamic (+umalqura, civil, tbla, rgsa), japanese, persian, roc
```

Known gaps, **not to be implemented in v1**: Bikram Sambat (Nepal), Bengali, Julian,
Baháʼí, Amazigh, Burmese, Tibetan.

If a country uses a calendar outside ICU, return `localCalendar: null` and show only
the Gregorian one. Do not invent conversions.

### Holidays — precomputed, not queried at runtime

**Buy, do not maintain.** Keeping holidays for 50 countries by hand is a full-time
job.

But do not query them live either. The approach is:

1. A `scripts/build-holidays.ts` script that runs **once a year**.
2. It queries Nager.Date (free) or Calendarific (paid, wider coverage).
3. It generates one file per country: `data/holidays/IL.json`, `data/holidays/ET.json`,
   and so on.
4. Those JSON files **are committed to the repository**.
5. The server reads them from disk. Zero network calls at runtime.

Upsides: no latency, no external dependency in production, no risk of the third-party
API going down or changing its pricing, and the data ends up versioned in git — if a
holiday comes out wrong, it shows in the diff.

The script must fail loudly when a country returns empty, so it never generates a
silently incomplete JSON.

### Cities

Same approach. `scripts/build-locations.ts` downloads the GeoNames `cities15000` dump
(CC BY 4.0), keeps name, ASCII name, region, country and IANA time zone, and writes a
single committed `data/locations/cities.json`. Search is by prefix, accent-insensitive,
ranked by population.

The country name is not stored: it is resolved at runtime with `Intl.DisplayNames` in
the caller's locale.

Known limitation: search matches the local name and its transliteration, not exonyms.
"Londres" does not find London.

### Work weeks

A static table in the backend, not inferred:

| Region                                    | Working days   |
|-------------------------------------------|----------------|
| Majority                                  | Mon to Fri     |
| Israel                                    | Sun to Thu     |
| United Arab Emirates                      | Mon to Fri*    |
| Saudi Arabia, Kuwait, Qatar, Oman, etc.   | Sun to Thu     |
| Afghanistan, Iran                         | Sat to Thu     |
| Nepal                                     | Sun to Fri     |
| Brunei                                    | Mon to Thu, Sat|

\* The UAE changed in 2022; check that it still holds when implementing and leave the
source documented in the code.

Countries outside the table fall back to Mon to Fri, and that fallback is flagged as
inferred so the status layer never treats it as verified data.

### Known pitfalls (document them in the code)

1. **The day does not always start at midnight.** The Hebrew and Hijri calendars start
   at sunset. It affects when a holiday starts and ends.
2. **The Islamic calendar has four variants in ICU** and they do not agree with each
   other. Use `umalqura` by default. The religious one depends on actual moon
   sighting: no table is definitive. Document it.
3. **Chinese, Korean (dangi) and Vietnamese** are the same system with a different
   meridian. They can land on different days. Do not merge them.
4. **Time zones change.** Always use an up-to-date IANA database, never fixed offsets.

---

## 6. Design system — "Sol y Luna"

The palette is identical on both platforms. **The hex values do not change between iOS
and Android.** What changes is how they are applied (see section 8).

### Light theme

| Role                 | Hex       | Name      |
|----------------------|-----------|-----------|
| Action / primary     | `#4436C7` | Vesper    |
| Accent / alert       | `#E0A03A` | Meridian  |
| Primary text         | `#171634` | Nocturne  |
| Secondary text       | `#5B5C74` | Slate     |
| Borders / dividers   | `#E4E4EC` | Mist      |
| Background           | `#F7F7FA` | Paper     |
| Surface (cards)      | `#FFFFFF` | —         |

### Dark theme

| Role                 | Hex       |
|----------------------|-----------|
| Action / primary     | `#8B7DFF` |
| Accent / alert       | `#F0B455` |
| Primary text         | `#F2F2F7` |
| Secondary text       | `#9C9DB4` |
| Borders / dividers   | `#2A2947` |
| Background           | `#0F0E1C` |
| Surface (cards)      | `#1A1930` |

### Status colours

| Status          | Light (text)  | Light (bg)    | Dark (text)    | Dark (bg)      |
|-----------------|---------------|---------------|----------------|----------------|
| `AVAILABLE`     | `#17724E`     | `#E3F3EB`     | `#3DBE8B`      | `#12291F`      |
| `OFF_HOURS`     | `#9C9DB4`     | —             | `#6E6F87`      | —              |
| `LOCAL_WEEKEND` | `#8A5A0B`     | `#FBF0DC`     | `#F0B455`      | `#2A2216`      |
| `LOCAL_HOLIDAY` | `#8A5A0B`     | `#FBF0DC`     | `#F0B455`      | `#2A2216`      |
| `UNKNOWN`       | `#9C9DB4`     | —             | `#6E6F87`      | —              |

### Non-negotiable colour rules

1. **Meridian (`#E0A03A`) is never used as text on a light background.** It gives
   2.1:1 and is illegible. It goes in dots, fills, borders and indicators. For amber
   text on light, use `#8A5A0B`.
2. **Buttons filled with `#8B7DFF` (dark) carry dark text `#0E1420`**, not white.
   White on that violet gives 3.2:1 and does not pass AA.
3. In the dark theme, hierarchy comes from **surfaces**, not from shadows.
4. Every text and background pair must clear 4.5:1. Check any new combination.

### The hex values are identical on iOS and Android

There are not two palettes. What changes per platform is how the colours are applied
(shadow versus tonal fill, ripple versus opacity, corner radii), not their values.

Two expected nuances, which are **not** exceptions to the rule:

- **Android derives extra tones.** Material 3 generates its scheme from the `#4436C7`
  seed, so intermediate tones will exist that have no named equivalent on iOS. It is
  the same seed expanded into Android's role system. The brand and status colours are
  still the same values.
- **iOS glass alters perception.** Over the floating bar, a colour blends with
  whatever passes underneath and can look different than on an opaque card. That is
  expected and is not fixed with a different hex. It is precisely why glass is confined
  to the chrome: in content, where colour has to be faithful and contrast verifiable,
  everything is opaque.

### Scales

```
Spacing: 4, 8, 12, 16, 24, 32, 48
Radii:   iOS → 12-14    Android → 18-20    Pills → 999
```

### Typography

| Role      | Size   | Weight | Line height |
|-----------|--------|--------|-------------|
| display   | 46     | 700    | 52          |
| title     | 26     | 700    | 32          |
| heading   | 19     | 600    | 26          |
| body      | 15     | 400    | 22          |
| label     | 13     | 500    | 18          |
| caption   | 11     | 600    | 16 (tracking 1.6, uppercase) |

System typography on both platforms: SF Pro on iOS, Roboto on Android. No external
fonts in v1.

**Tabular figures are mandatory** for local times and counters. Without them the times
jitter as they refresh every minute.

---

## 7. Screens

Visual reference: `mockup-equipos.svg` (light theme, the three screens).
For dark theme treatment see `mockup-plataformas-v2.svg`.

### 7.1 Now (initial screen)

**Vertical structure:**

1. Title "Your team"
2. Subtitle with the counter: "2 of 6 available now"
3. Member list
4. Primary button "Find a time"
5. Navigation bar: Team · Dates · Settings

**Member row:**

```
[avatar+badge]  Name                        18:42
                City                     Weekend
```

- Avatar: a circle with initials. Background `#E7E5F8` with Vesper text; when the
  status is `AVAILABLE`, background `#E3F3EB` with green text.
- Status badge: a 4px circle with a 2px white ring, bottom right of the avatar.
- Local time: 17px semibold, tabular, right aligned.
- Status label: 12px, in the status colour, right aligned.

**Behaviour:**

- The local time refreshes every minute. **Refresh only the text**, do not reload the
  whole list or re-query the API every minute.
- Call `/availability` on screen open, on returning from the background, and on
  pull-to-refresh.
- List order: available first, then off hours, then weekend and holiday. Within each
  group, by name. The backend already returns them grouped by status.
- Tapping a row opens the detail.

**Empty state:** "Add your first teammate" with a button. No illustration.

---

### 7.2 Pick a date

**Vertical structure:**

1. Title "Pick a date"
2. Month header with navigation arrows
3. Month grid
4. Summary card for the selected date
5. Button "Show days without conflicts"
6. Text link "Schedule anyway"

**Grid:**

- The week starts on Monday.
- The **user's** weekend days in grey `#9C9DB4`.
- A day with conflicts: a Meridian dot of radius 2.5px, below the number.
- The selected day: a filled Vesper circle, number in white and bold.
- Past days dimmed and not selectable.

**Summary card** (background `#FBF0DC` when there are conflicts, `#E3F3EB` when there
are none):

- Date in long form, 15px bold.
- Counter: "3 of 6 unavailable", 13px semibold in `#8A5A0B`.
- Divider.
- One line per conflict: a Meridian dot plus the `detail` coming from the API.

**"Schedule anyway" has to exist.** If the app only blocks, people abandon it. The
product informs, it does not veto.

**No-conflict state:** the card turns green and reads "The whole team is available".

---

### 7.3 Member detail

**Vertical structure:**

1. Back button "Team"
2. Large avatar (48px) + name + "City, Country · UTC±N"
3. Local time in 46px display + long date on the right
4. Status banner (background in the status colour)
5. "WORK WEEK" section — label/value rows with dividers:
   - Working days
   - Weekend
   - Hours
   - Local calendar (e.g. "Hebrew · 5786") — hide when `null`
6. "UPCOMING HOLIDAYS" section — cards with name and date
7. Footnote in `#9C9DB4` when `localCalendar.note` exists
8. Secondary action: "Edit hours" (opens the overrides)

At most 3 upcoming holidays. When there are none, hide the whole section.

---

### 7.4 Cross-cutting states

**Loading:** skeletons shaped like the content, not centred spinners. The "Now" list
is the first thing the user sees on open.

**Network error:** show the last cached data with a discreet strip on top: "Data from
12 min ago · Retry". No full-screen error page when there is usable stale data.

**No data for a country:** status `UNKNOWN`, grey, with the caption "No holiday data".
Never invent, and never silently assume Monday to Friday.

---

## 8. Per-platform conventions

The colours are identical. Here is what **does** change:

### Android

- Jetpack Compose + Material 3.
- Generate the M3 scheme from the `#4436C7` seed with Material Theme Builder and map
  it onto the roles (`primary`, `onPrimary`, `primaryContainer`, `surfaceContainer*`,
  `outlineVariant`). Do not hardcode hex values in Composables.
- **Turn dynamic colour off explicitly.** Otherwise Material You repaints the violet
  according to the user's wallpaper.
- Cards: tonal fill, **no shadow**.
- Bottom bar: the M3 `NavigationBar`, with the pill indicator behind the active icon.
- Radii 18-20.
- Touch feedback: ripple.
- Status bar: set the colour and `barStyle` by hand.
- M3 state layers: 8% hover, 12% pressed.

### iOS

- SwiftUI. No UIKit unless it is unavoidable.
- Cards: white with a soft shadow (`y:2, blur:8, 10% opacity`).
- Standard `TabView`, active item tinted only, no pill.
- Radii 12-14.
- Touch feedback: opacity.
- Honour `Dynamic Type` — no fixed point sizes where the system expects scaling.
- Safe areas and the Dynamic Island are handled by the framework.

#### Liquid Glass (mandatory, not optional)

Since 28 April 2026 the App Store requires building against the iOS 26 SDK through
Xcode 26. Doing so means **the standard SwiftUI components adopt Liquid Glass
automatically**: navigation bar, `TabView`, buttons and sheets. No code.

**Do not use the `UIDesignRequiresCompatibility` flag.** It keeps the old UI, but
Apple ignores it when building against the iOS 27 SDK. For a new app it is debt from
day one.

**Design rule: glass in the chrome, opaque in the content.**

| Layer                                   | Treatment                   |
|-----------------------------------------|-----------------------------|
| Tab bar, navigation bar, sheets         | Liquid Glass (automatic)    |
| Member cards, status banners            | Opaque, no `.glassEffect()` |
| Calendar grid, data rows                | Opaque                      |
| Floating action button, if any          | `.glassEffect()`            |

The reason is twofold. Aesthetic: it is what Apple does — the floating layer is
translucent, the content is not. And functional: **glass is translucent, so the fixed
contrast ratios in section 6 stop being guaranteed** once something scrolls behind it.
Keeping content opaque is what makes accessibility verifiable.

For custom elements that do need to blend into the chrome, the API is
`.glassEffect()`, with `.regular` and `.clear` variants and chainable `.tint()` and
`.interactive()` modifiers.

**Mandatory testing before shipping:**

1. With "Reduce Transparency" enabled in Accessibility settings.
2. With "Increase Contrast" enabled.
3. Light and dark themes.
4. With content scrolling behind the tab bar — check the row text stays legible as it
   passes under the glass.

**Note:** an April 2027 deadline for adopting Liquid Glass circulates. It is not on
Apple's requirements page. The only real floor is the iOS 26 SDK. Do not plan around
that date.

**Consequence for store screenshots:** generate them after building against the new
SDK, not before. If they show the old chrome, the listing looks out of date on day one.

### What is never shared

Widgets (Glance / WidgetKit), extensions, system shortcuts. They are out of v1
regardless.

---

## 9. Order of work

**Phase 1 — Backend (finish before touching clients)**

0. Verify `Intl` with non-Gregorian calendars on the chosen runtime.
1. The `build-holidays.ts` script and the per-country JSON generation.
2. City search and time zone resolution.
3. The work week table.
4. Calendar conversion through `Intl`.
5. The four endpoints, with tests covering: Israel (Fri-Sat weekend), Nepal (5:45
   offset), Ethiopia (own calendar plus a holiday), and a country without data.
6. Freeze the contract.

**Phase 2 — Clients in parallel**

The same order on both platforms, so they can be compared:

1. Networking layer and models.
2. Local persistence of the team (see section 11).
3. "Now" screen.
4. Adding a member with city search.
5. "Detail" screen.
6. "Pick a date" screen.
7. Manual overrides.
8. Team export / import as JSON.
9. Dark theme and contrast verification.

**Phase 3 — Polish**

Empty, error and loading states. Accessibility. Icons and store screenshots.

---

## 10. Working rules for the assistant

1. **Do not put business logic in the UI.** Not in Composables, not in Views. If a
   component needs to decide whether somebody is available, the design is wrong: that
   value arrives resolved from the API.

2. **Do not duplicate logic between clients.** If you find yourself writing the same
   computation in Kotlin and in Swift, that computation belongs in the backend. Say so
   before writing it twice.

3. **Do not invent calendar or holiday data.** If a country is not covered, return
   `UNKNOWN`. Wrong data is worse than no data: people are going to schedule meetings
   based on this.

4. **Verify APIs against the official documentation**, especially Compose, Material 3
   and SwiftUI. Pin versions in the build files and do not move them without reason.

5. **Do not add dependencies without asking.** Every library is maintenance surface
   for a single person.

6. **Respect the scope in section 2.** If something looks like a good idea but is not
   listed, propose it, do not implement it.

7. **Every new colour needs a contrast check** against its background, in both themes,
   before being used.

8. **Define the boundaries between layers yourself, but ask before changing them.**
   The human decides the architecture; the implementation inside each layer is yours.

---

## 11. Local persistence

There are **two separate stores**. Do not mix them: they have different destinations.

### A. App preferences

Theme, language, the user's own working hours, first day of the week.

- Android: `DataStore`
- iOS: `UserDefaults` / `@AppStorage`

**They never sync.** They belong to the device and will never need a server.

### B. Team data

The member list. This is the only candidate for future sync, so it is stored as a
**syncable document** from day one:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-08-18T14:20:00Z",
  "members": [ /* array of members with UUIDs */ ]
}
```

- Android: a JSON file or `DataStore` with serialization, **not** loose
  SharedPreferences.
- iOS: a JSON file in Documents, **not** separate keys in UserDefaults.

Store the whole document, not individual fields. That is what makes a future migration
a matter of copying a JSON rather than a refactor.

### Export / import

Share and open the JSON document through the native share sheet. It covers roughly 80%
of the multi-device need (changing phones, backups) without a backend, auth or a
privacy policy.

---

## 12. Path to a shared database (do not build now)

**Decision: not built in v1.** The foundations are laid, and they cost almost nothing.

### When it would be worth it

- **Multi-device** — weak reason. Export/import already covers most of it.
- **Multiplayer** (each person declares their own hours and holidays) — strong reason,
  because it improves data quality: nobody knows better than Nadia that she takes
  Thursdays off. But it breaks the single-player model and requires everyone to
  install something.
- **Enterprise customers** — at that point it stops being optional, but that is a
  different product: accounts, roles and billing.

### What to do now so the door stays open

1. UUID v4 for every member ID. **Already in the contract, do not change it.**
2. Team state as a versioned document with `schemaVersion` and `updatedAt`.
3. Keep app preferences separate from team data.

With those three, adding Supabase later is a weekend of work: the local JSON becomes
rows and the stateless backend gains a data client. Without them, it is a refactor.

### Signal to reassess

Concrete requests from real users asking for sync. Do not build it before that signal.

---

## 13. Open decisions

These are unresolved and need to be settled before phase 2:

- **Holidays: inferred per country or declared per person?** Proposal: infer per
  country and allow manual correction per member. Inferring scales but gets things
  wrong; declaring is precise but nobody maintains their profile.
- **Default working hours.** Proposal: 9:00–18:00 local, editable. Implemented.
- **Language.** Spanish and English in v1, resolved from `Accept-Language` with
  Spanish as the fallback. Implemented. Since the status text comes from the backend,
  adding languages does not require shipping new apps.
- **Holiday provider.** Still open, but measured on 2026-08-29 against the 75 target
  countries:

  | Source | Covers | Misses | Notes |
  |---|---|---|---|
  | Nager.Date (current) | 57 | the 18 with non-standard work weeks | Free HTTP API |
  | `date-holidays` (npm, MIT) | 63 | QA KW OM JO IQ PS SY YE MV AF NP LB | Offline dataset, English names, no network at build time |
  | Google public ICS feeds | QA KW OM JO LB AF NP MV | PS | Free, no key, marks "Public holiday" vs "Observance"; most run to 2031, Nepal only to 2026 |

  `date-holidays` plus the ICS feeds leaves only Palestine uncovered. `date-holidays`
  covers Israel, Saudi Arabia, the UAE, Iran, India, Thailand, Malaysia, Pakistan and
  Brunei, which Nager.Date does not; it does not cover Iraq, Syria or Yemen, which
  Nager.Date does. Neither source alone is a superset of the other.

  The ICS feeds are an undocumented Google endpoint with no support commitment. Since
  the data is fetched once a year and committed, an outage would delay a regeneration
  rather than break production — but it is not a contract anybody owes us.

  Because the data is precomputed once a year, changing providers later is cheap: only
  the script changes, not the server.

---

## Summary of settled decisions

So that resolved discussions do not get reopened:

| Topic               | Decision                                          |
|---------------------|---------------------------------------------------|
| Platforms           | Native Android and iOS, in parallel               |
| Android             | Kotlin + Compose + Material 3                     |
| iOS                 | Swift + SwiftUI, iOS 26 SDK                       |
| Liquid Glass        | Yes. Glass in the chrome, content opaque          |
| Shared framework    | None. No KMP, no Flutter, no React Native         |
| Backend             | Node + Hono, stateless, no database               |
| Supabase            | Not in v1. Reassess in v1.1                       |
| Holidays            | Precomputed JSON committed to the repo            |
| Cities              | Precomputed GeoNames JSON committed to the repo   |
| Calendars           | Node's `Intl` (native ICU)                        |
| Persistence         | Local, versioned document with UUIDs              |
| Model               | Single-player. Nobody else installs anything      |
| Widgets             | Out of v1                                         |
| Accounts / login    | Out of v1                                         |
| Language of the code| English, including comments and commits           |
| Language of the UI  | Localized by the backend, Spanish and English     |
