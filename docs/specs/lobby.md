# Lobby and tables

Prefix: `LBY`

Everything between opening the app and the first game view: the login screen
(`web/src/lobby/LoginScreen.tsx`) and the setup wizard (`web/src/setup/SetupWizard.tsx`), the
table list (`LobbyScreen.tsx`, `TableFilterBar.tsx`), the create-table wizard
(`lobby/CreateTable/`), joining and watching (`useTableActions.ts`, `JoinTableDialog.tsx`), the
waiting room (`SpectatorStagingScreen.tsx`), invite links (`useInviteLink.ts`, `deepLink.ts`),
the history tab (`FinishedMatchesPanel.tsx`) and the reload restore (`setup/bootRestore.ts`).
How their dialogs open, stack and close is `dialogs.md` (DLG-1 to DLG-4).

### LBY-1 · The proxy and the XMage server are two addresses, and a port is never guessed
The login screen and the setup wizard ask separately for the proxy (the WebSocket bridge the
browser talks to) and the XMage server it plays on; the URL parameters `?proxy=host:port` and
`?server=host:port` fill them separately too. A port that is empty, not a number or outside
1–65535 stops the connection with a warning; it is never silently replaced by 8787 or 17171.

- Why: the proxy is multi-tenant, so one deployed proxy serves players of any server
  (`AGENTS.md`, "Multi-tenant proxy"). Port fields validate 1–65535 since `8fbb005e7b`, so that a
  mistyped port fails where the player can see it instead of connecting somewhere else.
- Guard: `src/lobby/LoginScreen.test.tsx` · `src/setup/SetupWizard.test.tsx` · `src/lobby/autoConnect.test.ts`

### LBY-2 · A username has at most 14 characters
Both username fields (login screen and setup wizard) stop at 14 characters, the server's
`maxUserNameLength`. The fake server rejects a longer name with the server's own message, so a
test or script that generates longer names fails in fake mode too.

- Why: the server refuses longer names, and the misleading `Can't receive server state before
  other data` it logs on any failed login made that refusal look like an intermittent beta
  handshake bug (`docs/lessons.md`; `AGENTS.md`, "Smoke test against the public server").
- Guard: none yet (`maxLength={14}` in `LoginScreen.tsx` and `SetupWizard.tsx` and the check in
  `fixtures/fakeCore.ts` exist, but no test asserts the cap)

### LBY-3 · On the public server the account password is off; table passwords still work
When the target server is `beta.xmage.today`, the account password field of the login screen
and of the setup wizard is disabled with a note, emptied, and never sent. Table passwords are not
affected: creating a private table and joining one keep a working password field there, and the
password travels with `createTable` and `joinTable`.

- Why: the public server runs with `authenticationActivated=false` and ignores account passwords
  (`2a64edb91f`). The same disable was applied to table passwords (`dfa2fbe3b4`) and reverted on
  2026-09-20 (`web/COMPONENT_PARITY.md` U3/U4): the engine always checks a table password
  (`TableController.joinTable`, `Wrong password.`), verified live with a private table on beta.
- Guard: `src/setup/SetupWizard.test.tsx` · `src/lobby/CreateTableDialog.test.tsx` · `src/lobby/JoinTableDialog.test.tsx`
  (the login screen's own disable is not asserted)

### LBY-4 · The table list sorts like the desktop client and filters further
By default the list shows the player's own unfinished tables first, then tables with a free
seat, then the newest; "newest" and "oldest" are explicit choices. The filters are the desktop
client's (rated or unrated, open or passworded, constructed or limited tournaments, hide tables of
ignored players) plus a text search the desktop lacks, matching table name, host, game type,
format, notes and seated players. Tables of ignored players stay listed until that toggle is on.
Saved filters come back on the next visit; a saved contradictory pair ("hide passworded" with
"passworded only") resolves to the "only" filter, and unreadable saved filters do not break the
lobby.

- Why: desktop parity (`c1cd78ee27`, `web/COMPONENT_PARITY.md` U2), which also added the warning
  shown when joining an ignored player's table. The contradictory pair, saved by earlier versions,
  guaranteed an empty list (`f08ed4e46b`).
- Guard: `src/lobby/TableFilterBar.test.tsx` · `src/lobby/LobbyScreen.render.test.tsx`
  (the ignored-owner join warning is not asserted)

### LBY-5 · New seats wait for humans; bots are the server's own AI, never SIM
In the create-table wizard every seat beyond the host's is an open human seat by default. A bot
is an explicit choice among the server's native AI types (`COMPUTER_MAD`,
`COMPUTER_MONTE_CARLO`, `COMPUTER_DRAFT_BOT`), and the client joins each bot seat with a checked
deck after creating the table. The proxy's `SIM` seat is never offered or sent, and a form saved
by an older client turns its SIM seats into open human seats.

- Why: `4fe0f8ab8a` (design `docs/plans/2026-10-10-sim-dev-only-design.md`): SIM is a test
  harness, release proxies reject it, and the native AI runs on any stock server including beta.
- Guard: `src/lobby/CreateTable/tableKind.test.ts` · `src/lobby/CreateTable/constants.test.ts` · `src/lobby/CreateTableDialog.test.tsx` · `e2e/wizard.spec.ts`
  (the legacy SIM-seat migration is not asserted)

### LBY-6 · Creating a table either completes or leaves nothing behind
The server creates a table and seats its players in separate calls. When a seat join fails (the
host's or a bot's) or the player cancels a deck check after the table exists, the client deletes
the table it just created. Cancelling before the table exists creates nothing.

- Why: `1546176cb2`. `createTable` and the seat joins are not atomic, so every failed retry left
  a stray table in the lobby (`docs/lessons.md`).
- Guard: `src/lobby/CreateTableDialog.test.tsx` · `src/lobby/CreateTable/useCreateTableForm.test.ts`

### LBY-7 · Joining goes through the deck dialog, except a limited tournament
Join takes a free human seat only: a full table, or one whose only free seats are AI seats,
shows an error and opens nothing. A limited tournament without a password is joined at once,
without a deck (the deck is built in the draft or sealed). Any other table opens the deck
dialog, which asks for a password only when the table has one. A rejected join is shown inside
that dialog, translated and dismissable, so the player can retype the password or pick another
deck without starting over.

- Why: the direct join mirrors the desktop's `joinTournamentTable` with no deck (U4-4,
  `289ab7edb6`). The rejection used to paint the raw server text (`Join Table Wrong password.`)
  in the lobby banner behind the dialog, with no way to close it (`71b37b421a`).
- Guard: `src/lobby/useTableActions.test.tsx` · `src/lobby/lobbyUtils.test.ts` · `src/lobby/JoinTableDialog.test.tsx` · `e2e/join-errors.spec.ts` · `e2e/staging.spec.ts`

### LBY-8 · Watching a match opens its waiting room; watching a tournament opens its bracket
Watching a regular match enters the spectator waiting room, which becomes the game when it
starts. Watching a tournament table opens the tournament bracket instead, where each running match
can be watched. A watch the server refuses shows the error and does not enter the waiting room.

- Why: `e08e881492`. The server does not resolve table ids in `getTournament`, so the waiting
  room of a tournament stayed on "preparing" forever; the bracket uses the real tournament id
  that `SHOW_TOURNAMENT` carries.
- Guard: `src/lobby/useTableActions.test.tsx`

### LBY-9 · The waiting room informs about readiness but never blocks the start
Leaving the waiting room keeps the seat, and "Return to table" goes back to it. "Ready" is a mark the
client posts in the table chat (the server has no ready state); only a mark sent by the player it
names counts, and an AI seat counts as ready. Only the table owner can start or delete the table.
Starting while someone is not ready asks for confirmation instead of refusing.

- Why: the desktop waiting dialog has no ready toggle and lets the owner start a ready table at
  any time; the mark adds information, not a gate (decision U4-9, `289ab7edb6`).
- Guard: `src/lobby/SpectatorStagingScreen.test.tsx` · `e2e/staging.spec.ts` · `e2e/staging-chat.spec.ts`

### LBY-10 · An invite link lands on the table and never carries the password elsewhere
`#join=<table>` opens the deck dialog with the table password from the link prefilled;
`#watch=<table>` watches the table. A link that names another server asks before switching, and
the switch logs in there with an empty password, never the saved one; declining leaves a visible
note. A table that is not in the lobby yet is retried for 10 seconds (the lobby broadcast lags)
with a "searching" note, then reported as gone.

- Why: the links shipped in `6e2c5cfa03`; the confirmed switch that resumes the invitation and the
  visible notes came from the interactive audit (`f08ed4e46b`); the empty password on a switch is
  `8fbb005e7b`. Opening the login screen prefilled for the other server instead is open work
  (`ROADMAP.md` §4.11).
- Guard: `src/lobby/useInviteLink.test.tsx` · `src/lobby/deepLink.test.ts` · `src/lobby/JoinTableDialog.test.tsx` · `e2e/invite-link.spec.ts`

### LBY-11 · A finished match shows every player
The history tab shows each finished match with all of its players (a four-player Commander pod
shows four), their wins, one winner crown and the quit or timeout markers. A result with draws is
read in the server's `[wins-draws-losses]` order.

- Why: `13382dbe99`. The panel showed only the first two players of a pod and read a result with
  draws as wins-losses-draws.
- Guard: `src/lobby/FinishedMatchesPanel.test.tsx`

### LBY-12 · A reload brings the player back
A device that holds a saved connection logs back in when the page loads, whether or not the
setup wizard was ever finished, and a game in progress reopens. The wizard shows only on a device
that has never played.

- Why: `453f4d1966`. The wizard's "seen" flag also gated the re-login, so a player who closed the
  wizard with the ✕ landed on a bare login screen after every reload (`docs/lessons.md`).
- Guard: `src/setup/bootRestore.test.ts` · `src/App.boot.test.tsx` · `e2e/reload-restore.spec.ts`

### LBY-13 · Each format is reachable from one place: a popular chip or the "more formats" list
A format chip (Commander, Modern, Pioneer, Standard, Pauper, Limited) owns the tables whose deck
type names it as a whole word, so "Constructed - Premodern" is not Modern. Every other deck type
of the server catalogue that no chip owns is listed in the "more formats" dropdown, which always
offers Premodern. No deck type sits under two chips. Brawl is owned by the Commander chip.

- Why: the report of 22 Oct 2026 (app 0.5.0): Modern showed Premodern tables and Premodern had no
  option of its own. The substring match and the dropdown exclusion both hid it, and no test
  covered the catalogue.
- Guard: `src/lobby/TableFilterBar.test.tsx`

### LBY-14 · A table is in exactly one game-mode bucket: 1v1, multi-player or tournament
For every game type of the catalogue, a match with its seat count and a tournament of it each match
one of the mode filters (1v1, multi-player, tournament), never none and never two.

- Why: the mode filters decide from the seat count and words of the game type; no test checked that
  the catalogue's game types fall in a bucket, so a new game type could vanish from every filter.
- Guard: `src/lobby/TableFilterBar.test.tsx`

### LBY-15 · The custom starting life shows the life the format starts with
With **Custom starting life** off, its field shows the life the server will apply for the chosen
game type and deck type (40 for Commander, 30 for Commander Free For All with the Duel Commander
deck type, 20 for Free For All…), and turning it on starts from that number. A game type the
client does not know shows no number, only "Format default". With the option off the client sends
no life, so the server's own default always wins; the table only mirrors it
(`*Match.startGame()` in each `Mage.Server.Plugins/Mage.Game.*` module).

- Why: the field showed 20 for every format, so a Commander table looked like a 20-life game while
  it started at 40 (issue #23 follow-up).
- Guard: `src/lobby/CreateTable/constants.test.ts` · `src/lobby/CreateTable/CustomOptions.test.tsx`

### LBY-16 · The contributors are credited in a box beside the login card
The login screen names its contributors in a panel to the right of the login card, vertically
centred on the card's right edge, under the heading "Contributors" in the player's language. The
panel is a list of names, never a sentence, and it stays out of the card's way: below 1100 px of
width it moves under the card instead of beside it, centred with it. It does not take focus or clicks.

- Why: the first credit was one sentence pinned to the corner, which read as a footnote and was
  hard to extend. A list in its own box grows by adding a name to `CONTRIBUTORS`
  (`LoginScreen.tsx`) and needs no translation per name.
- Guard: `src/lobby/LoginScreen.test.tsx`

### LBY-17 · The account password is never saved on the device
The login screen and the saved connection keep the server, the proxy and the username, never the
account password. Reopening the client leaves the password field empty, and the saved connection
record has no password field at all. Table passwords (LBY-3, LBY-10) are unaffected: they are typed
per table and never stored.

- Why: the saved connection (`mage-web-connection`) was written with the password in plain text, so any
  reader of the browser's storage could take the account. The review of 2026-10-25 flagged it as a
  security issue alongside the design findings.
- Guard: `src/state/persistence.test.ts` · `src/lobby/LoginScreen.test.tsx`

### LBY-18 · A table card stays inside the list at phone width
At 390 px every table card fits its column: the list is one column whose track can shrink, so the card's
buttons wrap or the card scrolls inside its own box, never past the list's edge.

- Why: the single column used `1fr`, which grows to the card's minimum content width (the two buttons side
  by side), so the card's right edge fell outside the list and its border was cut off. The compact list
  already uses `minmax(0, …)` for the same reason.
- Guard: `e2e/lobby-fit.spec.ts`

### LBY-19 · The lobby header's parts never overlap at desktop width
At 1280 px the brand, the navigation and the user actions sit side by side without overlapping. The
username is shortened with an ellipsis, the connection line is truncated, and the title stays on one line.
When the UI zoom leaves no room for the wordmark, it is clipped and the logo stands in for it; the heading
stays in the page for assistive technology, so the lobby is still recognised as the lobby.

- Why: a 11-character username wrapped onto two lines and pushed the user chip into the navigation, so the
  "Leaderboard" tab showed under the name (review of 2026-10-26).
- Guard: `e2e/lobby-fit.spec.ts`

### LBY-20 · A table shows a type badge only for a tournament
A tournament table carries the TOURNAMENT badge. An ordinary match carries no type badge: the absence of
TOURNAMENT already says it is a match, so the card does not spend a chip on the default.

- Why: the swords icon on every match card repeated what the card already said, and it was the tenth chip
  in the card's header (review of 2026-10-26).
- Guard: `e2e/lobby-fit.spec.ts`
