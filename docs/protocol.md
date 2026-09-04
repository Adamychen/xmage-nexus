# Protocol — where the truth lives

Canonical reference: `Mage.Proxy/README.md` (full action/event tables, serialization rules, type system).
This page only states precedence and regeneration rules so the contract never drifts silently.

## Precedence

1. Wire behavior: XMage server 1.4.61-V1 (`mage.view.*` serialized by `JsonUtil` reflection, camelCase 1:1).
2. Documented contract: `Mage.Proxy/README.md`.
3. Typed contract: `web/schema/contract.schema.json` → generated `web/src/net/types.generated.ts` (views) and `web/fixtures/schema.generated.ts` (zod).
4. Hand-written protocol surface: `web/src/net/types.ts` (envelopes `ProxyMessage/LobbyEnvelope/ResultEnvelope/EventEnvelope` + `EVENT_METHODS`).

If (2) and (3) disagree, fix (3) by regeneration, then fix the code. Never hand-edit generated files.

## Message shapes

- Client → proxy: `{"requestId", "action", "args"}`. Lobby + game + chat + `validateDeck` + `sendPlayer{Action,UUID,Boolean,Integer,String,ManaType}` (+ `HOLD_PRIORITY`/`UNHOLD_PRIORITY`).
- Proxy → client: `{type: "event", method, messageId, objectId, data}` for server callbacks; lobby broadcasts; result envelopes for request/response.
- `JsonUtil` rules: UUID/Enum → string, Date → epoch millis, `Optional` unwrapped, null/static/transient/logger/`Class`/`Throwable` skipped, cycles → null.

## Key semantics (do not re-derive, verified against the live server)

- `sendPlayerBoolean(true)` on a mulligan ask takes the mulligan; `false` keeps. For priority (`GAME_SELECT`), any boolean passes.
- London mulligan bottoming arrives as `GAME_TARGET` with card UUIDs in `targets` (not `cardsView1`).
- Starting-player choice is random; if the human wins, a blocking `GAME_TARGET` with a player UUID arrives.
- `GAME_PLAY_MANA` carries no color hints (`data.options` is only `{queryType: PLAY_MANA}`): tap mana sources from `canPlayObjects`, then pay from the pool with `sendPlayerManaType`.
- `validateDeck` is advisory only (`ready:false` never blocks): distinguishes `OUTDATED_PRINTING` / `UNIMPLEMENTED` (`missing`) from silent-swap `mismatches`, returns `fixedDeck` + per-card `suggestions`.
- `connect` is idempotent per `host|username`: reconnects attach, never restart an active session.

## Regeneration

```bash
cd web
npm run gen-types && npm run gen-zod && npm run gen-server-state
npm run gen-types:validate && npm run gen-zod:validate && npm run gen-server-state:validate
```

## Anti-drift guards (all run in `unit`)

- `callbackCoverage.test.ts` — every `ClientCallbackMethod` has a handler in `eventHandler.ts`/`feedback.ts` or is allow-listed, and `INTERACTION_COVERAGE.md` lists it.
- `mechanicsCoverage.test.ts` — every field the server *can* emit (`scripts/view-schema.mjs` → `server-view-schema.json`) is modeled in `contract.schema.json`.
- `engineViewCoverage.test.ts` — engine state not copied into view DTOs is tracked against `engine-view-gap.baseline.json` (e.g. `harnessed`/`monstrous`/`renowned`/player abilities are server-invisible by design; `goad` arrives via `rules` + `cardIcons`, not a dedicated field).
- `serverStateCoverage.test.ts` — game/deck types from `config.xml` stay covered.
