# Lessons — XMage Nexus

Durable, hard-won lessons (one line each). Add one only when it is reusable;
the historical narrative lives in `git log`. Scoped docs: `AGENTS.md` (daily
ops), `docs/testing.md`, `web/AGENTS.md`, `Mage.Proxy/README.md`.

## Server & protocol

- JDK 17: both proxy and server need `--add-opens=java.base/java.io=ALL-UNNAMED` or jboss-serialization fails.
- `deckType` must match a real server config name (e.g. `Constructed - Modern`); client and server versions must match strictly (local: `config.xml` + `plugins/`).
- `createTable` requires the deck's `quitRatio` ≥ the user's (default 100); AI seats are filled **before** the human seat.
- "Any target" prompts include both players: use the opponent's UUID, not `targets[0]` (it can be yourself).
- `watchTable` only yields `WATCHGAME` once the table is `DUELING`, and the XMage client's `SessionImpl.watchTable` returns `true` regardless, so one sent right after `startMatch` can be silently dropped: re-send it every ~500 ms until `WATCHGAME` (a single retry 20 s later loses to fast AI-vs-AI games that already ended).
- Game events keep arriving ~1 min after the watcher closes; "broadcast to 0 connections" is normal for game events, a bug signal for lobby events.
- A killed proxy session (`kill -9`) leaves its socket on the server: new logins then fail with `SESSION CALLBACK EXCEPTION - Unable to create socket` until server+proxy restart.
- Test mode caps `maxGameThreads` (10); browser E2E leaves matches running — restart the server between heavy batches.
- Keep the demo AI deck stable (Islands + Mountains + 4 Bolts): 16 Bolts make AI-vs-AI matches end in 2-3 turns, hiding board interactions.
- macOS `/usr/bin/java` is a stub: resolve the real binary (Homebrew `openjdk@17` first); `scripts/lib.mjs` `javaBin()` does this.
- Generated usernames must be ≤14 chars (`maxUserNameLength`); login failures log the misleading `Can't receive server state before other data`.
- `TableView.games` is `Match.getGames()` order (oldest first) and keeps finished games: `watchGame` on one of those returns `false` (no `GameController`), so a spectator "follow" must only pick a game *after* the watched one (`findFollowGameId`).

## Proxy & sessions

- `connect` must be idempotent per `host|username` (browser reloads): restarting the session clears WS registries and triggers reconnect loops; test mode kicks duplicate connections from the same host.
- Every `SessionImpl` (web client, SIM, future bots) needs its own keep-alive ping or `UserManagerImpl` expires it (~4 min lease) and the game declares the seat lost/quit.

## Web client

- The tap rotation lives in `transform`, so any hover/animation that also writes `transform` replaces it and the card straightens: board effects must use the independent `translate`/`scale` properties, which compose with it (guard: `web/e2e/tapped-rotation.spec.ts`).
- Decorative duplicates of visible text (e.g. the cinematic end title) go in a `data-*` attribute rendered with `::before { content: attr(...) }`: a second text node with the same string makes `getByText` find multiple elements and breaks existing tests.
- Fixed-size layout boxes that crop content must use `overflow: clip`, not `hidden`: a `hidden` box is still a scroll container, so focusing a child that peeks past its edge (a clicked hand card) scrolls the whole board by up to ~100px and it never scrolls back (guard: `e2e/board-scroll.spec.ts`).
- `state/slices/*` must only import dependency-free modules: pulling a helper that reaches `board/*` (e.g. via `commanders.ts`) creates an import cycle and a TDZ crash at store init; keep catalogs (`appearance/playmats.ts`) separate from game-aware helpers (`playmatIdentity.ts`).
- Full-screen overlays opened from inside a board zone (resource bar, player zone) must `createPortal` to `document.body`: those zones set `position` + `z-index`, so the overlay's own `z-index` only competes inside that stacking context and the divider strip, pass button and hand paint over it (the ray/cross-zone viewer did, 2026-09-23).
- `CardView.originalPower`/`originalToughness` arrive as a serialised MageInt (`{ baseValue, modifiedBaseValue, boostedValue, cardValue }`), not the `string | null` the contract declares; read them through `board/ptTrend.ts` (`cardValue` = printed value, `baseValue` when it is `*`).
- `canPlayObjects` lists every untapped mana source (only `basicManaAbilities`), so "something is playable" must ignore mana-only entries (`game/smartStops.ts`).
- `canPlayObjects` can arrive **empty** during a mana-payment sub-loop that isn't a normal spell cast (e.g. a "pay {2} to attack" cost like Propaganda: verified live, 2026-09-23) even with untapped lands/Treasures on board; gating permanent clicks on `playableIds` then makes nothing clickable. The official client never gates on `isPlayable` (`CardPanel.mouseClicked` always forwards the UUID and lets the server accept/reject), so `useBoardPresenter.ts` forwards any permanent click during `feedback.mode === 'mana'` regardless of `playableIds` (`manaFeedbackActive`). This gap is **not universal** to every off-cast mana ask, though: an Echo payment resolving in upkeep (`fixtures/recorded/echo-upkeep.json`) gets `canPlayObjects` populated correctly — so far only the cost-to-attack sub-loop is confirmed empty. Don't assume a mechanic is broken just because it pays mana outside casting; check `canPlayObjects` in the live `GAME_PLAY_MANA` payload (`REC_DUMP_EVENTS=1` in `scripts/record.mjs`) before writing it off. The client-side fix covers both cases either way.
- Auto-pass must answer only the view that came with a `GAME_SELECT`, once: the real server sends a `GAME_UPDATE` that already shows `hasPriority` just before each request, and a pass sent for it is queued and silently consumes the NEXT window (it skipped the player's main phase). `gameCycle` differs between the two, so it is not a usable dedupe key (`priorityRequest` in the game slice).
- Smart mana payment (`game/smartManaPayment.ts`) must enumerate sources from the controlled player's battlefield `rules`, not `canPlayObjects`, and re-solve at every `GAME_PLAY_MANA` because the server asks once per tap. It never uses hidden information (only the own hand, own board and the opponent's visible untapped mana) and bails to manual play instead of guessing (unknown cost tokens, sacrifice or restricted sources, convoke).
- Board FX must stay in the style ratchet: colours come from `ui/tokens.css` (`--mana-*-rgb`, `--ember-rgb`, …) and every decorative animation needs its `html.fx-off` and `prefers-reduced-motion` opt-outs.
- Scryfall's rate limit is per IP, not per tab: the request queue shares its clock and its 429 pause across tabs over a `BroadcastChannel`, and every card lookup must go through the IndexedDB-backed `scryfallJson` (raw `scryfallFetch` means refetching everything on each reload).

## Testing & tooling

- Log checks must be time-windowed from the test start: proxy/server logs are append-only across restarts and old traces cause false positives.
- Real-mode Playwright (`E2E_BACKEND=real`) targets `beta.xmage.today` unless `E2E_SERVER_HOST` is set (`e2e/support/start-game.ts`); when running a spec by hand against the local stack, always pass `E2E_SERVER_HOST=localhost` or it creates tables on the public server.
- Real-mode E2E cannot use scripted fixtures: the server never auto-starts AI-vs-AI tables and advances by priority timers, so the WS helper auto-passes (fake mode is the deterministic loop).
- Keep every generated/imported deck with a concrete printing: the proxy's name-only fallback (`Deck.resolveCardInfo`) is a fork patch, so a real server rejects "17 Forest" with `Card not found`.
- `scripts/gallery-visual.mjs --update` rewrites every baseline in the matrix, not only the ones that changed: after regenerating for one screen, `git checkout` the unrelated PNGs so drift from other work is not baked in.
- Fake-mode specs that inject views through `__mageStore.handleMessage` race the scenario's own frames (the `HumanHelper` acting makes the FakeServer re-broadcast its base view): a frame at the *same* turn/step is not stale and overwrites the injected one, so inject at a later turn than the scenario (`game-assist` P/T test failed ~60% under load at turn 1).
- `expect.poll` fails immediately when its callback throws (no retry): return a sentinel value for transient DOM gaps instead of throwing.
- `actions/upload-artifact@v4` skips hidden paths by default: uploading `.run/*.log` needs `include-hidden-files: true`, otherwise the integration job silently uploads nothing.
- `scripts/warmup.mjs` must never let an exception escape: an uncaught rejection kills it with only `Node.js vX` as the last line (all `test.mjs` shows); transient stack-not-ready errors are retried for `NEXUS_WARMUP_TRANSIENT_MS` (180 s).
