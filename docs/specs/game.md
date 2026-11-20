# The game session

Prefix: `GME`

The life of one game from the first view to the way out of it: the end of a match
(`web/src/game/GameEndDialog.tsx`), being eliminated while the pod goes on
(`EliminatedDialog.tsx`), the game menu's exit (`GameMenu.tsx`) and the state that decides when a
match is over (`web/src/state/events/game.ts`, `web/src/state/gameUtils.ts`).
How the board is drawn is `board.md` (BRD-3 to BRD-31), the side panel is `panel.md`, and how a
dialog opens, stacks and closes is `dialogs.md` (DLG-1 to DLG-4).

### GME-1 · A game nobody else is left in is over, so leaving it is not conceding
When every other player has left the game (they conceded, lost on life or poison, quit the match or
ran out of time) the client treats the match as finished: the end-of-game dialog offers returning to
the lobby, and the game menu's leave item leaves without conceding and without the concession
confirmation, because there is nobody left to concede to. The client also leaves the board by itself
when the server's end-of-game report arrives for such a game, instead of holding a dead board whose
only way out is a concession.

- Why: report of 2026-11-13 (app 0.8.0): in a duel the opponent conceded, lost the game and quit the
  match, and the player was left on the board with no exit but conceding the match ("No way for me to
  leave without conceding"). The end-of-game dialog judged the match to be running from the server's
  "You need one more win to win the match." text, which is what it says whenever no match player has
  reached the wins needed; an opponent quitting is not a win for the match counter.
- Guard: `src/state/events/game.test.ts` · `src/game/GameEndDialog.test.tsx` · `src/game/GameMenu.test.tsx`
