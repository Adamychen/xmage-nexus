# Tournaments

Prefix: `TRN`

Creating a tournament, watching its bracket from the lobby, and following it during a game. Creating
a regular match is in `lobby.md` (LBY); joining a tournament table is LBY-7 and opening its bracket from
the lobby is LBY-8.

The server's strings are the source of truth. Formats verified in the fork (1.4.62):

| Field | What the server sends |
|---|---|
| `TournamentView.tournamentType` | the options' type, plus ` / <deck type>` when constructed, plus ` N rounds` when `numberRounds > 0` (`Constructed Swiss / Constructed - Modern 3 rounds`) |
| `TournamentView.tournamentState` | `TableState.toString()`: `Waiting for players`, `Drafting`, `Constructing`, `Dueling`, `Finished`, … |
| `RoundView.games[]` | one `TournamentGameView` per **game** (not per match): every finished game of the match, then the running one |
| `TournamentGameView.players` | `alice - bob` |
| `TournamentGameView.state` | `Dueling (8:14)` / `Finished (12:30)` (duration optional) |
| `TournamentGameView.result` | `Player alice is the winner` / `Game is a draw` / empty while running |
| `TournamentPlayerView.points` | 3 per match won, 1 per match drawn, 3 per bye |
| `TournamentPlayerView.results` | `R1 chen [2-0] R2 dara [1-2Q] R3 Bye ` (opponent, own wins, opponent wins; `Q`/`T`/`I` = quit, timer, idle; a third number = draws) |
| `TournamentPlayerView.state` | `TournamentPlayerState.toString()` (`Constructing`, `Waiting for next round`, `Dueling`, `Eliminated`, `Finished`, …) plus ` (<info>)` and a disconnect suffix |
| `TournamentPlayerView.history` | the player's **profile** history (`Matches: 41 (2%), Tourneys: 6 (0%), Constructed Rating: …`), not this tournament's |

## Creating a tournament

### TRN-1 · A tournament is created in three steps with a summary that is always visible
Creating a tournament has three steps: Format, Rules and Seats (plus a collapsed developer section
inside Seats in dev builds). Beside the steps, a "Your tournament" summary is always visible and updates
as the player edits: the name, the format in words, the phases the tournament will go through (draft
or sealed or jumpstart or registration, then construction for limited, then the rounds, then the final
standings or the champion) and the key facts (seats, rounds, clock, access, rated). There is no
separate review step, and the footer has one primary action: "Next" on the first two steps, "Create
tournament" on the last. Each step tab shows a one-line summary of its choices. Creating a regular
match keeps its own wizard (LBY).

- Why: the old wizard had 7 steps (Dev and Review included) for one task, two competing primary actions
  from step 1, and a Review page of ~30 rows that never said how the tournament would run.
- Guard: `src/lobby/CreateTable/constants.test.ts` · `src/lobby/CreateTable/tourneyFormat.test.ts` · `src/lobby/CreateTableDialog.test.tsx`

### TRN-2 · The tournament type is chosen as modality × pairing × packs, and maps to one server type
The player picks a modality (Booster Draft, Sealed, Jumpstart, Constructed), a pairing (Swiss,
Elimination) and, for limited modalities, the packs (set boosters, Cube, Random, Reshuffled, Rich Man,
Rich Man Cube for draft; set boosters or Cube for sealed; standard or custom list for Jumpstart). These
three choices compose exactly one server type name (`Booster Draft Swiss (Cube)`), shown under the
choices, and every server name parses back into the three choices. A combination the server does not
list (in its `tournamentTypes` catalogue) is disabled with a tooltip saying why, never hidden silently,
and the form never sends a name the server did not list.

- Why: one flat select of ~20 server names mixed three decisions, and its label said "Limited — Draft /
  Sealed" even for constructed types.
- Guard: `src/lobby/CreateTable/TourneyFormatStep.test.tsx` · `src/lobby/CreateTable/tourneyFormat.test.ts` · `src/lobby/tournament/tournamentType.test.ts`

### TRN-3 · A Swiss tournament plays between 2 and 10 rounds, and the recommended count is preselected
A Swiss tournament shows the round count as a choice from 2 to 10, with the recommended count marked
and preselected: `ceil(log2(seats))`, at least 2. Changing the seats moves the selection to the new
recommendation unless the player picked a count by hand. An Elimination tournament shows its derived
rounds (`log2(seats)`: quarterfinal → semifinal → final) as read-only text and sends no round count.
The form never sends `numberRounds: 0` for Swiss.

- Why: the field said "0 = auto", but `TournamentSwiss` plays rounds only while
  `numberRounds > rounds.size()`, so 0 plays no round at all; the desktop client's spinner is 2–10.
- Guard: `src/lobby/CreateTable/TourneyFormatStep.test.tsx` · `src/lobby/CreateTable/submitTable.test.ts` · `src/lobby/CreateTable/tableKind.test.ts` · `src/lobby/CreateTable/useCreateTableForm.test.ts` · `src/lobby/tournament/tournamentType.test.ts`

### TRN-4 · Seats follow the server's limits for the type, and a new tournament starts with 8
The seat count is any number between the selected type's `minPlayers` and `maxPlayers`, read from the
server's tournament type catalogue (`getTournamentTypes` sends them per type); quick picks 4, 8 and 16
are offered when they fall inside those limits, and other counts are reachable with a stepper. When
the catalogue gives no limits the client assumes 2–16. A new tournament starts at 8 (clamped into the
limits), changing the type clamps the count into its limits, and presets keep their own seat count.

- Why: the old default of 2 seats made a tournament that is a single match. The client offered 32
  seats although every tournament type of the server allows at most 16, and capped every draft at 8
  although the draft types allow 16 (booster draft needs at least 4).
- Guard: `src/lobby/CreateTable/TourneyFormatStep.test.tsx` · `src/lobby/CreateTable/useCreateTableForm.test.ts` · `src/lobby/CreateTable/tableKind.test.ts` · `src/net/commands.test.ts` · `e2e/wizard.spec.ts`

### TRN-5 · A limited tournament never asks for a deck
In a draft, sealed or jumpstart tournament the Seats step shows no deck picker for the host or for bots,
and the host's seat is taken without a deck, as any other limited join (LBY-7). The deck pickers (the
host's and the bots') only appear for a constructed tournament.

- Why: the Seats step showed the host's constructed deck ("Mage Web bolt") for a draft, a deck that is
  never used.
- Guard: `src/lobby/CreateTableDialog.test.tsx` · `src/lobby/CreateTable/submitTable.test.ts` · `src/lobby/CreateTable/TourneySeatsStep.test.tsx`

### TRN-6 · Tournament seats are a list, not a table
The Seats step lists every seat in rows (the host first when they play, then each other seat as an open
human seat or a bot, with the bot's skill), with "All open" and "Fill with bots" shortcuts and a counter
("You · 5 open · 2 bots"). In a limited tournament every seat is human: the bot choice and "Fill with
bots" are disabled with the reason written next to them, so the form can no longer reach the
`draft_bots_no_submit` error. A tournament never shows the per-match player limit of the game type as a
warning, and the seat panel never shows help text of another field.

- Why: the table ellipse overlapped its cards from 8 seats on, the chip "Config: 8 / 2 max" warned about
  the match limit of Two Player Duel, and the player panel showed the draft-timing help. Bots in a
  limited tournament never submit a built deck, so it never reaches its rounds; the old form let the
  player pick them and only refused at submit.
- Guard: `e2e/wizard.spec.ts` · `src/lobby/CreateTableDialog.test.tsx` · `src/lobby/CreateTable/TourneySeatsStep.test.tsx` · `src/lobby/CreateTable/useCreateTableForm.test.ts`

### TRN-7 · Draft sets are one slot per booster, filled from a popular set or by code
For set boosters, the Format step shows one slot per booster (3 or 6). Picking a popular set fills every
slot; each slot can be changed on its own; typing codes stays available behind "Type codes…". Repeated
sets read as `M21 ×3`, never as `M21, M21, M21`.

- Why: popular chips, a search plus select and a free-text field were three controls for one value.
- Guard: `src/lobby/CreateTable/TourneyFormatStep.test.tsx` · `src/lobby/CreateTable/tourneyFormat.test.ts`

### TRN-8 · The Rules step offers only what the server applies to a tournament, grouped
The Rules step groups the fields into Matches (best of, clock per player, buffer), Draft and
construction (pick time, construction time, single game, shown for limited only, with single game
saying it overrides "best of"), Access (password, minimum rating, quit ratio, skill level, rated,
spectators, banned players) and a collapsed Advanced section (game type for constructed, rollback). It
offers no field the proxy does not apply to a tournament: free mulligans, mulligan type, starting life and
hand, Planechase, attack/range and EDH power are not shown for tournaments (the desktop client's tournament
dialog does not offer them either), and any other field is shown only if
`MatchOptionsParser.parseTournamentOptions` reads it. Every field that is shown is sent and applied.

- Why: the redesign of 2026-10-29 moved every field; this rule keeps the move from dropping one. The
  old wizard showed free mulligans, mulligan type, starting life and hand, Planechase, attack/range and
  EDH power for tournaments, but only `parseMatchOptions` reads them, so a player's choice was silently
  ignored. Banned players are read through `applyMatchOptions` and applied by `TableController` to the
  tournament table, so they stay.
- Guard: `src/lobby/CreateTableDialog.test.tsx`

## The bracket

### TRN-10 · The bracket shows one card per match, built from the games the server sends
Games of a round are grouped into matches (by `matchId`, else `tableId`, else round + players). A match
card shows each player on their own row with the games they won, the winner highlighted once the match
is over, the game progress (one mark per game of the match, the running one live), and a status line
("Game 2 in progress · 8:14" / "Finished 2–1"). A live match the viewer may watch has a labelled "Watch"
button. No card shows the table id or repeats the round number.

- Why: `RoundView` sends one entry per game, so a best-of-three showed up two or three times and no card
  gave the match score; every card also showed "Create Table table-…" because the table-id label
  reused the create-table translation.
- Guard: `src/lobby/TournamentBracket.test.tsx` · `src/lobby/tournament/matches.test.ts` · `e2e/tournament.spec.ts`

### TRN-11 · Server strings are parsed, and shown verbatim when they do not parse
The client reads the formats in the table above (players, game state and duration, game result,
player results, player state, total rounds inside the type) into structured data. A string that does not
match its format is shown as the server sent it rather than dropped or shown empty. Test fixtures use
the real formats.

- Why: the bracket painted raw strings ("R1 bob [2-0] R2 …" in one cell), and the gallery and FakeServer
  data used `vs`, `2-0` and 1.5 points, formats the server never sends, so the UI was designed against
  data that does not exist.
- Guard: `src/lobby/TournamentBracket.test.tsx` · `src/lobby/tournament/parse.test.ts`

### TRN-12 · A participant sees their own match and standing first
When the viewer plays in the tournament, the bracket opens with a "Your match" card: the current round,
the opponent, the match score and game progress, and the viewer's position and points; between rounds it
says what the player is waiting for. A spectator sees no such card and no quit action. The viewer's rows
are marked "you" in matches and standings.

- Why: nothing told a player where they stood; they had to find their own name in the list.
- Guard: `src/lobby/TournamentBracket.test.tsx` · `src/lobby/tournament/matches.test.ts`

### TRN-13 · Rounds are tabs, and an elimination tournament is drawn as a tree
In a Swiss tournament each round is a tab ("Round 2 · 1 of 4 finished"), the latest round is selected
when the bracket opens, and when the total is known (TRN-11) the rounds not yet paired are tabs that say
why they are empty. In an elimination tournament the rounds are columns of a tree (quarterfinal,
semifinal, final) joined by connectors, each match feeding the one its winner plays next, with the
champion at the end.

- Why: both pairings were drawn as fixed 220 px columns that scrolled sideways while space was left, and
  an elimination tournament had no tree.
- Guard: `src/lobby/TournamentBracket.test.tsx` · `src/lobby/TournamentEliminationTree.test.tsx` · `src/lobby/tournament/matches.test.ts` · `src/lobby/tournament/tournamentType.test.ts` · `e2e/tournament-bracket.spec.ts`

### TRN-14 · Standings show points, a mark per round and a short state
The standings list rank, player (flag drawn, not its file name; "you" mark), points, one mark per round
(win, loss, draw, bye, still playing) with the opponent and score on hover, and a short state with a
colour dot. A player who quit is struck through with "quit" on the same line. The player's profile
history moves to a card shown on hover or focus of the name. Rows are ordered by points, keeping the
server's order on ties.

- Why: the table clipped its History column, wrapped "Dueling" onto two lines, showed the flag as text
  and printed the results string raw; that History was the profile's, not the tournament's.
- Guard: `e2e/tournament.spec.ts` · `src/lobby/TournamentBracket.test.tsx` · `src/lobby/tournament/matches.test.ts` · `src/lobby/tournament/parse.test.ts`

### TRN-15 · The header names the tournament once and labels every time
The tournament name appears once. The header shows the type in words, the phase, "Round N started
m:ss ago" (from `stepStartTime`), the start time, the player count and whether spectators are allowed.
The construction countdown appears only while constructing. The bracket refreshes itself and says
"Updated N s ago" next to a manual refresh icon button.

- Why: the name was shown two or three times, "2:01" had no label, "10m construction" stayed visible in
  the middle of a round, and a manual "Refresh" button suggested the bracket did not update.
- Guard: `e2e/tournament.spec.ts` · `src/game/TournamentPanel.test.tsx` · `src/lobby/TournamentBracket.test.tsx` · `src/lobby/TournamentBracketModal.test.tsx` · `src/lobby/useTournamentBracket.test.ts`

### TRN-16 · Leaving a tournament is one action, at the bottom, with a confirmation
Only a participant can leave, through one "Leave tournament…" danger button at the bottom of the bracket
or of the in-game panel, which asks for confirmation. No header or toolbar carries a second one.

- Why: the in-game panel had both "Leave" and "Leave tournament", and the bracket put the destructive
  action in its header next to the start date.
- Guard: `e2e/tournament.spec.ts` · `src/game/TournamentPanel.test.tsx` · `src/lobby/TournamentBracket.test.tsx` · `src/lobby/TournamentBracketModal.test.tsx`

### TRN-17 · During a game the tournament is a side panel that leaves the board visible
In a game that belongs to a tournament, the tournament opens as a panel at the side of the board (a
sheet on a phone) with the current match, the standings, the rounds and the tournament chat, never as a
centred modal over the board. Collapsed, it is a pill with the round, the match score and the player's
position, draggable as before.

- Why: the expanded panel was a modal that covered the board and repeated the tournament name three
  times.
- Guard: `e2e/tournament.spec.ts` · `src/game/TournamentPanel.test.tsx`

### TRN-18 · Construction shows a countdown and who is ready; a finished tournament shows its podium
While the tournament is constructing, the bracket shows the time left (from `constructionTime` and
`stepStartTime`), a progress bar, and each player as building or ready (`Waiting for next round` while
constructing means ready), instead of an empty rounds area. A finished Swiss tournament shows a podium
of the top three by points above the standings; a finished elimination tournament shows its champion
(the winner of the final).

- Why: construction showed a large empty "No rounds yet" box and a static "10m construction", and a
  finished tournament looked exactly like a running one.
- Guard: `e2e/tournament-bracket.spec.ts` · `src/lobby/TournamentBracket.test.tsx` · `src/lobby/tournament/matches.test.ts`

### TRN-19 · On a phone the bracket is one column with Rounds and Standings as a switch
On a narrow screen the bracket is a full-height sheet: a compact header, the "Your match" card, then a
Rounds / Standings switch. Nothing scrolls sideways inside the vertical scroll, and no header control is
clipped.

- Why: at 390 px the header chips stacked, the date and the leave button were clipped, and the round
  columns scrolled sideways inside a vertically scrolling modal.
- Guard: `e2e/tournament-bracket.spec.ts` · `src/lobby/TournamentBracket.test.tsx`

### TRN-20 · The tournament chat counts unread messages until you open it
While the Chat tab of the in-game tournament panel is not showing, messages that arrive in the tournament
chat are counted, and the count is shown on the Chat tab and on the collapsed pill ("9+" above nine).
Opening the Chat tab clears it. Your own messages and system lines (joins, leaves, server notices) do not
count. The count is the number of messages after the last one you saw, not a difference of list lengths.

- Why: the tab gave no sign that someone had written, so a question from an opponent went unseen for a
  whole game. The client keeps only the last 300 chat messages of all chats together, so a count built on
  the list's length freezes once the list is full.
- Guard: `e2e/tournament.spec.ts` · `src/game/TournamentPanel.test.tsx` · `src/game/tournamentChatUnread.test.ts`
