# Bootstrapping from scratch

This document is used once, to create the structure. After that it stays as a
reference for project conventions.

---

## 1. Repository structure

**A monorepo.** One person, one shared API contract and three pieces that change
together: splitting them into three repositories multiplies the coordination without
giving anything back.

```
almanaq/
├── CLAUDE.md              standing instructions (root)
├── PLAN.md                full specification
├── SETUP.md               this file
├── README.md
├── .gitignore
├── design/
│   ├── tokens.json        single source of colour
│   ├── mockup-equipos.svg
│   ├── mockup-plataformas-v2.svg
│   └── paleta-sol-luna.svg
├── backend/               Node + Hono
├── android/               Android Studio project
└── ios/                   Xcode project
```

Identifiers:

- Android package: `com.phvillegas.almanaq`
- iOS bundle ID: `com.phvillegas.almanaq`

```bash
mkdir almanaq && cd almanaq
git init
mkdir design backend android ios
# copy CLAUDE.md, PLAN.md, SETUP.md to the root
# copy tokens.json and the .svg files to design/
```

---

## 2. Backend

Claude Code can create this whole piece. Base:

```bash
cd backend
npm init -y
npm i hono @hono/node-server
npm i -D typescript tsx vitest @types/node
npx tsc --init
```

`package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "vitest run",
    "build:holidays": "tsx scripts/build-holidays.ts",
    "build:locations": "tsx scripts/build-locations.ts"
  }
}
```

TypeScript 7 does not pick up `@types/node` from `moduleResolution: nodenext` alone.
Declare it explicitly in `tsconfig.json`:

```json
{ "compilerOptions": { "types": ["node"] } }
```

Target structure:

```
backend/
├── src/
│   ├── index.ts              Hono server, routes
│   ├── routes/
│   │   ├── availability.ts
│   │   ├── calendar.ts
│   │   ├── member.ts
│   │   ├── locations.ts
│   │   └── input.ts          shared request validation
│   ├── domain/
│   │   ├── workweek.ts       work week resolution and labels
│   │   ├── holidays.ts       reads data/holidays/*.json
│   │   ├── locations.ts      city search
│   │   ├── calendars.ts      conversion through Intl
│   │   ├── status.ts         status enum resolution
│   │   └── i18n.ts           user-facing message catalog
│   └── data/
│       ├── workweeks.ts
│       ├── holidays/         generated JSON, committed
│       └── locations/        generated JSON, committed
├── scripts/
│   ├── build-holidays.ts     run once a year
│   └── build-locations.ts
└── tests/
```

`routes/input.ts`, `domain/locations.ts` and `domain/i18n.ts` were added while
building. They are not part of the original plan; move them if you prefer another
layout.

### Check this first, before writing anything else

Run this on the chosen runtime. If it fails, the runtime is no good for this project:

```js
const d = new Date('2026-08-17T00:00:00Z');
for (const ca of ['hebrew', 'ethiopic', 'persian', 'islamic-umalqura']) {
  console.log(
    ca,
    new Intl.DateTimeFormat(`en-u-ca-${ca}`, { dateStyle: 'long', timeZone: 'UTC' }).format(d),
  );
}
```

It must print four distinct, correct dates. Standard Node supports them.

**Note the explicit `timeZone`.** Without it ICU formats in the process time zone, and
in any negative offset `new Date('2026-08-17')` — which is midnight UTC — renders as
the 16th. That off-by-one is the single most common source of wrong dates in this
codebase, which is why `domain/calendars.ts` never formats without a time zone.

---

## 3. Android

**Create the project from Android Studio, not with Claude Code.**

1. Android Studio → New Project → **Empty Activity** (with Compose).
2. Name: `Almanaq`. Package: `com.phvillegas.almanaq`.
3. Minimum SDK: **API 26** (Android 8.0). It covers virtually the whole install base
   and avoids needless compatibility work.
4. Build configuration language: **Kotlin DSL**.
5. Save under `almanaq/android`.

Target structure inside `app/src/main/java/com/almanaq/app/`:

```
├── MainActivity.kt
├── ui/
│   ├── theme/          Color.kt, Theme.kt, Type.kt
│   ├── team/           "Now" screen
│   ├── datepicker/     "Pick a date" screen
│   └── member/         "Detail" screen
├── data/
│   ├── api/
│   └── local/
└── model/
```

Then, with a valid project in place, Claude Code adds:

- Retrofit or Ktor client + kotlinx.serialization
- DataStore for persistence
- The Material 3 scheme generated from the `#4436C7` seed
- The Composables for the three screens

**Generate the colour scheme** in Material Theme Builder from the seed, export it as
`Color.kt` + `Theme.kt`, and check that the brand and status roles match
`design/tokens.json`. The seed generates derived tones; the brand and status colours
are not to be touched.

**Turn dynamic colour off explicitly** in the `MaterialTheme`.

---

## 4. iOS

**Create the project from Xcode, not with Claude Code.**

1. Xcode 26 → New Project → **App**.
2. Interface: **SwiftUI**. Language: **Swift**.
3. Name: `Almanaq`. Bundle ID: `com.phvillegas.almanaq`.
4. Minimum Deployment: **iOS 18** or higher depending on who you want to reach.
   Building against the iOS 26 SDK is mandatory; the deployment target is a separate
   decision.
5. Save under `almanaq/ios`.

Target structure inside `Almanaq/`:

```
├── AlmanaqApp.swift
├── Theme/          Color+Tokens.swift, Typography.swift
├── Features/
│   ├── Team/       "Now" screen
│   ├── DatePicker/ "Pick a date" screen
│   └── Member/     "Detail" screen
├── Data/
│   ├── API/
│   └── Local/
└── Models/
```

The screen folders use the same conceptual names as on Android, so progress on both
platforms can be compared at a glance.

Then Claude Code adds:

- A networking layer with `URLSession` and `Codable` (no external dependencies)
- Persistence in a JSON file in Documents
- `Color+Tokens.swift` derived from `design/tokens.json`
- The SwiftUI views for the three screens

**Confirm Liquid Glass is active:** the standard components must look translucent once
compiled. If they look like before, check that `UIDesignRequiresCompatibility` is not
in the Info.plist.

---

## 5. `.gitignore`

```gitignore
# Node
node_modules/
dist/
.env

# Android
android/.gradle/
android/build/
android/app/build/
android/local.properties
android/.idea/

# iOS
ios/build/
ios/DerivedData/
*.xcuserstate
ios/**/xcuserdata/

# System
.DS_Store
```

**Do not ignore** `backend/src/data/holidays/` or `backend/src/data/locations/`. Those
JSON files are committed on purpose.

---

## 6. Order of the first week

1. Create the folder structure and `git init`.
2. Copy the documents and the design assets.
3. Run the `Intl` check.
4. Backend: work week table and holiday script.
5. Backend: the four endpoints with tests.
6. **Freeze the API contract.**
7. Only then: create the Android Studio and Xcode projects.

Do not create the mobile projects before step 6. Having two apps waiting on a contract
that is still moving is the fastest way to duplicate rework.

---

## 7. Suggested first request to Claude Code

> Read CLAUDE.md and PLAN.md. We are starting with the backend.
>
> First, verify `Intl` support for non-Gregorian calendars on this Node.
> Then create the `backend/` structure per SETUP.md section 2, with the work week
> table from section 5 of the plan and the `build-holidays.ts` script.
>
> Do not implement the endpoints yet. I want to review the domain layer first.

Asking for the domain layer before the endpoints makes it possible to review the hard
decisions (calendars, holidays, work weeks) while the code is still small.
