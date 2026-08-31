# Contributing

One person maintains this. That shapes most of what follows: the rules exist to keep
the surface small, not to be thorough.

Before anything else, read `PLAN.md`. It settles scope, architecture and the API
contract, and most questions are already answered there. `CLAUDE.md` holds the working
rules in full; this file is the short version.

## Before you open a pull request

**`main` is never committed to directly.** Branch as `type/short-description`, using the
same types as the commit convention, in English and lower case:

```
feat/android-member-detail
fix/backend-nepal-offset
chore/data-2027-holidays
```

**One pull request per logical change.** Its title becomes the commit message: merges
are squashes and GitHub takes the title. Format `type(scope): description`, imperative
and lower case.

**Say what you verified, and what you did not.** The floor:

| Change            | Before opening                                           |
|-------------------|----------------------------------------------------------|
| Backend           | `npm test` and `npx tsc --noEmit` pass                   |
| Android           | `./gradlew testDebugUnitTest` and `assembleDebug` pass    |
| Android semantics | `./gradlew connectedDebugAndroidTest` — needs a device    |
| Anything visible  | Seen running on a device or emulator, not only compiled  |
| A new colour pair | Checked at 4.5:1 against its background, in both themes  |

The third row is the one that matters. A screen that compiles can still be unusable.

## Rules that do not bend

1. **Business logic lives in the backend.** The client never computes availability, time
   zones, holidays or calendar conversions. If a Composable or a View needs to decide
   whether somebody is available, the design is wrong.
2. **Do not invent calendar or holiday data.** A country without coverage answers
   `UNKNOWN`. Wrong data is worse than no data: people schedule meetings with this.
3. **Ask before adding a dependency that ships.** Anything that never reaches runtime —
   `devDependencies`, build scripts — goes in freely, with the reason in the commit.
4. **Respect the scope in section 2 of the plan.** Something not listed gets proposed,
   not implemented. There is an issue form for exactly that.

## Language

Code, comments, tests, commits and documentation are in English. Everything the end
user reads is localized by the backend from `Accept-Language`, and lives in
`backend/src/domain/i18n.ts` — never hardcoded at a call site.

The dividing line is the audience, not the file. `statusDetail` is product content and
gets localized. An `InputError` message addresses a developer and stays in English.

## Reporting a problem

Use the issue forms. The bug form asks for the country code and IANA time zone of the
member involved, and it means it: almost every bug here is a bug about one specific
country, and without those two fields it usually cannot be reproduced.

A wrong holiday or work week has its own form, because it is a different kind of
problem — it is fixed by changing a data source, not code.
