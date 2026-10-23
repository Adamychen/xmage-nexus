#!/usr/bin/env node
// Nightly: runs the layers that need the real XMage stack (already started by the workflow) and
// writes reports/integration-result.json so gen-dashboard.mjs can consume it.
// Usage: node scripts/integration-report.mjs
//
// Two gates this file did not have, both learned on the Pages nightly runner:
//
//   * /ready, not just the port. A proxy that answers on 8787 while it is still building its
//     card database makes every script below fail with "Proxy is still loading card data" — a
//     real failure that reads exactly like a broken test. scripts/test.mjs has waited on /ready
//     for a while; this path (the Pages nightly) skipped it and reported three 0.3s failures as
//     an integration red.
//   * one warm-up game. The first game after a cold server can lose its callback socket
//     (SESSION CALLBACK EXCEPTION, WATCHGAME never arrives); a throwaway game eats that instead
//     of the suite.
//
// Failures print the tail of the command's output: without it a red layer in CI is a timestamp
// and nothing else, and the only way to find out what happened is to reproduce the whole nightly.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log, logError, PORTS, repoRoot, run, waitForPort } from "./lib.mjs";

const webDir = path.join(repoRoot, "web");

const REAL_E2E_SPECS = [
  "deckvalidation.spec.ts",
  "multi-user.spec.ts",
  "priority-stop-real.spec.ts",
  "skips.spec.ts",
  "full-flow.spec.ts",
  "reconnect-real.spec.ts",
  "smart-mana-real.spec.ts",
  "smart-stops-real.spec.ts",
  "xmage-catalog-real.spec.ts",
  "learn-real.spec.ts",
  "draft-real-reload.spec.ts",
];

const LAYERS = [
  { key: "selfTest", label: "self-test", cmd: "node", args: ["scripts/self-test.mjs"], cwd: repoRoot, timeoutMs: 1_800_000 },
  { key: "humanTest", label: "human-test", cmd: "node", args: ["scripts/human-test.mjs"], cwd: repoRoot, timeoutMs: 1_800_000 },
  { key: "verify", label: "verify", cmd: "node", args: ["scripts/test.mjs", "verify"], cwd: repoRoot, timeoutMs: 2_400_000 },
  { key: "verifyRestart", label: "verify-restart", cmd: "node", args: ["scripts/test.mjs", "verify-restart"], cwd: repoRoot, timeoutMs: 1_800_000 },
  {
    key: "e2eReal",
    label: "e2e-real",
    cmd: "npx",
    args: ["playwright", "test", ...REAL_E2E_SPECS],
    cwd: webDir,
    timeoutMs: 1_800_000,
    env: {
      E2E_BACKEND: "real",
      E2E_SERVER_HOST: process.env.E2E_SERVER_HOST || "127.0.0.1",
      E2E_SERVER_PORT: process.env.E2E_SERVER_PORT || "17171",
    },
  },
];

export function failedStatus(note) {
  const status = { generatedAt: new Date().toISOString() };
  for (const layer of LAYERS) status[layer.key] = "fail";
  status.status = "fail";
  status.note = note;
  return status;
}

export function writeIntegrationResult(status, dir = path.join(repoRoot, "reports")) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "integration-result.json"), JSON.stringify(status, null, 2));
}

async function tcpUp(port, timeoutMs = 5000) {
  try {
    await waitForPort(port, timeoutMs)
    return true
  } catch {
    return false
  }
}

/** One request to the proxy's HTTP endpoint, or null when it does not answer. */
async function proxyHttp(pathname) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORTS.proxyHttp}${pathname}`, {
      signal: AbortSignal.timeout(3000),
    })
    return await res.json()
  } catch {
    return null
  }
}

/** True once the proxy answers /ready with ready: true (card database built). */
async function waitForReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    const ready = await proxyHttp("/ready")
    last = ready
    if (ready?.ready === true) return true
    await new Promise((r) => setTimeout(r, 3000))
  }
  logError(`the proxy never reached /ready (${JSON.stringify(last)})`)
  return false
}

/** Say out loud when the stack is old: a degraded callback channel reads like a product bug. */
async function warnIfStackStale() {
  const health = await proxyHttp("/health")
  if (!health) return
  const minutes = Math.round((health.uptimeSeconds ?? 0) / 60)
  const sessions = health.sessions ?? 0
  if (minutes >= 60 || sessions >= 20) {
    log(`WARNING: the stack has been up ${minutes} min with ${sessions} sessions; if layers fail with`)
    log(`         "no views" or timeouts, that is the cause — restart it (node scripts/ctl.mjs restart all)`)
  }
}

function tail(text, lines = 25) {
  return (
    (text ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-lines)
      .join("\n")
  )
}

async function main() {
  const status = { generatedAt: new Date().toISOString() }

  const serverUp = await tcpUp(PORTS.server)
  const proxyUp = await tcpUp(PORTS.proxy)
  if (!serverUp || !proxyUp) {
    // Do not run anything: every layer would fail for the same environmental reason and the
    // report would blame the code.
    logError(`stack not up (server=${serverUp} proxy=${proxyUp}) — reporting the layers as failed without running them`)
    for (const layer of LAYERS) status[layer.key] = "fail"
    status.status = "fail"
    status.note = `stack not up (server=${serverUp} proxy=${proxyUp})`
  } else {
    await warnIfStackStale()
    if (!(await waitForReady(600_000))) {
      logError("proxy still loading card data after 10 min — reporting the layers as failed without running them")
      for (const layer of LAYERS) status[layer.key] = "fail"
      status.status = "fail"
      status.note = "proxy never reached /ready"
    } else {
      // One throwaway game clears the cold-server callback failure (see the header comment).
      const warmStart = Date.now()
      const warm = run("node", ["scripts/warmup.mjs"], { quiet: true })
      const secs = ((Date.now() - warmStart) / 1000).toFixed(1)
      log(`warmup ${warm.code === 0 ? "ok" : "FAILED (continuing, the layers retry on their own)"} in ${secs}s`)

      for (const layer of LAYERS) {
        const started = Date.now()
        const res = run(layer.cmd, layer.args, { cwd: layer.cwd, timeoutMs: layer.timeoutMs, env: layer.env })
        const secs = ((Date.now() - started) / 1000).toFixed(1)
        status[layer.key] = res.code === 0 ? "pass" : "fail"
        log(`${layer.label}: ${status[layer.key]} (${secs}s)`)
        if (res.code !== 0) {
          const out = tail(`${res.stdout}\n${res.stderr}`)
          if (out) console.log(`--- ${layer.label} output (last lines) ---\n${out}\n---`)
        }
      }
      status.status = Object.values(status).includes("fail") ? "fail" : "pass"
    }
  }

  writeIntegrationResult(status);
  console.log("[integration-report] " + JSON.stringify(status));
  process.exit(status.status === "pass" ? 0 : 1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => {
  console.error(e);
  const message = e && e.message ? e.message : String(e);
  writeIntegrationResult(failedStatus(`integration-report crashed: ${message}`));
  process.exit(1);
});
