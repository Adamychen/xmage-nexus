# Enhancements — open client-only specs

> All ideas here are **client-only**: they read the existing JSON event flow and
> need no server or rules-engine change. The full historic catalog (built and
> dropped ideas with rationale) is archived in
> `docs/history/enhancements-catalog.md`; the live pending list is `ROADMAP.md`
> §4.2. Only the replay-file follow-up of the rewind stays open.

## 1. Board rewind (scrub the match by step)

Built 2026-10-15. Opt-in (`settings.boardRewind`, Settings → Gameplay). `game/rewind.ts`
is its own module store, separate from the live store: one snapshot per
`(turn, step)` (the latest view of that step replaces the earlier one), at most 40 per game,
in memory only, cleared on a new game, on a rollback past the snapshot's turn, or when the
setting goes off. `GameScreen` swaps the displayed `GameView` for the viewed snapshot and
disables board/dock pointer events plus Space and the skip keys while viewing; auto-pass and
attention alerts keep reading the live view, and live updates keep streaming behind it.
`RewindBar` (slider, arrows, Esc to return) is the only control.

Replay file (2026-10-15): **Save replay** in the bar downloads the snapshots as
`nexus-replay_*.json.gz` (`game/replayFile.ts`); **Open replay file** in Lobby → History loads it
with no server connection (`startReplay` puts the last snapshot in the store with `gameId: null`,
`RewindBar` is then always open and its Close button leaves the replay). Files are validated
(`parseReplayFile`: format, version, at most 40 unique-key snapshots). Still open: a per-turn delta
to shrink files (a `GAME_UPDATE` is 200-800 KB), loading a replay in the demo, and exporting a
moment as an image.

## 2. Draft pick helper

Built 2026-10-15. `game/draftAdvisor.ts` scores the cards of the current booster against the
pool so far (rarity prior, colour fit once the pool is committed to two colours, the creature
curve slot it fills, a creature-count nudge, basic lands last) and `DraftHelper` shows the top
three with their reasons. It is a client-side heuristic over Scryfall metadata the screen already
loads: nothing is sent, nothing is picked for the player, and it can be hidden (remembered).
Open: ratings per set (17Lands-style win-rate data) would need an external source.

## Dropped, not deferred

Response window, blocked-action explainer, layer / derived P-T inspector —
specced on data that never reaches the client (`playableStats` empty in all
2 048 card views of the 119 recorded frames; `canPlayObjects` only sent to the
player holding priority; opponent hands never travel; illegal clicks silently
ignored; non-attachment continuous effects carry no source). Evidence and the
re-open condition in `ROADMAP.md` §4.2.
