# Testing — layers, commands, and known flakes

Orchestrator: `node scripts/test.mjs [layer...] [--skip=unit,e2e]`.

## Layers (in order)

| Layer | Tool | Command | Needs stack |
|---|---|---|---|
| `unit` | vitest | `npm --prefix web run test` | no |
| `coverage` | vitest --coverage | `npm --prefix web run test:coverage` | no |
| `typecheck` | tsc | `npm --prefix web run typecheck` | no |
| `build` | tsc + vite | `npm --prefix web run build` | no |
| `java` | Maven/JUnit | `mvn -pl Mage.Proxy -am test` | no (uses local `.m2`) |
| `self-test` | headless WS | `node scripts/self-test.mjs` | yes |
| `human-test` | WS driver | `node scripts/human-test.mjs` | yes |
| `e2e` | Playwright | `npm --prefix web run test:e2e` | vite only (fake) / full stack (real) |
| `i18n` | coverage | `node scripts/i18n-coverage.mjs` | no |

Rules: after touching `web/`, run `unit` + `typecheck` (`build` if the build changed). After touching proxy Java, run `java` + rebuild the jar (`node scripts/build.mjs proxy`) + restart the proxy. Before declaring anything done, run the full suite with the stack up.

## E2E: same specs, two backends

- Fake (default): `npm run test:e2e` — `FixtureServer` on port 8789, deterministic scenarios in `web/fixtures/scenarios/`, helpers in `web/e2e/support/` (`frames`, `start-game`, `game-screen`, `scene`, `fake-backend`), fragile play via `wshelper.ts` `HumanHelper`. No Java, no flakes by design.
- Real (anti-drift): `E2E_BACKEND=real npm run test:e2e:real` — needs `node scripts/ctl.mjs start all`. Same specs against the live server; failures here mean protocol drift or timing, not logic bugs.
- Tags: `@spells` `@targeting` `@combat` `@fullflow` (+ `@reveal` `@draft` `@keywords` `@voting` `@planeswalker` suites). Scripts: `test:e2e:spells|targeting|combat|fullflow`.
- Assertions: `window.__mageScene` + DOM. Never canvas pixels. Failure artefacts: `web/test-results/` (screenshots, traces, `ws-frames`, `pageerrors`, `select-dump`).

## Recorded-frame pipeline (real protocol without depending on beta)

`scripts/record.mjs <mechanic|all>` drives a real local game (HUMAN+SIM, `skipInitShuffling`) and dumps the first `GAME_UPDATE` matching `captureWhen` to `web/fixtures/recorded/<mechanic>.json` (+ `manifest.json` invariants). `recorded.test.ts` validates each frame against the contract schema; `recorded.spec.ts` replays it in the FakeServer and asserts rendering. After proxy/web changes, regenerate with `record.mjs all` and commit the frames.

## Known flakes (do not "fix" by weakening tests)

- `self-test` `WATCHGAME` fails only on the first game after a cold server start (`SESSION CALLBACK EXCEPTION - Unable to create socket` in `server.out.log`). Retry warm; run `node scripts/warmup.mjs` first. Persistent failure across warm runs is a real bug.
- Anonymous login to `beta.xmage.today` is intermittent (`Can't receive server state before other data`, server-side handshake). Beta is best-effort; the local server is the CI oracle.
- Long real runs saturate `maxGameThreads=10` (abandoned matches keep running): restart server between heavy batches, purge with `node scripts/clean-tables.mjs`.
- Restart server + proxy **together** (`ctl.mjs restart all`); restarting only the proxy leaves the first login hanging (orphan sessions).
