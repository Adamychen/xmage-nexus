# Mage.Proxy — XMage WebSocket Bridge

A thin bridge between the XMage Java server (jboss-serialization protocol) and
any modern client (JSON over WebSocket). **Zero game logic** — the proxy only
forwards state and actions. All rules engine logic lives in the XMage server.

## Architecture

```
┌──────────────┐   WebSocket JSON   ┌────────────────┐   jboss-serialization   ┌───────────────────┐
│  Web Client  │ ◀────────────────▶ │  Mage.Proxy    │ ◀─────────────────────▶ │  XMage Server     │
│  React + TS  │   port 8787        │  (Java)        │   port 17171            │  (Mage.Server)    │
└──────────────┘                    └────────────────┘                         └───────────────────┘
```

**What the proxy does:**
1. Opens a real XMage session (`SessionImpl`) to the server
2. Receives server callbacks (game events, lobby updates, chat)
3. Serializes them to JSON using `JsonUtil` (reflection-based, field-by-field)
4. Broadcasts them to all connected WebSocket clients
5. Receives actions from clients and forwards them to the server

**What the proxy does NOT do:**
- No game rules logic
- No card database
- No state transformation (JSON mirrors Java fields 1:1)
- No event filtering (forwards everything, except outdated events on reconnect)

## How Serialization Works

The proxy uses `JsonUtil.java` — a reflection-based serializer. Rules:

| Java Type | JSON Representation |
|---|---|
| `String`, `UUID`, `Enum` | `"string"` |
| `int`, `long`, `Integer`, `Long`, `double` | `number` |
| `boolean`, `Boolean` | `boolean` |
| `Date` | `number` (epoch millis) |
| `Optional<T>` | unwrapped (`null` if empty) |
| `List<T>`, `T[]` | `[...]` |
| `Map<K,V>` | `{...}` (keys stringified) |
| Custom objects | `{field1: ..., field2: ...}` (camelCase field names) |
| `null` fields | omitted or `null` |
| `static`, `transient` fields | skipped |
| Technical fields (`serialVersionUID`, `logger`, `Class`, `Throwable`) | skipped |

Field names come from Java reflection (camelCase). The TypeScript types mirror
these exactly — see `schema/contract.schema.json` and `types.generated.ts`.

## Protocol: Client → Proxy (Actions)

Request format:
```json
{"requestId": "42", "action": "connect", "args": {"host": "localhost", "port": 17171}}
```

### Connection & Session

**Multi-tenant:** every WebSocket connection owns its own XMage session
(`SessionImpl`); one proxy process serves many users at once. A second connection
that sends `connect` with the **same account** (`host|username`) attaches to the
existing session (several tabs/windows = one session) instead of opening a new
one. Different accounts are isolated sessions: server→client events of a session
only reach that session's connections.

The `connect` result carries `data.attached`: `true` when the connection
re-attached to a live session (reload or reconnect within the grace period) and
`false` when it opened a new XMage session. With `attached: false` the server
callback ids restart at 1, so the web resets its per-game event ordering. It also
carries `data.streamId` (see the resumable stream below) and, on an attach,
`data.resumed`.

**Resumable stream:** every frame a session broadcasts except `lobby` carries a
`seq`, numbered per proxy session (`OutboundLog`). A `connect` with
`resume: {streamId, seq}` (the last frame the client processed) that attaches to
that same stream gets every later frame replayed in order before the live stream
(`resumed: true`): a `SIDEBOARD`, a game 2 `START_GAME`, a `GAME_OVER` or chat sent
while the client was away is not lost. A newer plain `GAME_UPDATE` of a game
replaces the older one in the log; frames are kept 60 s once delivered and
without limit (up to 2000 frames / 16 MB) while no client is attached. When the
requested `seq` is no longer available the attach answers `resumed: false` and the
client rejoins its game (`joinGame` replay below). Clients drop a frame whose
`seq` they already processed.

**Lost link to the server:** when the proxy loses its XMage server (network,
server hiccup) while clients are attached, it logs the session in again by itself
for up to `--relinkSecs` (default 600 s), hiding the old server session and
passing its restore id as the desktop client does, so the server hands the tables
back. A lost-link report is checked first by pinging the server with the session
itself (`SessionProbe`, up to 45 s): jboss' validator gives up after a 3 s ping
timeout, which a server busy with dead sessions' callbacks exceeds, and logging in
again on such a false alarm would kick the healthy session out. After a false
alarm the proxy's own keep-alive probe (every 20 s) watches the session instead. Clients get `serverLink` frames (`lost`, `retrying` + `attempt`, then
`restored` or `failed`); only after `failed` is `disconnected` sent. A session
lost again within 2 minutes of its relink was taken over by another login of the
same account (the server disconnects the older instance of a user, which looks
exactly like a lost link): the proxy then gives up with
`serverLink: failed, reason: "superseded"` instead of fighting it. A second
`connect` of an account whose login is still running waits for that login and
attaches to it, so one account never opens two server sessions through the proxy. The restore id
also lets a re-login of the same account through the same proxy session get its
old session back after an IP change, and it is remembered per account across
clients and restarts (see below), so a retry, a reload or a deploy is not refused
with "already connected or your IP address changed" while the server still holds
the old session.

**Grace period (`--graceSecs`, default 180 s).** When the last WebSocket of a
session closes, the XMage session stays alive so a reload, a network switch or a
phone in the background can re-attach to the running game. Only when nobody comes
back is it closed for good (the server then removes the player from its tables).
When the last page announced it was closing (`leaving`, sent by the web on
`pagehide`: tab closed, reload, navigation) the shorter `--leaveGraceSecs`
(default 45 s) applies instead: a reload is back within seconds, and the opponent
of a player who closed the tab waits 45 s instead of 3 minutes.
The proxy never closes a session early with `keepMySessionActive`: the server
keeps a zombie session whose callbacks block its threads. When the proxy process
itself stops (restart, deploy) it does **not** disconnect its sessions: the server
sees a lost connection, keeps the tables for its 3-minute window, and the next
login restores them (`User.onReconnect`). A re-login of an account whose session
is idle but not released reuses the same client (its SIM seats included).

**Replay on re-attach:** the proxy's session stays connected, so XMage does not
re-send the state when the web logs in again. The proxy caches, per game, the
last `GAME_INIT`/`GAME_UPDATE` and the last pending prompt (`GAME_ASK`,
`GAME_TARGET`, `GAME_SELECT`, `GAME_PLAY_MANA`, …) and on `joinGame` re-sends them
**to that connection only** (`ReplayCache`). The prompt stays cached until the
player answers it (`sendPlayer*`, or a `PASS_PRIORITY_*` action for a
`GAME_SELECT`; put back if the server rejects the answer) or the game ends — state
updates keep arriving while a prompt is open. The cache is cleared when a new
session starts.

**Restore ids across restarts:** the server hands a user's session to any login
that presents the session id as its `restoreSessionId`, even from another address.
The proxy remembers, per `host|username`, the id of the account's last live
session and presents it on the next login; the store is bounded and kept on disk
(`--restoreIds`, default `<tmpdir>/mage-proxy-restore-<wsPort>.json`, `none`
disables it; entries older than 10 minutes are dropped, by which time the server
has already removed the user). Without it a re-login after a proxy deploy or an
IP change is refused with "User ... already connected or your IP address changed"
until the server's own timeout. An explicit `disconnect` (logout) drops the
account's entry, so the next login is a fresh session.

**SIM seats across restarts:** the playing SIM seats are kept on disk
(`--simRoster`, default `<tmpdir>/mage-proxy-sims-<wsPort>.json`, `none` disables
it; ignored when older than 10 minutes). When their owner logs in again through a
restarted proxy the bots log in with the same name, the server takes it as a
reconnection and hands them their games; a restored bot with no game stops after
60 s. SIM names start from the clock so a new bot never reuses the name of one of
a previous process. A bot whose own link to the server drops logs in again too.

**Lobby while playing:** with a game in progress (played or watched, with events
in the last 2 minutes) the lobby is published every 20 s instead of every 2 s,
and the server news every 60 s.

**Callback order and login backlog:** server callbacks can reach the proxy out of
order; they are re-sequenced by their per-session `messageId`
(`CallbackSequencer`; a gap not filled within 400 ms is skipped). Everything
broadcast while a login is in progress (the server's reconnect restore arrives
then) is delivered to the logging-in connection right after its `connect` result.

**Compression:** the WebSocket negotiates `permessage-deflate` (a `GameView` frame
of ~200 KB shrinks 10–50×). Sends to one connection are serialized on a private
per-connection lock (`Gateway.send`).

| Action | Args | Description |
|---|---|---|
| `connect` | `{host, port, username, password, resume?: {streamId, seq}}` | Connect to XMage server. While the proxy builds its card DB on first boot it answers `ok:false, errorCode:"WARMING_UP"` — retry in a few seconds. A server running another XMage release refuses the login with `errorCode:"VERSION_MISMATCH"` (the detail keeps the server's `Your version` / `Server version` text): the proxy has to be rebuilt against that release, no retry helps. Result data: `{attached: boolean, streamId: string, resumed?: boolean}` |
| `disconnect` | `{}` | Disconnect from server |
| `leaving` | `{}` | The page is closing; no answer. The session then gets the short grace period (`--leaveGraceSecs`) when this was its last connection |
| `ping` | `{}` | Keepalive and web heartbeat; answered at once on the WebSocket thread (before or after `connect`), never queued behind the session's commands |
| `getServerInfo` | `{}` | Server version, protocol version |
| `getGameTypes` | `{}` | Available game types |
| `getDeckTypes` | `{}` | Available deck types |
| `getPlayerTypes` | `{}` | Available player types (HUMAN, SIM, etc.) |
| `getExpansionsWithBoosters` | `{}` | Sets with boosters (`{code, name, releaseDate}`), release-date order; `[]` while the card DB is still building |
| `getRoomUsers` | `{}` | Users in the room |
| `getRoomChatId` | `{}` | Chat room ID |
| `getTables` | `{}` | All tables |
| `getFinishedMatches` | `{}` | Match history |
| `getServerMessages` | `{}` | Server news/messages |

### Lobby

| Action | Args | Description |
|---|---|---|
| `createTable` | `{name, gameType, deckType, winsNeeded, playerTypes, password, ...}` | Create a table |
| `joinTable` | `{roomId, tableId, playerName, playerType, skill, deck, password}` | Join a table |
| `leaveTable` | `{tableId}` | Leave a table |
| `removeTable` | `{tableId}` | Remove a table (owner only; a table that no longer exists counts as removed; non-owners get `NOT_AUTHORIZED`) |
| `startMatch` | `{tableId}` | Start the match |
| `startTournament` | `{tableId}` | Start the tournament (tournament tables) |
| `joinTournament` | `{tournamentId}` | Panel-join a started tournament (humans must join or the draft never fires) |
| `joinDraft` | `{draftId}` | Panel-join a started draft |
| `swapSeats` | `{tableId, seatNum1, seatNum2}` | Swap two seats (owner, READY_TO_START only) |
| `watchTable` | `{tableId}` | Watch a table |
| `watchGame` | `{gameId}` | Watch a specific game |
| `stopWatching` | `{gameId}` | Stop watching |
| `joinGame` | `{gameId}` | Join a game (as player) |
| `quitMatch` | `{tableId}` | Quit the match |

### Deck Management

| Action | Args | Description |
|---|---|---|
| `submitDeck` | `{tableId, deck}` | Submit deck for the match |
| `updateDeck` | `{tableId, deck}` | Update deck |
| `validateDeck` | `{deck}` | Pre-validate a deck against the proxy's card DB (see below) |
| `validateDeckFormat` | `{deck, deckType?, gameType?}` | Run the official XMage `DeckValidator` of that format (sizes, bans, copies, commander/partner, color identity): `{ready, supported, valid, validator, errors:[{type, group?, message?, cardName?}]}`. `supported:false` when the format has no validator |
| `commanderEligibility` | `{names}` | Can each card be a commander, computed with the real card classes: `{ready, results:[{name, eligible}]}` |
| `resolvePrintings` | `{names, strategy?, setCode?}` | The printing XMage's own importers pick for each name (see below) |
| `cardPrintings` | `{names, limit?}` | Printings of each card implemented in this release (`[]` = not implemented; `limit:1` is enough to know) |

Deck format:
```json
{
  "name": "My Deck",
  "cards": [{"cardName": "Lightning Bolt", "setCode": "2XM", "cardNumber": "162", "amount": 4}],
  "sideboard": [{"cardName": "Path to Exile", "setCode": "2XM", "cardNumber": "30", "amount": 2}],
  "commanders": [{"cardName": "Sidar Kondo of Jamuraa", "setCode": "CMR", "cardNumber": "535", "amount": 1}]
}
```

`commanders` (optional, 1–2 cards) carries the **explicitly designated**
commander(s) for Commander games (a legal pair: Partner, Partner with, Friends
forever, Doctor's companion or Choose a Background + Background). `DeckJson.parse`
moves each entry from `cards` to `sideboard` — where XMage expects commanders
(`GameCommanderImpl` treats all sideboard cards as commanders and
`AbstractCommander` validates the pair). Without this field the proxy keeps its
heuristic in `DeckValidation.normalizeForXMage` (first legal card in deck order),
which only ever sends one commander.

#### Deck pre-validation (`validateDeck`)

Replicates **exactly** the target XMage server's `Deck.load` semantics (upstream:
strict `CardRepository.findCard(set, number)`, card name ignored) using only
public upstream APIs (`CardRepository`, `CardScanner`) against the proxy's own
card DB, built from the same `mage-sets` release the fork pins. No fork code is
used, so the report is valid for any server on the same XMage version
(`beta.xmage.today` included).

The DB is built lazily on first proxy start (`CardScanner.scan()`, ~10 s in
background, stored in `Mage.Proxy/db/`, gitignored) and rebuilt automatically
whenever the fork build changes (new release ⇒ new card list).

Response `data` (advisory — `ready:false` means the DB isn't available and the
client must not block):

```json
{
  "ready": true,
  "missing": [
    {"cardName": "Rhystic Tutor", "setCode": "CY", "cardNumber": "77", "amount": 1,
     "reason": "OUTDATED_PRINTING",
     "suggestions": [{"cardName": "Rhystic Tutor", "setCode": "PCY", "cardNumber": "77"}]}
  ],
  "mismatches": [
    {"cardName": "Rhystic Tutor", "setCode": "C20", "cardNumber": "77", "amount": 1,
     "resolvedName": "Banisher Priest", "suggestions": [...]}
  ],
  "fixedDeck": {"name": "...", "cards": [...], "sideboard": [...]}
}
```

**Entries without a printing** (`"4 Lightning Bolt"` from a plain-text list)
never reach the server blank: `DeckJson.resolvePrinting` gives them, at the
protocol edge, the printing XMage's text importers pick
(`CardRepository.findPreferredCoreExpansionCard`), for every deck the proxy
forwards (`joinTable`, `submitDeck`, `updateDeck`, SIM seats, validation).
`sources` maps the resolved entry back to the blank one the client stored. They
stay blank only while the card DB is still building (validation then reports
them as `missing`).

- `missing`: the server will throw `Card not found` at join. `reason` is
  `OUTDATED_PRINTING` (the card name exists in other printings — repairable by
  swapping set/number) or `UNIMPLEMENTED` (no printing exists). `fixedDeck` is
  the deck without the rejected cards.
- `mismatches`: the server ACCEPTS the entry but loads a **different card**
  (set/number of another card — the name is ignored upstream). Surfaced so the
  player can swap to a correct printing instead of silently playing the wrong card.

#### Card catalog (`resolvePrintings`, `cardPrintings`)

Read-only lookups on the same card DB (`CardCatalog.java`), so the client never
has to guess from Scryfall what the server has. Both answer `ready:false` while
the DB is building; the client then keeps its Scryfall-only path.

```json
// resolvePrintings {names:["Lightning Bolt","Fire // Ice","Fake"], strategy:"default"}
{"ready": true, "results": [
  {"name": "Lightning Bolt", "found": true, "cardName": "Lightning Bolt", "setCode": "M11", "cardNumber": "149"},
  {"name": "Fire // Ice", "found": true, "cardName": "Fire // Ice", "setCode": "APC", "cardNumber": "128"},
  {"name": "Fake", "found": false}]}
// cardPrintings {names:["Lightning Bolt","Fake"], limit:1}
{"ready": true, "results": [
  {"name": "Lightning Bolt", "printings": [{"setCode": "J21", "cardNumber": "787"}]},
  {"name": "Fake", "printings": []}]}
```

`strategy`: `default` (`findPreferredCoreExpansionCard`, what the importers
use), `oldest` (`findOldestNonPromoVersionCard`) or `set` with `setCode`
(`findCardWithPreferredSetAndNumber`, falls back to the default). Names are
deduplicated and capped at 500 per request; split/MDFC/adventure names resolve
by full name or by front face, like `CardRepository.findCards`.

Related hardening: join/submit/update failures now classify
`Card not found` as `errorCode: "CARD_NOT_FOUND"` and always carry the server's
detail text (login failures too — `SHOW_USERMESSAGE` lists are parsed). SIM
seats strip rejected cards from their deck and report join failures to the web
as non-fatal `{type:"error"}` broadcasts instead of leaving the seat silently
empty.

### Game Actions

| Action | Args | Description |
|---|---|---|
| `sendPlayerUUID` | `{gameId, value}` | Select target/card (UUID) |
| `sendPlayerBoolean` | `{gameId, value}` | Answer yes/no, keep/mulligan, pass priority (`false` = pass) |
| `sendPlayerInteger` | `{gameId, value}` | Choose a number (X cost, amount) |
| `sendPlayerString` | `{gameId, value}` | Choose a string option |
| `sendPlayerManaType` | `{gameId, value}` | Choose mana type |
| `sendPlayerAction` | `{gameId, action, data}` | Advanced actions (e.g., `PASS_PRIORITY_UNTIL_STACK_RESOLVED`). `REQUEST_AUTO_ANSWER_TEXT_YES/NO` with `data` = the ask's `options.autoAnswerMessage` makes `HumanPlayer.chooseUse` answer that question itself from then on (`REQUEST_AUTO_ANSWER_RESET_ALL` forgets them all) |
| `updatePreferences` | `{phases?, confirmEmptyManaPool?}` | Sync user prefs to server (`UserData`, applied live via in-place `update()`): phase-stop matrix and/or empty-mana-pool pass confirm (`HumanPlayer.passWithManaPoolCheck`) |
| `cheatSetup` | `{gameId, playerId, zones:{hand?, battlefield?, library?, graveyard?, exile?}}` | **Test only**: place named cards into zones (P1; requires fork server with `testMode=true`, else `ok:false`; unknown card/zone/player → `ok:false`). Call once the game has processed ≥1 normal action (e.g. after the first land drop) — on the very first priority of turn 1 it freezes the game loop (runs off the game thread while still starting up) |

### Chat

| Action | Args | Description |
|---|---|---|
| `getRoomChatId` | `{roomId?}` | Chat id of the main room |
| `getTableChatId` | `{tableId}` | Chat id of a table waiting room |
| `getGameChatId` | `{gameId}` | Chat id of a running game |
| `getTournamentChatId` | `{tournamentId}` | Chat id of a tournament |
| `joinChat` | `{chatId}` | Join chat room |
| `leaveChat` | `{chatId}` | Leave chat room |
| `sendChatMessage` | `{chatId, text}` | Send message |

## Protocol: Proxy → Client (Events)

### Envelope Types

| Type | Description |
|---|---|
| `connected` | WebSocket connected, ready to send `connect` |
| `disconnected` | The XMage session ended (after `serverLink: failed`, or no relink possible) |
| `serverLink` | The proxy lost the XMage server and logs in again: `{state: "lost" \| "retrying" \| "restored" \| "failed", attempt?}` |
| `info` | Server info message |
| `error` | Error message |
| `lobby` | Lobby state (tables, users) — broadcast every ~2s |
| `result` | Response to an action (`ok: true/false`) |
| `event` | Server callback (game events, chat, etc.) |

### Game Events (forwarded from XMage server)

These are the core events the web client must handle. Every event has:
```json
{"type": "event", "method": "GAME_INIT", "messageId": 42, "objectId": "game-uuid", "data": {...}}
```

#### Game Lifecycle

| Event | Data | When |
|---|---|---|
| `START_GAME` | `{gameId, tableName}` | Match started |
| `GAME_INIT` | `{gameView: GameView}` | Initial game state |
| `GAME_OVER` | `{gameId, winnerName, message}` | Game ended |
| `END_GAME_INFO` | `{gameInfo, matchInfo, won, wins, loses, matchView}` | End-of-game summary (match continues or ends) |
| `SIDEBOARD` | `{deck, currentTableId, time, flag}` | Between games in a match |

#### Game State Updates

| Event | Data | When |
|---|---|---|
| `GAME_UPDATE` | `{gameView: GameView}` | State changed (card moved, phase changed, etc.) |
| `GAME_UPDATE_AND_INFORM` | `{gameView: GameView, message}` | State changed + info message |

#### Player Interaction (must respond)

| Event | Data | Expected Response |
|---|---|---|
| `GAME_SELECT` | `{gameView, message, options}` | Priority window — pass or act |
| `GAME_ASK` | `{question, options, gameId}` | Yes/no question (mulligan, etc.) |
| `GAME_TARGET` | `{message, targets, options, gameId}` | Choose a target |
| `GAME_TARGET_PLAYER` | `{message, targets, options, gameId}` | Choose a player |
| `GAME_TARGET_AMOUNT` | `{message, min, max, gameId}` | Choose amount for target |
| `GAME_PLAY_MANA` | `{message, options, gameView}` | Pay mana (click sources on battlefield) |
| `GAME_PLAY_XMANA` | `{message, options, gameId}` | Pay X mana (confirm/cancel) |
| `GAME_GET_AMOUNT` | `{message, min, max, gameView}` | Choose a number (X cost) |
| `GAME_GET_MULTI_AMOUNT` | `{messages, gameId}` | Choose multiple numbers |
| `GAME_SELECT_AMOUNT` | `{message, min, max, gameId}` | Choose an amount |
| `GAME_CHOOSE_ABILITY` | `{message, choices, gameView}` | Choose an ability |
| `GAME_CHOOSE_ONE` | `{message, options, gameId}` | Choose one option |
| `GAME_CHOOSE_MODE` | `{message, options, gameId}` | Choose a mode |
| `GAME_CHOOSE_COLOR` | `{message, options, gameId}` | Choose a color |
| `GAME_CHOOSE_NUMBER` | `{message, min, max, gameId}` | Choose a number |
| `GAME_CHOOSE_STRING` | `{message, options, gameId}` | Choose a string |
| `GAME_CHOOSE_BETWEEN` | `{message, options, gameId}` | Choose between options |
| `GAME_CHOOSE_PILE` | `{message, cardsView1, cardsView2, gameId}` | Choose a pile |
| `GAME_CHOOSE_CARDS` | `{message, options, gameId}` | Choose N cards |
| `GAME_CHOOSE_CARDS_ORDER` | `{message, options, gameId}` | Order cards |
| `GAME_SELECT_CARDS` | `{message, cardsView1, gameId}` | Select cards |
| `GAME_SELECT_TARGETS` | `{message, options, gameId}` | Select targets |
| `GAME_SELECT_PLAYER` | `{message, targets, options, gameId}` | Select a player |

#### Lobby & Chat

| Event | Data | When |
|---|---|---|
| `JOINED_TABLE` | `{tableId, tableName}` | Joined a table |
| `CHATMESSAGE` | `{chatId, username, message, messageType}` | Chat / game-log / status message. `messageType` is the XMage `ChatMessage.MessageType` (`GAME` = game log, `TALK` = player chat, `STATUS`/`USER_INFO` = system noise, `WHISPER_FROM`/`WHISPER_TO` = private). The proxy forwards the whole `ChatMessage` payload as-is, plus injects `chatId` from the callback envelope (the server payload carries no chat id). |
| `SERVER_MESSAGE` | (string or object) | Server announcement |
| `WATCHGAME` | `{gameId}` | Watching a game |

## TypeScript Types

The type contract lives in two files:

| File | Purpose |
|---|---|
| `src/net/types.generated.ts` | **Auto-generated** from `schema/contract.schema.json`. Do not edit manually. |
| `src/net/types.ts` | **Hand-maintained**. Proxy-specific types (envelopes, deck, events). Re-exports view types from generated. |

### Regenerating Types

When XMage upstream changes view classes (new fields, renamed fields):

```bash
cd web
npm run gen-types          # regenerate types.generated.ts
node ../../scripts/gen-types.mjs --validate   # CI drift check
```

The schema (`schema/contract.schema.json`) describes the wire format. Update it
when Java view classes change, then regenerate.

### Adding a New Event

1. **If it's a game event** (forwarded from server):
   - Add the event handler in `web/src/state/eventHandler.ts` (a `case` in the
     `handleEvent` router + body in `web/src/state/events/<domain>.ts`)
   - Or add feedback parsing in `web/src/game/feedback/` (if it's a player interaction)
   - Add the event method to `EVENT_METHODS` in `types.ts`

2. **If it's a new data type** (new Java view class):
   - Add the definition to `schema/contract.schema.json`
   - Run `npm run gen-types` to regenerate TypeScript interfaces
   - Use the new type in your event handler

3. **If it's a proxy action** (client → server):
   - Add a `case` in the domain class (`InfoCommands` / `TableCommands` /
     `TournamentCommands` / `GameCommands`), reachable from the
     from the `ProxyClient.handleCommand` router; add to `requiresGameId` in
     `ProxyClient.java` if the action is game-scoped
   - Add the TypeScript type in `types.ts` if needed

## What's NOT Supported (and Why)

| Gap | Reason | Impact |
|---|---|---|
| Card images | Binary data not serialized through JsonUtil | Cosmetic — can load from Scryfall API |
| Deck editor | Pure UI, no protocol gap | Build in TypeScript |
| Tournament support | Protocol events exist, UI not implemented | Build in TypeScript |
| Replay system | Server doesn't persist replays | Would need server modification |
| Admin tools | Proxy doesn't expose admin actions | Would need proxy modification |

**Key insight**: The proxy is a thin bridge. If the Java server sends it, the proxy
forwards it. If the Java client can do it, the web client can too — the only
limitation is what's implemented in TypeScript.

## Development

```bash
# Start the stack
node scripts/ctl.mjs start all

# Run tests
node scripts/test.mjs          # full suite
node scripts/test.mjs unit     # unit only
node scripts/test.mjs typecheck # type check only

# Tail logs
node scripts/tail.mjs proxy    # proxy logs
node scripts/tail.mjs server   # server logs
```

Ports:
- XMage server: `17171` (testMode)
- Proxy WebSocket: `ws://127.0.0.1:8787`
- Proxy test page: `http://127.0.0.1:8788/index.html`
- Vite dev: `http://localhost:5173`

## Activity log and admin status

Every WebSocket open/close, login (ok/fail/attach), lifecycle action (createTable, joinTable, watchGame, …) and
session end is printed to stdout as `[activity] <ISO time> <event> user=… ip=… …` (readable with `docker logs -f`).
High-frequency game input and polling actions are counted but not logged. Passwords, chat text and deck contents are
never recorded. The client IP comes from `X-Forwarded-For` when present (reverse proxy), else the socket address.

With `--adminToken <secret>` (Docker: `ADMIN_TOKEN`), `GET /admin/status` on the HTTP port returns JSON — uptime,
open connections, live sessions, connected users (server, ip, windows, actions, last action) and the last 500 events.
Send `Authorization: Bearer <secret>` (header only — a `?token=` query string was removed: it landed in the access
log, the browser history and every proxy in between). Only `GET` is accepted, and without a token the endpoint does
not exist.

## Health and readiness

Both are unauthenticated, carry no session data, and answer on the HTTP port:

- `GET /health` — liveness. `200` as long as the process answers, whatever the card database is doing.
- `GET /ready` — readiness. `503` until `DeckValidation` is `READY`, then `200`. Gate traffic (or the
  launcher's own wait) on this one: a proxy whose card database `FAILED` still accepts logins, which is the
  usual reason a player sees a confusing "login failed" during a deploy.

```json
{"ok":true,"liveness":false,"ready":true,"cardDb":"READY","sessions":3,"threads":41,"uptimeSeconds":3600}
```

The static file server sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a
`Content-Security-Policy`; fingerprinted `assets/*` (`name-<8 char base64url hash>.ext`) are cached for a year,
everything else is `no-cache` so a deploy does not keep serving the old client.

## Watchdog

The proxy logs one line per minute on its roster tick, and the same numbers are in
`/admin/status` under `runtime` and `sessions`.

```
watchdog: threads=54 (peak 79), openConns=0, accounts=0, clientsAlive=0 (created=3 disposed=3),
          wsErrors=0, cardDb=READY
```

`clientsAlive` is `clientsCreated - clientsDisposed` and is the number to read across ticks: one
live session accounts for one, a client released after a rejected login for none. Anything that
climbs while `openConns`/`accounts` do not is a client that nothing can reach, and the line turns
into a `WARNING` once it exceeds the reachable count by more than five. This exists because the
proxy ran for weeks leaking two to five non-daemon threads per failed login with no counter
anywhere that would have shown it.

`sessions` holds the per-connection detail: `connected`/`relinking`/`released`, the grace timer
countdown, `gamesInProgress`, `pendingGapEvents` (callbacks held by the ordering sequencer),
`outboundFrames`/`outboundChars` (the resumable stream buffer), `replayStates`/`replayPrompts`
(the reconnect cache), `sessionGameIds`, `failedKeepAlives`, `lobbyPublishFailures`,
`relinkAttempts` and `simsAlive`. A session that is stuck on a silent relink or a lobby that
stopped publishing is otherwise indistinguishable from a player who went away.

Note that the fork routes JUL through log4j, so these lines land on **stderr** (`.run/proxy.err.log`),
not `proxy.out.log`.
