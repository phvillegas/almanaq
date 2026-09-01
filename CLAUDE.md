# Almanaq

Availability app for distributed teams. It answers who on the team is actually
available right now, taking into account each person's local calendar: weekends that
are not Saturday and Sunday, national holidays, and observances that follow
non-Gregorian calendars.

A monorepo with three pieces: a Node backend, a native Android client, a native iOS
client.

## Before writing code

Read `PLAN.md`. It holds the scope, the architecture, the API contract, the design
system and the screen specifications. **Do not start without having read it end to
end.**

`SETUP.md` has the folder structure, the bootstrap for each piece, and the order of
the first week.

The canonical colour values live in `design/tokens.json`. Do not copy hex values out
of the markdown or the SVGs: read them from there.

**The Material 3 roles in that file are generated**, from the `#4436C7` seed, by
`backend/scripts/build-theme.ts`. Do not hand-edit the `material3` block or the Android
`Material3Colors.kt` it emits — change the seed and run `npm run build:theme`, which
rewrites both and refuses to write if any status colour drops below 4.5:1.

Visual references in `design/`:

| File                          | What it shows                                   |
|-------------------------------|-------------------------------------------------|
| `mockup-equipos.svg`          | The three screens, light theme                  |
| `mockup-plataformas-v2.svg`   | iOS and Android, light and dark, Liquid Glass   |
| `paleta-sol-luna.svg`         | Full palette and status colour coding           |

## Language

**Everything that is engineering artefact is in English**: source code, identifiers,
comments, commit messages, documentation, test names, error messages aimed at whoever
builds a client.

**Everything the end user reads is localized.** Status text, country names, dates and
calendar labels are resolved by the backend in the locale the client asks for through
`Accept-Language`. They live in `backend/src/domain/i18n.ts`, never hardcoded at a
call site. Spanish and English ship in v1; Spanish is the fallback.

The dividing line is the audience, not the file. `statusDetail` is product content and
gets localized. An `InputError` message addresses a developer and stays in English.

## Rules that do not bend

1. **Business logic lives in the backend.** The client never computes availability,
   time zones, holidays or calendar conversions. It asks and it paints.

2. **If you find yourself writing the same computation in Kotlin and in Swift, stop.**
   That computation belongs in the backend. Say so before duplicating it.

3. **Do not invent calendar or holiday data.** A country without coverage returns
   `UNKNOWN`. Wrong data is worse than no data: people schedule meetings with this.

4. **Member IDs are UUID v4.** Never auto-incrementing. This is what enables a future
   migration to a shared database (see section 12 of the plan).

5. **Ask before adding a dependency that ships.** Anything compiled into the backend
   or into a client is a maintenance surface for one person, so it gets asked about.
   Dependencies that never reach runtime — `devDependencies`, build scripts, anything
   whose output is a committed artefact — go in without asking, with the reason stated
   in the commit.

6. **Respect the scope in section 2 of the plan.** If something looks like a good idea
   but is not listed, propose it, do not implement it.

7. **Every new colour combination is checked at 4.5:1** against its background, in
   both themes, before being used.

8. **The human decides the architecture.** You may propose structural changes; do not
   apply them without confirmation.

## Code style

- **No `else` and no nested `if`.** Use guard clauses and early returns; extract a
  function when a branch needs its own branches. A `switch` or a lookup table beats a
  chain of conditions. `if` inside a loop is fine; `if` inside `if` is not.
- Ternaries are allowed for a single expression, not for control flow.
- Comments explain why, not what. The what is already in the code.
- Document every external data source (work weeks, holidays) with a link and the date
  it was checked.
- **Relative imports, no path aliases.** The tree is flat enough that nothing goes
  deeper than one `../`. Node subpath imports (`#domain/*` in `package.json`) do work
  here, and `paths` in `tsconfig.json` does not — TypeScript will not rewrite the
  emitted specifiers, so `node dist/index.js` breaks without an extra dependency. The
  reason to stay with relative imports is the failure mode: subpath imports need
  `--conditions development` on every dev entry point, and without it Node resolves to
  `./dist/`, silently running yesterday's compiled build instead of the source.
  Revisit if a third folder level appears and `../../` starts showing up.

## Stack (settled, not up for discussion)

| Area          | Decision                                             |
|---------------|------------------------------------------------------|
| Backend       | Node + Hono + TypeScript. No database, no auth, no state |
| Android       | Kotlin + Jetpack Compose + Material 3                |
| iOS           | Swift + SwiftUI, iOS 26 SDK, Liquid Glass            |
| Shared        | Nothing. No KMP, no Flutter, no React Native         |
| Holidays      | Precomputed committed JSON, not a runtime API        |
| Cities        | Precomputed committed JSON from GeoNames             |
| Calendars     | Node's `Intl` (native ICU)                           |
| Persistence   | Local. A versioned document with UUIDs               |

## Order of work

**The backend is finished and frozen before touching any client.** With two apps in
flight, a contract that keeps moving doubles the rework.

After that, both clients in parallel following the same screen order, so they can be
compared.

## Project status

The backend is built: domain layer, the four endpoints, precomputed data and tests.

**The contract is frozen** as of 2026-08-29: the four endpoints in section 4 of the
plan, the error shape, and the `status` enum. Changing any of them from here on is a
decision the human makes, not a refactor.

What is still open is holiday coverage, which changes what the endpoints answer, not
what they answer with. See section 13 of the plan.

The iOS (`.xcodeproj`) project **is created by the human** with the Xcode wizard. Do
not try to generate it.

The Android project was written by hand on 2026-08-29 and rebased onto a wizard
baseline on 2026-08-31: the build files are the ones Android Studio generates, with our
plugins, dependencies and comments added on top. Keeping the wizard's shape means a
future regeneration diffs cleanly instead of being reconciled by hand.

**Android v1 is complete** as of 2026-08-31: every screen in section 7 of the plan, the
per-minute clock, the conflict-free day view, loading and stale states, the launcher
icon, and tests. What is left is listed under "Not done yet" in the README, and the only
large item there is iOS.

The client computes exactly four things for itself — the ticking clock from the offset
the backend resolved, the `UTC±N` label, the phone owner's own weekend from ICU, and the
search for the first day with no conflicts. That list is the whole surface rule 1 allows.
Before adding a fifth, say why the backend cannot answer it.

Two constraints are worth knowing before touching versions:

- AGP 9.3.2 requires Gradle 9.5.0 or newer.
- AGP 9 ships Kotlin support built in and **fails** if the
  `org.jetbrains.kotlin.android` plugin is applied. The wizard does not declare it
  either; only `org.jetbrains.kotlin.plugin.compose` and `.plugin.serialization` are.

Library versions in `android/gradle/libs.versions.toml` are ours and newer than the
wizard defaults, verified by a build and a run on a device. Do not bump them without
running a build.

## Commands

From `backend/`:

```
npm run dev              # local server
npm test                 # tests
npm run build            # compile to dist/
npm run build:holidays   # regenerates data/holidays/*.json (once a year)
npm run build:locations  # regenerates data/locations/cities.json
npm run build:theme      # regenerates the colour scheme from the #4436C7 seed
```

From `android/`:

```
./gradlew assembleDebug              # builds the APK
./gradlew installDebug               # installs on the connected device or emulator
./gradlew testDebugUnitTest          # unit tests, run in CI
./gradlew connectedDebugAndroidTest  # semantics tests, need a device, not in CI
```

## Conventions

- **Semantic commits, in English and in the imperative.** Format
  `type(scope): description`, description in lower case and without a trailing period:

  ```
  feat(backend): add availability endpoint
  fix(android): correct the member list ordering
  docs: define the commit message convention
  ```

  | Type       | When                                                   |
  |------------|--------------------------------------------------------|
  | `feat`     | new functionality                                      |
  | `fix`      | bug fix                                                |
  | `docs`     | documentation, including the `.md` files at the root   |
  | `test`     | tests, without touching production code                |
  | `refactor` | internal change that does not alter behaviour          |
  | `style`    | formatting, no behaviour change                        |
  | `chore`    | dependencies, configuration, maintenance scripts       |

  The scope is optional and separates the monorepo pieces: `backend`, `android`,
  `ios`, `design`. The yearly regeneration of holidays or cities goes as
  `chore(data): regenerate 2027 holidays`.

  The body, when one is needed, explains the why rather than the what: the what is
  already in the diff.

- **Branches and pull requests.** `main` is never committed to directly. Every change
  goes on a branch named `type/short-description`, using the same types as the commit
  convention, in English and lower case with hyphens:

  ```
  feat/android-member-detail
  fix/backend-nepal-offset
  chore/data-2027-holidays
  ```

  The scope goes inside the description, not as a second slash: `feat/android-...`,
  never `feat/android/...`.

- **One pull request per logical change.** The pull request title is the commit message
  that will land: merges are squashes, and GitHub takes the title.

- **Squash merge only.** Merge commits are disabled on the repository and the branch is
  deleted on merge, so neither needs to be done by hand.

- **A pull request states what was verified, and what was not.** The floor:

  | Change            | Before opening the pull request                          |
  |-------------------|----------------------------------------------------------|
  | Backend           | `npm test` and `npx tsc --noEmit` pass                   |
  | Android           | `./gradlew testDebugUnitTest` and `assembleDebug` pass    |
  | Android semantics | `./gradlew connectedDebugAndroidTest` — needs a device    |
  | Anything visible  | Seen running on a device or emulator, not only compiled  |

  The last row is not ceremony. A screen that compiles can still be unusable: the first
  version of the "Now" screen rendered its empty state as a bare dash, which on a phone
  read as a broken dark screen. It compiled, and it had previews.

- User-visible text is returned by the backend already written and localized
  (`statusLabel`, `statusDetail`). The client does not compose it.
