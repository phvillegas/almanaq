<!--
  The title of this pull request becomes the commit message: merges are squashes and
  GitHub takes the title. Write it as `type(scope): description`, in the imperative and
  lower case, per CLAUDE.md.
-->

## What changed

<!-- One or two sentences. The diff already says the what in detail; say the shape. -->

## Why

<!-- The reason, not the mechanics. If it fixes something, what was broken. -->

## Verified

<!--
  Tick what you actually ran. An unticked box is information, not a failure: say what
  you skipped and why, right here, rather than leaving the reviewer to guess.
-->

- [ ] `npm test` and `npx tsc --noEmit` pass — *backend changes*
- [ ] `./gradlew assembleDebug` passes — *Android changes*
- [ ] Seen running on a device or emulator — *anything with a visible surface*
- [ ] Contrast checked at 4.5:1 in both themes — *any new colour pair*

**Not verified:**

<!-- Say it plainly. "Nothing" is a valid answer. -->

## Notes for the reviewer

<!--
  Optional. Decisions taken, alternatives discarded, anything that will look odd in the
  diff without context. Delete the section if there is nothing.
-->
