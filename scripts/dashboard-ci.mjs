#!/usr/bin/env node
// Runs the lightweight CI layers, writes markers and generates the dashboard.
// Usage: node scripts/dashboard-ci.mjs
// Layers: unit+coverage (vitest), typecheck, build, fake-e2e, mcp, proxy java.
// Raw results are left in web/ so gen-dashboard.mjs can consume them.
// DASHBOARD_SKIP_E2E=1 skips the fake e2e (set by pages.yml on push: web-ci.yml runs the suite
// sharded on every push, and the nightly/dispatch Pages run executes it here).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run, binName, repoRoot, ensureMageArtifacts } from "./lib.mjs";
import { build } from "./gen-dashboard.mjs";
import { enforceCoverageGate } from "./coverage-gate.mjs";

const webDir = path.join(repoRoot, "web");
const mcpDir = path.join(repoRoot, "mcp");

function writeMarker(name, status, extra) {
  fs.writeFileSync(path.join(webDir, name), JSON.stringify({ status, ...extra }));
}

function clearReports(...files) {
  for (const f of files) fs.rmSync(path.join(webDir, f), { force: true });
}

async function main() {
  // 1. Unit + coverage (a single vitest run emits both artifacts)
  clearReports("test-results.json", path.join("coverage", "coverage-summary.json"));
  const vitest = run("npm", ["run", "test:coverage", "--", "--reporter=json", "--outputFile=test-results.json"], {
    cwd: webDir,
    timeoutMs: 600_000,
  });
  let vitestStatus = vitest.code === 0 ? "pass" : "fail";
  const vitestExtra = { code: vitest.code };
  if (vitest.code === 0) {
    // Coverage no-regression gate (TST-6): fail when a metric drops >1 pt vs the previous run.
    const gate = enforceCoverageGate();
    if (!gate.ok) {
      vitestStatus = "fail";
      vitestExtra.gate = gate.message;
      console.error("[dashboard-ci]", gate.message);
    }
  }
  writeMarker(".vitest.json", vitestStatus, vitestExtra);

  // 2. Typecheck
  const tc = run("npm", ["run", "typecheck"], { cwd: webDir, timeoutMs: 300_000 });
  writeMarker(".typecheck.json", tc.code === 0 ? "pass" : "fail");

  // 3. Build
  const b = run("npm", ["run", "build"], { cwd: webDir, timeoutMs: 300_000 });
  writeMarker(".build.json", b.code === 0 ? "pass" : "fail");

  // 4. Fake E2E (no XMage stack needed; vite starts on its own).
  // The JSON reporter writes its file via env (there is no --output-file flag).
  if (process.env.DASHBOARD_SKIP_E2E === "1") {
    console.log("[dashboard-ci] fake e2e skipped (DASHBOARD_SKIP_E2E=1): runs in Web client CI and nightly");
  } else {
    clearReports("e2e-results.json");
    const e2e = run("npx", ["playwright", "test", "--reporter=json"], {
      cwd: webDir,
      timeoutMs: 1_800_000,
      env: { PLAYWRIGHT_JSON_OUTPUT_NAME: "e2e-results.json" },
    });
    writeMarker(".e2e.json", e2e.code === 0 ? "pass" : "fail", { code: e2e.code });
    if (e2e.code !== 0) {
      console.log("e2e stdout (tail):", e2e.stdout.slice(-2000));
      console.log("e2e stderr (tail):", e2e.stderr.slice(-2000));
    }
  }

  // 5. MCP (typecheck + hermetic tests against the FixtureServer, no Java)
  const mcpTc = run("npm", ["run", "typecheck"], { cwd: mcpDir, timeoutMs: 300_000 });
  const mcpTest = run("npm", ["run", "test"], { cwd: mcpDir, timeoutMs: 600_000 });
  if (mcpTc.code !== 0) console.log("mcp typecheck stderr (tail):", mcpTc.stderr.slice(-2000));
  if (mcpTest.code !== 0) {
    console.log("mcp test stdout (tail):", mcpTest.stdout.slice(-2000));
    console.log("mcp test stderr (tail):", mcpTest.stderr.slice(-2000));
  }
  writeMarker(".mcp-tests.json", mcpTc.code === 0 && mcpTest.code === 0 ? "pass" : "fail");

  // 6. Proxy (java). Needs the org.mage artifacts in ~/.m2 (the fork release downloaded in CI,
  //    a local build on a development machine)
  fs.rmSync(path.join(repoRoot, "Mage.Proxy", "target", "surefire-reports"), { recursive: true, force: true });
  ensureMageArtifacts();
  const java = run(binName("mvn"), ["-f", "Mage.Proxy/pom.xml", "test"], { timeoutMs: 900_000 });
  writeMarker(".proxy.json", java.code === 0 ? "pass" : "fail", { code: java.code });
  if (java.code !== 0) {
    console.log("java stdout (tail):", java.stdout.slice(-3000));
    console.log("java stderr (tail):", java.stderr.slice(-2000));
  }

  // 7. Generate status.json
  build();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
