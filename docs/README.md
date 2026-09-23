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
11. `docs/lessons.md` — durable cross-cutting lessons worth re-reading before debugging.

## Status docs (what is authoritative for what)

| Doc | Answers | Freshness rule |
|---|---|---|
| `ROADMAP.md` | Vision, current state, parity matrix and **the single live list of pending work** (§4) | Update §4 when something is finished or a new pending item appears; the closed phase plan is archived in `docs/history/roadmap-phases.md` |
| `docs/lessons.md` | Durable cross-cutting lessons (one line each) | Add a line only when the lesson is reusable; the dated narrative lives in `git log` (no work log) |
| `web/INTERACTION_COVERAGE.md` | Per-callback and per-mechanic coverage: implemented + tested + test ref + date | Update with every handler/interaction change; enforced by `callbackCoverage.test.ts` |
| `docs/enhancements.md` | Spec catalog of client-only feature ideas, with per-idea status | Statuses verified against the code; pending items are summarized in `ROADMAP.md` §4.2 |
| `docs/history/` | Closed plans (`plan4`–`plan7`), the archived phase plan (`roadmap-phases.md`), the closed lobby roadmap (`lobby_roadmap.md`) and QA evidence logs (`qa/`) | Historical, **not normative**. Current behavior is defined by code + `INTERACTION_COVERAGE.md` + recorded fixtures; what is still open lives in `ROADMAP.md` §4 |
| `site/content.json` | Dashboard copy (phases, features, guards) | Keep in sync with `ROADMAP.md` when phases change |

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
