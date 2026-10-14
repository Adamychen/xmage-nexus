# Enhancements — open client-only specs

> All ideas here are **client-only**: they read the existing JSON event flow and
> need no server or rules-engine change. The full historic catalog (built and
> dropped ideas with rationale) is archived in
> `docs/history/enhancements-catalog.md`; the live pending list is `ROADMAP.md`
> §4.2. One idea stays open (the draft pick helper) plus the replay-file follow-up of the rewind.

## 1. Board rewind (scrub the match by step)

Built 2026-10-15. Opt-in (`settings.boardRewind`, Settings → Gameplay). `game/rewind.ts`
is its own module store, separate from the live store: one snapshot per
`(turn, step)` (the latest view of that step replaces the earlier one), at most 40 per game,
in memory only, cleared on a new game, on a rollback past the snapshot's turn, or when the
setting goes off. `GameScreen` swaps the displayed `GameView` for the viewed snapshot and
disables board/dock pointer events plus Space and the skip keys while viewing; auto-pass and
attention alerts keep reading the live view, and live updates keep streaming behind it.
`RewindBar` (slider, arrows, Esc to return) is the only control.

Still open: persist the snapshots as a replay file (needs a per-turn delta, a `GAME_UPDATE`
is 200-800 KB), play it in the demo, and export a moment as an image.

## 2. Draft pick helper

Not started. Spec stays in `ROADMAP.md` §4.2 (High / ~2 d).

## Dropped, not deferred

Response window, blocked-action explainer, layer / derived P-T inspector —
specced on data that never reaches the client (`playableStats` empty in all
2 048 card views of the 119 recorded frames; `canPlayObjects` only sent to the
player holding priority; opponent hands never travel; illegal clicks silently
ignored; non-attachment continuous effects carry no source). Evidence and the
re-open condition in `ROADMAP.md` §4.2.
