# SIM is dev-only: remove the proxy bot from clients and deployments

Date: 2026-10-10. Status: approved by the user ("remove SIM from the clients,
users must not be able to select it; for bot play use XMage's native server AI").

## Decision

The proxy-side `SIM` seat (`SimPlayer`) is a **development and test harness
feature**, not a product feature. Product clients never offer or send it, and
release deployments never run it. Bot opponents in the product are XMage's
**server-native AI** (`COMPUTER_MAD`, `COMPUTER_MONTE_CARLO`,
`COMPUTER_DRAFT_BOT` in `mage.players.PlayerType`), which any stock server
(beta.xmage.today, a self-hosted server, or the launcher's bundled server)
runs by itself. Nexus does not package a server; the client only ever talks to
a real XMage server, so a proxy bot has no place in a deployment.

Why the kill switch matters beyond the UI: `SimRoster` is **on by default**
(tmp file) and `SimManager.restoreSims()` re-logs persisted bots on login
without any user action. A deployed proxy would run bots out of config drift
alone.

## Changes

### Mage.Proxy (all release deployments)

- New `Config.isSimEnabled()`: the `--sim` flag, **default off**. Release
  artifacts (Docker image, `deploy/bundle`, desktop launcher) start the proxy
  without the flag → no bots.
- When disabled:
  - `createTable` / `createTournamentTable` reject a `playerTypes` list
    containing `"SIM"` with an explicit `ERR_INVALID_ARGUMENT` message (instead
    of silently mapping it to `PlayerType.HUMAN` + a hidden bot).
  - `SimManager.startSims` and `restoreSims` no-op (defense in depth).
- `scripts/dev.mjs` starts the dev stack proxy with `--sim on`, so the local
  oracle keeps the full harness. Java tests that exercise SIM enable the flag
  explicitly.

### Web client (all builds, including fake/dev mode)

- Seat-type picker (per-seat dropdown + shortcut chips) no longer offers SIM;
  options are Human (open seat) + the native AI types. The native AI types
  already reach the server as `playerTypes` + a `joinTable` for each bot seat;
  that path is unchanged.
- Defaults that used to fill seats with SIM now fill **open human seats**:
  `defaultSeatTypeFor` (non-draft), `computeMatchSeats` fallback and padding,
  `computeTournamentSeats` padding. Draft keeps `COMPUTER_DRAFT_BOT`
  (server-native). One-click solo play vs a bot becomes opt-in via the AI
  chips (works against any server with AI player types enabled).
- The client stops sending `simDecks` (global SIM deck picker removed; native
  AI decks come from the server). The wire field, `FakeServer` support,
  fixture scenarios, `wshelper`/`start-game` helpers, verify scripts and
  drivers keep SIM — they are dev-only and use the dev stack (`--sim on`).
- Legacy migration: persisted create-table forms with `seatConfigs` of type
  `SIM` (and the `playerTypesSel: ['SIM']` default) normalize to open human
  seats, so an old saved form can never emit a SIM seat.
- Rendering of SIM seats in views/fixtures is kept (the fake fixtures still
  paint games with SIM seats); only *selection* is removed.
- The dev-only "AI vs AI demo" shortcut (`runDemoTable`, behind the
  `import.meta.env.DEV` tab) keeps using SIM.

### Out of scope (follow-up if ever wanted)

- Build-time exclusion of the SIM classes from the release jar (Maven profile).
  The default-off kill switch already means no deployment runs bots.
- Measured RTT / per-seat ping work (unrelated, tracked in memory).

## Verification

- `node scripts/test.mjs unit typecheck java` after the edits; then the full
  suite on a freshly restarted stack (self-test/human-test/verify run against
  the dev proxy with `--sim on`).
- Real-mode drift: e2e specs that used the UI defaults are rerun; e2e helpers
  keep creating SIM tables over WS (dev path).