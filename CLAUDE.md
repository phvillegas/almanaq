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

5. **Do not add dependencies without asking.** One person maintains this.

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
**The contract is not frozen yet.**

The Android (Gradle) and iOS (`.xcodeproj`) projects **are created by the human** with
the Android Studio and Xcode wizards. Do not try to generate them: they are structures
of dozens of interdependent files that reconstruct badly by hand.

## Commands

From `backend/`:

```
npm run dev              # local server
npm test                 # tests
npm run build            # compile to dist/
npm run build:holidays   # regenerates data/holidays/*.json (once a year)
npm run build:locations  # regenerates data/locations/cities.json
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

- User-visible text is returned by the backend already written and localized
  (`statusLabel`, `statusDetail`). The client does not compose it.
