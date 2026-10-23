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
| `verify` | 10 anti-drift scripts | `verify-player-leave` (runs first: it is the most sensitive), `multi-tenant-test`, `verify-wizard-matrix`, `verify-hand-permission`, `verify-spectator-end`, `verify-range-attack`, `verify-rollback-vote`, `verify-swiss`, `verify-tournament-watch`, `verify-report` (runs last) — the list lives in `VERIFY_SCRIPTS` in `scripts/test.mjs` | yes |
| `verify-restart` | reconnect check | `node scripts/verify-reconnect.mjs` — restarts the proxy, so it runs alone | yes |
| `fuzz` | self-play soak | `node scripts/fuzz.mjs` (20 games by default; nightly, not per push) | yes |
| `e2e` | Playwright | `npm --prefix web run test:e2e` | vite only (fake) / full stack (real) |
| `i18n` | coverage | `node scripts/i18n-coverage.mjs` | no |
| `scripts` | node --test | `node --test scripts/*.test.mjs` (dashboard and CI helpers; also a step of the `web` job in `web-ci.yml`) | no |

The stack layers wait for the proxy's `/ready`, not just for its port (a proxy that answers while still
building its card database fails every script with `Proxy is still loading card data`), and they warn when
the stack has been up for over an hour — a stale stack degrades the server's callback channel, which reads
exactly like a broken test. Restart with `node scripts/ctl.mjs restart all` before debugging.

Rules: after touching `web/`, run `unit` + `typecheck` (`build` if the build changed). After touching proxy Java, run `java` + rebuild the jar (`node scripts/build.mjs proxy`) + restart the proxy. Before declaring anything done, run the layers the change touches (for `web/`: `npm --prefix web run test:e2e:changed` runs only the specs the diff reaches; the full fake e2e when touching `e2e/support/`, `fixtures/` or the FakeServer; the stack layers when the proxy or the protocol changed) and check the remote CI, which runs the whole fake e2e in 4 shards plus a separate `@timing` job on every push.

## E2E: same specs, two backends

- Fake (default): `npm run test:e2e` — `FixtureServer` on a per-test dynamic WS port (the dedicated 8789 is its default; the Java proxy owns 8787/8788), vite on **5175** (`E2E_PORT` overrides it, so two Playwright runs can share the tree), deterministic scenarios in `web/fixtures/scenarios/`, helpers in `web/e2e/support/` (`frames`, `start-game`, `game-screen`, `scene`, `canvas`, `fake-backend`, `fake-mode`, `fake-port`, `info-windows`, `perf`, `timing`), fragile play via `wshelper.ts` `HumanHelper`. No Java, no flakes by design.
- Real (anti-drift): `E2E_BACKEND=real npm run test:e2e:real` — needs `node scripts/ctl.mjs start all`. Same specs against the live server; failures here mean protocol drift or timing, not logic bugs.
- Tags: `@spells` `@targeting` `@combat` `@fullflow` `@board` `@site` are the primary split and each has a `test:e2e:<tag>` script; `@reveal` `@draft` `@keywords` `@voting` `@planeswalker` `@chat` `@decks` `@latency` are secondary markers inside those files. `@timing` marks the tests whose verdict depends on wall-clock timing or animation ordering (`test:e2e:timing`): CI runs them in their own job with retries and excludes them from the shards. `test:e2e:changed` runs only the specs the diff reaches through their imports against `origin/master`: a diff that touches only `src/` usually selects zero specs and passes without running anything, so run the related specs by name as well. `test:e2e:site` runs a single spec, `test:e2e:visual` regenerates the gallery baselines.
- Assertions: `window.__mageScene` (published by `web/src/board/sceneBridge.ts`) + the DOM. The board renders in DOM/CSS — there is no canvas to pixel-diff. Failure artefacts: `web/test-results/` (screenshots, traces, `ws-frames`, `pageerrors`, `select-dump`).

## Recorded-frame pipeline (real protocol without depending on beta)

`scripts/record.mjs <mechanic|all>` drives a real local game (HUMAN+SIM, `skipInitShuffling`) and dumps the first `GAME_UPDATE` matching `captureWhen` to `web/fixtures/recorded/<mechanic>.json` (+ `manifest.json` invariants). `recorded.test.ts` validates each frame against the contract schema; `recorded.spec.ts` replays it in the FakeServer and asserts rendering. After proxy/web changes, regenerate with `record.mjs all` and commit the frames.

## Guard rails (behaviour specs: `docs/specs/testing.md`)

The quality gates the suite must keep, each held by a test that carries its rule id:

| Guard | Rule | Test |
|---|---|---|
| State integrity | `TST-1`/`TST-2` — no object in two zones; counts match; runs over every recorded frame | `web/src/state/gameInvariants.test.ts` |
| Fuzz triage | `TST-3` — a new anomaly signature fails the fuzz run until triaged | `scripts/fuzz-triage.test.mjs` |
| Nightly red gate | `TST-4` — integration/re-record/validate steps have no `continue-on-error` | `scripts/workflows.test.mjs` |
| Real-mode set | `TST-5` — every `@real` spec is in `REAL_E2E_SPECS` and vice versa | `scripts/integration-report.test.mjs` |
| Fail modes | `TST-6` — each guard is verified to be able to fail | `web/src/state/gameInvariants.test.ts` |

## Known flakes (do not "fix" by weakening tests)

- `self-test` `WATCHGAME` fails only on the first game after a cold server start (`SESSION CALLBACK EXCEPTION - Unable to create socket` in `server.out.log`). Retry warm; run `node scripts/warmup.mjs` first. Persistent failure across warm runs is a real bug — the one time it repeated for a whole day (2026-09-18) the shaded proxy jar was missing `ObjectNameFactory`, and some AI-vs-AI demo games simply end before the watch lands.
- Anonymous login to `beta.xmage.today` is stable (17/17 measured 2026-09-20). `Can't receive server state before other data` is **not** a handshake bug — it is logged on *any* failed login (the client fetches the server state only after login succeeds). The real cause is almost always a username longer than `maxUserNameLength` (**14**). Keep generated usernames ≤ 14 chars; the `FixtureServer` enforces this so fake mode catches it. The local server stays the CI oracle for determinism, not because beta is broken.
- Long real runs saturate `maxGameThreads=10` (abandoned matches keep running): restart server between heavy batches, purge with `node scripts/clean-tables.mjs`.
- Restart server + proxy **together** (`ctl.mjs restart all`); restarting only the proxy leaves the first login hanging (orphan sessions).
