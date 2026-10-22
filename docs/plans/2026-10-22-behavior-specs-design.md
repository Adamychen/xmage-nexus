# Behaviour specs and usability checks

Date: 2026-10-22. Status: **Phase 1 implemented** (spec format, guard, 9 spec files with 97 rules);
phases 2 and 3 are pending in `ROADMAP.md` §4.12.

## 1. Problem

PR #24 fixed three usability failures that no layer of the suite could have caught: a library
search that covered the board with an invisible, once-only way to peek; a running entrance
animation that kept a "hidden" panel painted; and a decorative coin spinning over a prompt. Each
one broke a design decision that existed only in someone's head or deep inside a long cell of
`web/INTERACTION_COVERAGE.md` / `web/COMPONENT_PARITY.md`.

Two gaps follow:

1. **Decisions are not written down where they can be found and checked.** `docs/lessons.md`
   records why things broke, `docs/plans/` records how a piece of work was designed, the coverage
   matrices record what is tested. None of them states "this is how it must behave", so a change
   can revert a decision without anyone noticing it was one.
2. **Nothing checks usability as such.** The 233 gallery states (`web/src/dev/galleryFixtures.ts`)
   are only checked to mount without page errors; axe runs on the lobby and settings, not in game.

## 2. Design

### Phase 1 — behaviour specs (done)

- `docs/specs/<area>.md`, one file per area of the player's experience, not per component.
  Each decision is a numbered rule (`### DLG-6 · …`) with the behaviour, a verifiable `Why:`
  (commit, PR or lessons line) and a `Guard:` line listing the test files that hold it, or
  `none yet (…)`.
- Tests point at rules by title prefix (`it('DLG-2: …')`), so no code comments are needed.
- `web/src/specCoverage.test.ts` (unit layer) fails on a malformed spec, a test naming a rule that
  does not exist, a `Guard:` list that differs from the files whose tests carry the id, or a
  `none yet` rule that is in fact tested. Deleting the only test of a rule therefore fails a unit
  run that names the decision. Verified red both ways (a `none yet` on a guarded rule, a test
  naming an unknown id).
- Format, ownership and the split with lessons/plans/coverage: `docs/specs/README.md`.
- Rules describe current behaviour, verified against the code. Behaviour that looks like a bug is
  reported, not written down as a rule. An unguarded rule is kept: it says what the code is meant
  to do and where a test is missing.

Rejected alternatives:

- **Spec per component**: 293 `.tsx` files that are renamed and split often; an area outlives them.
- **Rule ids in code comments**: the project forbids comments; test titles already exist and are
  what a failure prints.
- **A free-form "design decisions" page**: without the guard it drifts like the coverage cells did.

### Phase 2 — deterministic usability checks over the gallery (pending)

A Playwright sweep that mounts every gallery state and asserts generic rules, each written as a
spec rule first:

- **Nothing covers the top layer**: every enabled control of the topmost dialog is hit-testable at
  its centre (`document.elementFromPoint`), with an explicit allow-list for informative overlays
  (DLG-7).
- **Decision context**: while a blocking prompt is open, the board, stack, life totals and source
  card are visible or one visible action away (DLG-6).
- **A visible way out**: every modal has a close/cancel or a visible peek hint.
- **Controls fit**: no clipped buttons, targets ≥ 24 px (WCAG 2.5.8), no truncated labels.
- **axe on game states**, not only on the lobby.
- A helper `expectVisuallyHidden(locator)` that checks opacity, `animation-name` and
  `visibility` together, since `getComputedStyle(opacity)` alone passed while the panel was
  painted.

New checks start with a baseline of known violations and fail only on new ones (the same ratchet
as `styleTokens.test.ts`).

A static guard for hold-a-modifier shortcuts (a `preventDefault` on keydown of Alt/Control/Meta
must be matched on keyup) covers the Windows-only failure no Linux CI browser reproduces. A
shortcut registry (where each shortcut applies and where the UI advertises it) follows from
`docs/specs/keyboard.md`.

### Phase 3 — exploratory usability agent (pending)

An agent with the Playwright MCP and the screenshot workflow from `AGENTS.md`, on demand or
nightly, never gating CI:

- per gallery state: screenshot plus a fixed checklist (Nielsen heuristics plus game questions:
  is it clear what is being asked and by which card, are the opponent's resources visible);
- per task: goals with a persona ("search your library for a Forest, but first check how many
  lands the opponent has"), which is how the PR #24 failure would have surfaced;
- output: a report with severity and screenshots under `.run/ux-review/`. A human triages; each
  confirmed finding becomes a spec rule and, where possible, a phase 2 check.

## 3. Order

Specs first (they define what is correct), then the phase 2 checks implement their generic
rules, then the agent explores against both. Areas without a spec are written the first time
someone changes them.
