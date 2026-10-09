# Testing — layers, commands, and known flakes

Orchestrator: `node scripts/test.mjs [layer...] [--skip=unit,e2e]`.

## Layers (in order)

| Layer | Tool | Command | Needs stack |
|---|---|---|---|
| `unit` | vitest | `npm --prefix web run test` | no |
| `coverage` | vitest --coverage | `npm --prefix web run test:coverage` | no |
| `typecheck` | tsc | `npm --prefix web run typecheck` | no |
| `build` | tsc + vite | `npm --prefix web run build` | no |
| `java` | Maven/JUnit | `mvn -f Mage.Proxy/pom.xml test` (needs the fork artifacts in `~/.m2`) | no (uses local `.m2`) |
| `self-test` | headless WS | `node scripts/self-test.mjs` | yes |
| `human-test` | WS driver | `node scripts/human-test.mjs` | yes |
| `verify` | 9 anti-drift scripts | `verify-player-leave` (runs first: it is the most sensitive), `multi-tenant-test`, `verify-wizard-matrix`, `verify-hand-permission`, `verify-spectator-end`, `verify-range-attack`, `verify-rollback-vote`, `verify-swiss`, `verify-tournament-watch` — the list lives in `VERIFY_SCRIPTS` in `scripts/test.mjs` | yes |
| `verify-restart` | reconnect check | `node scripts/verify-reconnect.mjs` — restarts the proxy, so it runs alone | yes |
| `fuzz` | self-play soak | `node scripts/fuzz.mjs` (20 games by default; nightly, not per push) | yes |
| `e2e` | Playwright | `npm --prefix web run test:e2e` | vite only (fake) / full stack (real) |
| `i18n` | coverage | `node scripts/i18n-coverage.mjs` | no |

The stack layers wait for the proxy's `/ready`, not just for its port (a proxy that answers while still
building its card database fails every script with `Proxy is still loading card data`), and they warn when
the stack has been up for over an hour — a stale stack degrades the server's callback channel, which reads
exactly like a broken test. Restart with `node scripts/ctl.mjs restart all` before debugging.

Rules: after touching `web/`, run `unit` + `typecheck` (`build` if the build changed). After touching proxy Java, run `java` + rebuild the jar (`node scripts/build.mjs proxy`) + restart the proxy. Before declaring anything done, run the full suite with the stack up.

## E2E: same specs, two backends

- Fake (default): `npm run test:e2e` — `FixtureServer` on a per-test dynamic WS port (the dedicated 8789 is its default; the Java proxy owns 8787/8788), vite on **5175**, deterministic scenarios in `web/fixtures/scenarios/`, helpers in `web/e2e/support/` (`frames`, `start-game`, `game-screen`, `scene`, `canvas`, `fake-backend`, `fake-mode`, `fake-port`, `info-windows`, `perf`, `timing`), fragile play via `wshelper.ts` `HumanHelper`. No Java, no flakes by design.
- Real (anti-drift): `E2E_BACKEND=real npm run test:e2e:real` — needs `node scripts/ctl.mjs start all`. Same specs against the live server; failures here mean protocol drift or timing, not logic bugs.
- Tags: `@spells` `@targeting` `@combat` `@fullflow` `@board` `@site` are the primary split and each has a `test:e2e:<tag>` script; `@reveal` `@draft` `@keywords` `@voting` `@planeswalker` `@chat` `@decks` `@latency` are secondary markers inside those files. `test:e2e:site` runs a single spec, `test:e2e:visual` regenerates the gallery baselines.
- Assertions: `window.__mageScene` (published by `web/src/board/sceneBridge.ts`) + the DOM. The board renders in DOM/CSS — there is no canvas to pixel-diff. Failure artefacts: `web/test-results/` (screenshots, traces, `ws-frames`, `pageerrors`, `select-dump`).

## Recorded-frame pipeline (real protocol without depending on beta)

`scripts/record.mjs <mechanic|all>` drives a real local game (HUMAN+SIM, `skipInitShuffling`) and dumps the first `GAME_UPDATE` matching `captureWhen` to `web/fixtures/recorded/<mechanic>.json` (+ `manifest.json` invariants). `recorded.test.ts` validates each frame against the contract schema; `recorded.spec.ts` replays it in the FakeServer and asserts rendering. After proxy/web changes, regenerate with `record.mjs all` and commit the frames.

## Known flakes (do not "fix" by weakening tests)

- `self-test` `WATCHGAME` fails only on the first game after a cold server start (`SESSION CALLBACK EXCEPTION - Unable to create socket` in `server.out.log`). Retry warm; run `node scripts/warmup.mjs` first. Persistent failure across warm runs is a real bug — the one time it repeated for a whole day (2026-09-18) the shaded proxy jar was missing `ObjectNameFactory`, and some AI-vs-AI demo games simply end before the watch lands.
- Anonymous login to `beta.xmage.today` is stable (17/17 measured 2026-09-20). `Can't receive server state before other data` is **not** a handshake bug — it is logged on *any* failed login (the client fetches the server state only after login succeeds). The real cause is almost always a username longer than `maxUserNameLength` (**14**). Keep generated usernames ≤ 14 chars; the `FixtureServer` enforces this so fake mode catches it. The local server stays the CI oracle for determinism, not because beta is broken.
- Long real runs saturate `maxGameThreads=10` (abandoned matches keep running): restart server between heavy batches, purge with `node scripts/clean-tables.mjs`.
- Restart server + proxy **together** (`ctl.mjs restart all`); restarting only the proxy leaves the first login hanging (orphan sessions).
