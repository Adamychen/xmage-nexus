# XMage Nexus — Modern Web Client for XMage

**XMage Nexus** is a modern, high-performance web client for [XMage](https://github.com/magefree/mage), featuring a visual aesthetic inspired by modern digital card games. Play directly in the browser **without installing Java or desktop apps**.

> **Note:** XMage Nexus is an independent modern client interface. The rules engine and card database remain the battle-tested XMage Java server (`Mage.Server`).

## Architecture

```
┌──────────────────────────┐   WS JSON    ┌────────────────────┐   XMage protocol    ┌───────────────────┐
│  XMage Nexus Web Client  │ ──────────▶ │ Proxy Java (Mage   │ ─────────────────── │ Server XMage        │
│  React 19 + PixiJS 8     │ ◀────────── │ .Proxy)            │ ◀────────────────── │ (Mage.Server)       │
│  WebGL2 Rendering        │              │ WebSocket :8787    │                     │ 1.4.61-V1           │
└──────────────────────────┘              └────────────────────┘                     └───────────────────┘
```

- **XMage Server** (`Mage.Server/`): rules engine, card database (+25,000 cards) and networking (Java). Existing project.
- **WebSocket Proxy** (`Mage.Proxy/`): high-throughput bridge that translates between JSON/WebSocket and the XMage serialization protocol.
- **Web Client** (`web/`): React 19 + PixiJS 8 (WebGL2) client rendering the board, animations, targeting, audio, and lobby UI.

## Tech Stack

| Layer | Technologies |
|---|---|
| XMage Server | Java 17, jboss-remoting (1.4.61-V1) |
| WebSocket Proxy | Java 17, Java-WebSocket, Gson (`Mage.Proxy`) |
| Web Client | React 19, PixiJS 8 (WebGL2), TypeScript, Vite 8, Vitest, Playwright |

## Requirements

| Component | Minimum | Verified / CI | Notes |
|---|---|---|---|
| **JDK** | 17 | Temurin 17.0.20 (CI), 17+ locally | Required for `Mage.Server` + `Mage.Proxy`. The scripts auto-resolve the real binary (macOS `/usr/bin/java` stub is bypassed via `scripts/lib.mjs:130`). |
| **Maven** | 3.9+ | 3.9.16 | Required only for the full stack. Not needed for web-only work. |
| **Node.js** | 20+ | 22 (CI), 24.19.0 (local dev) | `web/` uses Vite 8 / Vitest / Playwright. |
| **npm** | 10+ | 10.x | `web/package.json` uses `npm`. `pnpm` also works. |
| **OS** | Windows / macOS / Linux (incl. WSL) | Ubuntu (CI), macOS darwin (local) | No OS-specific steps beyond installing JDK/Maven/Node. |

Check your toolchain before installing:

```bash
java -version   # must report 17.x
mvn -version    # 3.9.x
node --version  # >=20 (22 recommended)
npm --version
```

> If `ulimit -n` reports `< 10240` on macOS/Linux, raise it before starting the stack (`ulimit -n 65536`). A low descriptor limit can break server callbacks under load (`scripts/lib.mjs:168`).

## Installation

Clone once:

```bash
git clone https://github.com/Adamychen/xmage-nexus.git
cd xmage-nexus
```

Pick the variant that matches what you want to do. `web/` is fully isolated — you do **not** need Java/Maven to work on the client alone (`web/AGENTS.md`). The full stack is only required for real games against the XMage rules engine.

### Variant A — Web-only (no Java, no Maven, fastest loop)

For UI work, board rendering, lobby, animations, and deterministic tests against the local fixture server.

```bash
# 1. Install web dependencies (once)
npm --prefix web install
# or: cd web && npm install

# 2. Run the dev server
npm --prefix web run dev        # http://localhost:5173
# or: cd web && npm run dev

# 3. Verify (no stack required)
npm --prefix web run test       # vitest unit
npm --prefix web run typecheck  # tsc -b --noEmit
npm --prefix web run build      # production build
npm --prefix web run test:e2e:fake  # Playwright against FakeServer on :8789 (deterministic)
```

The fake E2E mode (`FakeServer` in `web/fixtures/fake.ts`) speaks the real WebSocket protocol derived from `web/src/net/types.ts` but runs entirely in Node — no proxy, no XMage server, no flakes. Playwright auto-starts Vite in this mode (`web/playwright.config.ts:12`).

### Variant B — Full stack (real XMage server + proxy + web client)

For real games (human vs AI, Sim bots), protocol work, or anti-drift validation against the live server.

```bash
# 1. One-command setup: builds the fork into ~/.m2, copies plugins, installs web deps
node scripts/install.mjs
# Steps performed: check tools → mvn install Mage.Common/Mage/Mage.Sets/Mage.Server
#                 → mvn install plugins → copy jars to local-server/plugins/ → npm install in web
# Equivalent manual alternative:
#   node scripts/build.mjs          # full build: server + plugins + proxy
#   npm --prefix web install

# 2. Start the stack (background, logs in .run/*.log)
node scripts/ctl.mjs start all
# Diagnostic foreground alternative (blocks the shell):
#   node scripts/dev.mjs start

# 3. Verify the stack is up
node scripts/ctl.mjs status
node scripts/tail.mjs all 25
# Expected: server :17171, proxy WS :8787, Vite :5173 — all RUNNING
```

Individual service control:

```bash
node scripts/ctl.mjs start|stop|restart [server|proxy|vite|all]
node scripts/ctl.mjs status
node scripts/tail.mjs [server|proxy|vite|all] [lines]   # .run/*.log
```

Rebuild after editing proxy Java:

```bash
node scripts/build.mjs proxy          # proxy jar only (assumes fork already in ~/.m2)
node scripts/ctl.mjs restart proxy

# Full rebuild (server + plugins + proxy):
node scripts/build.mjs
```

> The proxy jar is `Mage.Proxy/target/mage-proxy-1.4.61.jar` (`1.4.61-V1`, `pom.xml:5`). Changing the XMage version requires updating the parent pom + rebuilding everything.

### Ports & URLs

| Service | URL | Notes |
|---|---|---|
| Web Client (Vite dev) | `http://localhost:5173` | `vite.config.ts:6` |
| Proxy WebSocket | `ws://127.0.0.1:8787` | `scripts/lib.mjs:15` |
| Proxy HTTP (test page) | `http://127.0.0.1:8788/index.html` | Served by the proxy itself |
| FakeServer (E2E fake) | `ws://127.0.0.1:8789` | Fake E2E only; `8788` is owned by the real proxy — do not reuse (`web/AGENTS.md:21`) |
| XMage Server (testMode) | `127.0.0.1:17171` / `beta.xmage.today:17171` | Local server is the reliable oracle; `beta.xmage.today` anonymous login is best-effort (`PROJECT.md:30`) |

### Verifying the installation

```bash
# Web-only layers (no stack required):
node scripts/test.mjs unit typecheck build
# or individually:
npm --prefix web run test
npm --prefix web run typecheck
npm --prefix web run build

# With the full stack running:
node scripts/test.mjs java            # mvn -pl Mage.Proxy -am test (18 tests)
node scripts/test.mjs self-test       # headless E2E via ws://127.0.0.1:8787
node scripts/test.mjs human-test      # human vs AI flow
node scripts/test.mjs e2e             # Playwright (fake by default)
E2E_BACKEND=real npm --prefix web run test:e2e:real  # real-stack E2E (anti-drift)

# Everything:
node scripts/test.mjs all
```

After `ctl.mjs start all`, `node scripts/ctl.mjs status` should show `server`, `proxy`, and `vite` as `RUNNING`. If the proxy or Vite port is not yet listening, wait a few seconds and retry — `dev.mjs` waits up to 60s for the server/Vite and 30s for the proxy.

### Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `java -version` reports wrong version or `java` not found | Install Temurin 17 (`https://adoptium.net`), ensure `JAVA_HOME` points to JDK 17. On macOS the `/usr/bin/java` stub fails if no JDK is registered — `scripts/lib.mjs:130` auto-resolves Homebrew paths (`/opt/homebrew/opt/openjdk@17`, `/usr/local/opt`). |
| `mvn: command not found` | Install Maven 3.9+ and add it to `PATH`. Web-only work does not require Maven. |
| `vite` not found / `npm install` errors | Run `npm --prefix web install` from the repo root; Node 20+ required. |
| Proxy fails with `MAGE_VERSION_RELEASE_INFO_MUST_BE_SAME` | Client/proxy/server version mismatch. Rebuild everything: `node scripts/build.mjs` + `node scripts/ctl.mjs restart all`. Fork version is `1.4.61` (`pom.xml:5`). |
| `Can't receive server state before other data` / beta login fails | Server-side handshake issue on `beta.xmage.today` (intermittent, not fixable by the proxy). Use the local server `localhost:17171` as the reliable oracle (`PROJECT.md:30`). |
| `SESSION CALLBACK EXCEPTION - Unable to create socket` on first game after cold start | Known warm-up race. `scripts/test.mjs:107` runs `scripts/warmup.mjs` automatically; or restart `server+proxy` together (`node scripts/ctl.mjs restart all` — never restart only the proxy when the server is cold, `scripts/dev.mjs:23`). |
| `ulimit -n` warnings / many open sockets | Raise the file descriptor limit before starting: `ulimit -n 65536` (see `scripts/lib.mjs:168`). |
| Port already in use (`8787`/`8788`/`5173`/`17171`) | Another `ctl.mjs`/`dev.mjs` instance is running. `node scripts/ctl.mjs stop all` then `start all`. Fake E2E uses dedicated `8789` so it can run alongside the real proxy. |
| Types out of sync after XMage update | Regenerate: `npm --prefix web run gen-types && npm --prefix web run gen-zod`, then `npm --prefix web run gen-types:validate` / `gen-zod:validate`. |

## Tests

```bash
# Full test suite
node scripts/test.mjs all

# Individual layers
node scripts/test.mjs unit            # unit tests (vitest)
node scripts/test.mjs typecheck       # tsc -b --noEmit
node scripts/test.mjs build           # web client build
node scripts/test.mjs java            # mvn test (proxy)
node scripts/test.mjs self-test       # headless E2E against real proxy
node scripts/test.mjs e2e             # browser tests (Playwright)

# E2E: fake mode (deterministic, local fixture, no real stack)
npm run test:e2e:fake

# E2E: real mode (against server + proxy + vite)
E2E_BACKEND=real npm run test:e2e:real

# E2E by domain
npm run test:e2e:spells
npm run test:e2e:targeting
npm run test:e2e:combat
npm run test:e2e:fullflow
```

> **Note:** Fake mode (default) does not require a real stack. Real mode detects protocol drift and runs in CI/nightly.

## Documentation

- **[PROJECT.md](PROJECT.md)** — master document: roadmap, phases, technical decisions, project status.
- **[AGENTS.md](AGENTS.md)** — development rules, commands, conventions, known bugs.

## License

This web client is a separate project from the XMage server. See [LICENSE.txt](LICENSE.txt) for details.
