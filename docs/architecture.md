# Architecture — XMage Nexus

## Three tiers

```
Browser (React 19 + TS + Vite) ──WS JSON──▶ Mage.Proxy (Java 17) ──jboss-serialization──▶ XMage Server 1.4.61-V1
```

- **XMage Server** (`Mage.Server` fork): authoritative rules engine, card DB, multiplayer backend. Untouched except 2-3 `isTestMode()` guards in `TableController.java`.
- **Proxy** (`Mage.Proxy/`): a real `MageClient` via `SessionImpl`. Receives server callbacks, re-exposes them as JSON over WebSocket, forwards client actions. Zero game logic. Multi-tenant: one process serves many users; each browser WS owns (or attaches to) an XMage session.
- **Web** (`web/`): React client. Talks only to the proxy, never to `Mage.Common`. Pure DOM/CSS/SVG rendering (no canvas engine).

## Multi-tenant sessions

- `Gateway` keeps `byConn` (WS → session) and `byAccount` (`host|username` → session).
- A second connection with the same account **attaches** to the existing session (normal + incognito windows share one account). Different accounts are isolated.
- Deployment consequence: one proxy + one static web build serves many users. Each player sets the Proxy field to the shared proxy and the XMage Server field to the target server.

## Client state model

- **Protocol-first**: no optimistic mutations. Every action is an intent; the next `GAME_UPDATE` (full `GameView`) is the truth.
- **Snapshot-diff → animation**: the client diffs consecutive `GameView`s (card A hand→battlefield, B tapped) and drives declarative transitions (`gameTransitionEngine.ts`, `feedbackFx.ts`), sound (`soundManager.ts`), and the action feed (`ActionFeed.tsx`).
- **Single protocol truth**: `web/schema/contract.schema.json` → `web/src/net/types.generated.ts` (`npm run gen-types`). The FakeServer is typed against `web/src/net/types.ts`; frames are validated with `web/fixtures/schema.ts` (zod, generated via `scripts/gen-zod.mjs`).

## Two E2E backends, same specs

- **Fake (default)**: `FixtureServer` (`web/fixtures/fake.ts`) + declarative scenarios (`web/fixtures/scenarios/`, mini-engine `humanGame.ts`). Port 8789. No Java, deterministic, daily loop.
- **Real (anti-drift net)**: live server + proxy + vite (`E2E_BACKEND=real`). Catches protocol drift. Fragile actions go over the WS `HumanHelper` (`web/e2e/wshelper.ts`); the UI only verifies. The helper never answers the mulligan (web auto-keep does that).
- **SIM seats**: the proxy joins a deterministic bot (`SimPlayer.java`, own session) so tests and demos run without humans.

## Rendering and determinism

- `BoardScene` publishes `window.__mageScene` (cards, playable, targeting, game). Tests assert against that state + DOM, never canvas pixels.
- Recorded real frames (`scripts/record.mjs` → `web/fixtures/recorded/*.json` + `manifest.json`) are validated against the contract schema and replayed in fake E2E (`recorded.spec.ts`).
