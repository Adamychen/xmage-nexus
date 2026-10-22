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
