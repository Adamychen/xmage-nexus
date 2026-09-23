# Lessons — XMage Nexus

Durable, hard-won lessons (one line each). Add one only when it is reusable;
the historical narrative lives in `git log`. Scoped docs: `AGENTS.md` (daily
ops), `docs/testing.md`, `web/AGENTS.md`, `Mage.Proxy/README.md`.

## Server & protocol

- JDK 17: both proxy and server need `--add-opens=java.base/java.io=ALL-UNNAMED` or jboss-serialization fails.
- `deckType` must match a real server config name (e.g. `Constructed - Modern`); client and server versions must match strictly (local: `config.xml` + `plugins/`).
- `createTable` requires the deck's `quitRatio` ≥ the user's (default 100); AI seats are filled **before** the human seat.
- "Any target" prompts include both players: use the opponent's UUID, not `targets[0]` (it can be yourself).
- Game events keep arriving ~1 min after the watcher closes; "broadcast to 0 connections" is normal for game events, a bug signal for lobby events.
- A killed proxy session (`kill -9`) leaves its socket on the server: new logins then fail with `SESSION CALLBACK EXCEPTION - Unable to create socket` until server+proxy restart.
- Test mode caps `maxGameThreads` (10); browser E2E leaves matches running — restart the server between heavy batches.
- Keep the demo AI deck stable (Islands + Mountains + 4 Bolts): 16 Bolts make AI-vs-AI matches end in 2-3 turns, hiding board interactions.
- macOS `/usr/bin/java` is a stub: resolve the real binary (Homebrew `openjdk@17` first); `scripts/lib.mjs` `javaBin()` does this.
- Generated usernames must be ≤14 chars (`maxUserNameLength`); login failures log the misleading `Can't receive server state before other data`.

## Proxy & sessions

- `connect` must be idempotent per `host|username` (browser reloads): restarting the session clears WS registries and triggers reconnect loops; test mode kicks duplicate connections from the same host.
- Every `SessionImpl` (web client, SIM, future bots) needs its own keep-alive ping or `UserManagerImpl` expires it (~4 min lease) and the game declares the seat lost/quit.

## Web client

- The tap rotation lives in `transform`, so any hover/animation that also writes `transform` replaces it and the card straightens: board effects must use the independent `translate`/`scale` properties, which compose with it (guard: `web/e2e/tapped-rotation.spec.ts`).
- Decorative duplicates of visible text (e.g. the cinematic end title) go in a `data-*` attribute rendered with `::before { content: attr(...) }`: a second text node with the same string makes `getByText` find multiple elements and breaks existing tests.
- `state/slices/*` must only import dependency-free modules: pulling a helper that reaches `board/*` (e.g. via `commanders.ts`) creates an import cycle and a TDZ crash at store init; keep catalogs (`appearance/playmats.ts`) separate from game-aware helpers (`playmatIdentity.ts`).
- Full-screen overlays opened from inside a board zone (resource bar, player zone) must `createPortal` to `document.body`: those zones set `position` + `z-index`, so the overlay's own `z-index` only competes inside that stacking context and the divider strip, pass button and hand paint over it (the ray/cross-zone viewer did, 2026-09-23).
- `CardView.originalPower`/`originalToughness` arrive as a serialised MageInt (`{ baseValue, modifiedBaseValue, boostedValue, cardValue }`), not the `string | null` the contract declares; read them through `board/ptTrend.ts` (`cardValue` = printed value, `baseValue` when it is `*`).
- `canPlayObjects` lists every untapped mana source (only `basicManaAbilities`), so "something is playable" must ignore mana-only entries (`game/smartStops.ts`).
- Auto-pass must answer only the view that came with a `GAME_SELECT`, once: the real server sends a `GAME_UPDATE` that already shows `hasPriority` just before each request, and a pass sent for it is queued and silently consumes the NEXT window (it skipped the player's main phase). `gameCycle` differs between the two, so it is not a usable dedupe key (`priorityRequest` in the game slice).
- Board FX must stay in the style ratchet: colours come from `ui/tokens.css` (`--mana-*-rgb`, `--ember-rgb`, …) and every decorative animation needs its `html.fx-off` and `prefers-reduced-motion` opt-outs.
- Scryfall's rate limit is per IP, not per tab: the request queue shares its clock and its 429 pause across tabs over a `BroadcastChannel`, and every card lookup must go through the IndexedDB-backed `scryfallJson` (raw `scryfallFetch` means refetching everything on each reload).

## Testing & tooling

- Log checks must be time-windowed from the test start: proxy/server logs are append-only across restarts and old traces cause false positives.
- Real-mode Playwright (`E2E_BACKEND=real`) targets `beta.xmage.today` unless `E2E_SERVER_HOST` is set (`e2e/support/start-game.ts`); when running a spec by hand against the local stack, always pass `E2E_SERVER_HOST=localhost` or it creates tables on the public server.
- Real-mode E2E cannot use scripted fixtures: the server never auto-starts AI-vs-AI tables and advances by priority timers, so the WS helper auto-passes (fake mode is the deterministic loop).
- Keep every generated/imported deck with a concrete printing: the proxy's name-only fallback (`Deck.resolveCardInfo`) is a fork patch, so a real server rejects "17 Forest" with `Card not found`.
