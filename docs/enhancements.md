# Enhancements — open client-only specs

> All ideas here are **client-only**: they read the existing JSON event flow and
> need no server or rules-engine change. The full historic catalog (built and
> dropped ideas with rationale) is archived in
> `docs/history/enhancements-catalog.md`; the live pending list is `ROADMAP.md`
> §4.2. Two ideas stay open.

## 1. Board rewind (scrub the match by turn)

**Constraint: no optimistic state** (`ROADMAP.md` §6 rule 1). Rewind is a read
mode over *recorded* views with its own store slice, never a mutated live
store: entering rewind must not leave an action sendable against a past state.

- **What**: opt-in ring keeping the views the game received, so you can scrub
  back to any earlier turn and read the board as it was — for reviewing a line,
  screenshotting a moment, and as the substrate for a future replay file.
- **Data**: everything already in `GAME_UPDATE`; `web/src/net/frameBuffer.ts`
  is the hook, but it is bounded for diagnostics (60 frames, whole frames only
  up to 8 KB shipped / 64 KB dev) while a `GAME_UPDATE` is 200-800 KB, so this
  needs its own capture: a per-turn snapshot per game, or a delta against the
  previous one, kept out of the diagnostics bundle.
- **Shape**: separate read mode (own store slice), disabled against a live
  opponent by default; the live game keeps streaming behind it and any input
  exits rewind first.
- **Verify**: unit tests on the capture/derivation (no browser), then replay
  two recorded frames as turns 5 and 12 of one game and assert rewind paints
  both.

## 2. Draft pick helper

Not started. Spec stays in `ROADMAP.md` §4.2 (High / ~2 d).

## Dropped, not deferred

Response window, blocked-action explainer, layer / derived P-T inspector —
specced on data that never reaches the client (`playableStats` empty in all
2 048 card views of the 119 recorded frames; `canPlayObjects` only sent to the
player holding priority; opponent hands never travel; illegal clicks silently
ignored; non-attachment continuous effects carry no source). Evidence and the
re-open condition in `ROADMAP.md` §4.2.
