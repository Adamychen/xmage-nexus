# Docs — XMage Nexus

Start here. This folder is the onboarding path for contributors and users.
Canonical references live elsewhere; this folder indexes them instead of duplicating them.

## Reading order

1. `readme.md` (repo root) — what the project is, stack versions.
2. `AGENTS.md` (repo root) — daily operations: stack control, ports, fake vs real E2E, Sim + WS helper.
3. `docs/architecture.md` — how the three tiers fit together.
4. `docs/code-map.md` — where everything lives, biggest files, what to split first.
5. `CONTRIBUTING.md` (repo root) — how to add an event, action, or type.
6. `Mage.Proxy/README.md` — full protocol reference (actions, events, serialization).
7. `docs/testing.md` — how to run and interpret the suite.
8. `docs/user-manual.md` — how to play (for users, also useful for testers).
9. `docs/deployment.md` — running the stack and publishing the dashboard.
10. `docs/enhancements.md` — high-value feature proposals beyond desktop parity (Deck Tracker, Deep Linking, Commander pings, Touch/iPad, EDHREC).

## Status docs (what is authoritative for what)

| Doc | Answers | Freshness rule |
|---|---|---|
| `PROJECT.md` | Master status: phases, lessons, quality table, dated work log | Update on every finished task (header date + work-log row) |
| `ROADMAP.md` | Vision, parity matrix, phased plan | Historical narrative; can lag `PROJECT.md` by design, but flag divergences |
| `web/INTERACTION_COVERAGE.md` | Per-callback and per-mechanic coverage: implemented + tested + test ref + date | Update with every handler/interaction change; enforced by `callbackCoverage.test.ts` |
| `lobby_roadmap.md` | Lobby feature matrix + Create-Table audit vs desktop `NewTableDialog` | Feature slice doc, referenced from `PROJECT.md` |
| `tcg-arena-ui-replica-spec.md` | Early visual spec (2472 lines) | Historical, **not normative**. Current behavior is defined by code + `INTERACTION_COVERAGE.md` + recorded fixtures |
| `site/content.json` | Dashboard copy (phases, features, guards) | Keep in sync with `PROJECT.md`/`ROADMAP.md` when phases change |

## Ports (do not change without updating `AGENTS.md`, `scripts/lib.mjs`, `docs/deployment.md`)

| Service | Address |
|---|---|
| XMage server (testMode) | `localhost:17171` |
| Proxy WS | `ws://127.0.0.1:8787` |
| Proxy HTTP test page | `http://127.0.0.1:8788/index.html` |
| Vite dev | `http://localhost:5173` |
| FakeServer (fake-mode E2E) | port `8789` |
| Fake-mode E2E Vite | port `5175` (`strictPort`, `reuseExistingServer:false`) |

## Quick commands

```bash
node scripts/ctl.mjs start all     # server + proxy + vite (non-blocking)
node scripts/ctl.mjs stop all
node scripts/test.mjs              # full suite (see docs/testing.md)
node scripts/tail.mjs proxy        # tail proxy logs (.run/*.log)
```
