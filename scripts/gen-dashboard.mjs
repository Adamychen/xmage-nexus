#!/usr/bin/env node
// Generates site/status.json from the test artifacts and site/content.json.
// Usage: node scripts/gen-dashboard.mjs
// Inputs (produced by CI):
//   web/test-results.json                  (vitest --reporter=json --outputFile)
//   web/coverage/coverage-summary.json      (vitest coverage json-summary)
//   web/e2e-results.json                    (playwright JSON reporter, PLAYWRIGHT_JSON_OUTPUT_NAME)
//   Mage.Proxy/target/surefire-reports/*.xml (proxy junit)
//   reports/integration-result.json         (nightly, real stack)
// Environment: GITHUB_SHA, GITHUB_RUN_URL, DASHBOARD_SKIP_E2E (1 = fake e2e not run in this run)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(repoRoot, "site");
const webDir = path.join(repoRoot, "web");
const outPath = path.join(siteDir, "status.json");

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function layer(name, label, status, extra) {
  return Object.assign({ name, label, status: status || "pending" }, extra || {});
}

// Version autoritativa de la app (la misma que verifica release.yml en el tag).
function readLauncherVersion() {
  try {
    const txt = fs.readFileSync(
      path.join(repoRoot, "launcher", "src-tauri", "Cargo.toml"),
      "utf8",
    );
    const m = txt.match(/\[package\][\s\S]*?version\s*=\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function readVitest() {
  const d = readJson(path.join(webDir, "test-results.json"));
  if (!d) return null;
  const total = d.numTotalTests ?? 0;
  const passed = d.numPassedTests ?? 0;
  const failed = d.numFailedTests ?? (d.numTotalTests ?? 0) - (d.numPassedTests ?? 0);
  let durationMs = null;
  if (typeof d.startTime === "number" && typeof d.endTime === "number") {
    durationMs = d.endTime - d.startTime;
  } else if (Array.isArray(d.testResults)) {
    durationMs = d.testResults.reduce((s, t) => s + (t.duration || 0), 0);
  }
  return { total, passed, failed, durationMs };
}

function readPlaywright() {
  const d = readJson(path.join(webDir, "e2e-results.json"));
  if (!d || !d.stats) return null;
  const s = d.stats;
  return {
    total: s.total ?? 0,
    passed: s.expected ?? 0,
    failed: s.unexpected ?? 0,
    durationMs: s.duration ?? null,
  };
}

function readCoverage() {
  const d = readJson(path.join(webDir, "coverage", "coverage-summary.json"));
  if (!d || !d.total) return null;
  const t = d.total;
  const pick = (k) => (t[k] && typeof t[k].pct === "number" ? t[k].pct : null);
  return {
    lines: pick("lines"),
    functions: pick("functions"),
    branches: pick("branches"),
    statements: pick("statements"),
  };
}

function markerStatus(dir, name) {
  const m = readJson(path.join(dir, name));
  return m && (m.status === "pass" || m.status === "fail") ? m.status : null;
}

// Joins the committed baseline (source of truth for the engineViewCoverage guard)
// with the human-readable annotations in content.json. If an annotated field is no longer
// in the baseline (upstream exposes it now), it is marked exposed so the dashboard does not drift.
function buildEngineGaps(baseline, content) {
  const display = (content && content.displayGaps) || {};
  const entries = [];
  let totalMissing = 0;
  const baselineMissing = {};
  for (const [view, info] of Object.entries(baseline || {})) {
    const m = (info && info.missing) || [];
    baselineMissing[view] = new Set(m);
    totalMissing += m.length;
  }
  for (const [view, fields] of Object.entries(display)) {
    for (const [field, a] of Object.entries(fields)) {
      const present = baselineMissing[view] && baselineMissing[view].has(field);
      const exposed = !present;
      entries.push({
        view,
        field,
        mechanic: a.mechanic || field,
        shown: !!a.shown && !exposed,
        via: exposed
          ? "upstream ahora expone este campo — modelar en cliente"
          : a.via || "no emitido en mage.view.*",
        exposed: exposed,
      });
    }
  }
  return { totalMissing, entries };
}

// Reverse drift (server->client): every field the server can emit
// (oracle server-view-schema.json) must be modeled in contract.schema.json.
// Self-synchronizing: reads both committed artifacts, no manual list.
function buildReverseCoverage() {
  const oracle = readJson(path.join(webDir, "fixtures", "server-view-schema.json"));
  const contract = readJson(path.join(webDir, "schema", "contract.schema.json"));
  if (!oracle || !contract) return null;

  const defs = (contract.definitions) || {};
  const propsOf = (...names) => {
    const s = new Set();
    for (const n of names) {
      const d = defs[n];
      if (d && d.properties) for (const k of Object.keys(d.properties)) s.add(k);
    }
    return s;
  };
  const ALLOWED_EXTRA = new Set();

  const groups = [
    { key: "card", label: "Card / Permanent", emitted: oracle.cardFields || [], modeled: propsOf("CardView", "PermanentView") },
    { key: "player", label: "Player", emitted: oracle.playerFields || [], modeled: propsOf("PlayerView") },
    { key: "gameView", label: "GameView", emitted: oracle.gameViewFields || [], modeled: propsOf("GameView") },
  ];

  const out = { groups: [] };
  let totalEmitted = 0, totalModeled = 0, totalUnmodeled = 0;
  for (const g of groups) {
    const unmodeled = g.emitted.filter((f) => !g.modeled.has(f) && !ALLOWED_EXTRA.has(f));
    const modeledCount = g.emitted.filter((f) => g.modeled.has(f)).length;
    totalEmitted += g.emitted.length;
    totalModeled += modeledCount;
    totalUnmodeled += unmodeled.length;
    out.groups.push({
      key: g.key,
      label: g.label,
      emitted: g.emitted.length,
      modeled: modeledCount,
      unmodeled,
    });
  }
  out.totalEmitted = totalEmitted;
  out.totalModeled = totalModeled;
  out.totalUnmodeled = totalUnmodeled;
  out.status = totalUnmodeled === 0 ? "pass" : "fail";
  return out;
}

function readProxy() {
  const dir = path.join(repoRoot, "Mage.Proxy", "target", "surefire-reports");
  if (!fs.existsSync(dir)) return null;
  let tests = 0, failures = 0, errors = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".xml")) continue;
    const txt = fs.readFileSync(path.join(dir, f), "utf8");
    // surefire 3.x escribe los atributos en otro orden que 2.x: extraer
    // cada atributo de forma independiente (no depender del orden).
    const attr = (name) => Number((txt.match(new RegExp(`\\b${name}="(\\d+)"`)) || [])[1] ?? 0);
    const t = attr("tests");
    if (!t) continue;
    tests += t;
    failures += attr("failures");
    errors += attr("errors");
  }
  if (!tests) return null;
  return { total: tests, passed: tests - failures - errors, failed: failures + errors, durationMs: null };
}

function build() {
  const content = readJson(path.join(siteDir, "content.json")) || {};
  const thresholds =
    content.coverageThresholds || (content.project && content.project.coverageThresholds) || {};

  // Release: content.json is the source of highlights/downloads; the version is
  // derived from the launcher's Cargo.toml so it cannot drift from the tag.
  const launcherVersion = readLauncherVersion();
  const release = content.release ? { ...content.release } : null;
  if (release && launcherVersion) release.version = launcherVersion;
  const project = { ...(content.project || {}) };
  if (release && release.version) project.version = release.version;

  const vitest = readVitest();
  const e2eSkipped = process.env.DASHBOARD_SKIP_E2E === "1";
  const pw = e2eSkipped ? null : readPlaywright();
  const cov = readCoverage();
  const proxy = readProxy();
  const integ = readJson(path.join(repoRoot, "reports", "integration-result.json"));
  const baseline = readJson(
    path.join(webDir, "fixtures", "engine-view-gap.baseline.json"),
  );
  const engineGaps = buildEngineGaps(baseline, content);
  const reverseCoverage = buildReverseCoverage();

  const layers = [
    layer("unit", "Unit (vitest)", vitest ? (vitest.failed ? "fail" : "pass") : "pending", vitest),
    layer(
      "coverage",
      "Coverage gate",
      cov
        ? Object.keys(thresholds).every((k) => cov[k] == null || cov[k] >= thresholds[k])
          ? "pass"
          : "fail"
        : "pending",
    ),
    layer("typecheck", "Typecheck (tsc)", markerStatus(webDir, ".typecheck.json")),
    layer("build", "Build (vite)", markerStatus(webDir, ".build.json")),
    layer("mcp", "MCP (typecheck+test)", markerStatus(webDir, ".mcp-tests.json")),
    layer(
      "fake-e2e",
      "E2E (fake, no stack)",
      pw ? (pw.failed ? "fail" : "pass") : "pending",
      pw ?? (e2eSkipped ? { note: E2E_SKIPPED_NOTE } : null),
    ),
    layer("proxy", "Proxy (java)", proxy ? (proxy.failed ? "fail" : "pass") : "pending", proxy),
    layer(
      "integration",
      "Integration (real stack)",
      integ ? (integ.status === "pass" ? "pass" : "fail") : "pending",
      integ ? { note: integNote(integ) } : { note: "nightly / on demand" },
    ),
  ];

  const status = {
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || null,
    runUrl: process.env.GITHUB_RUN_URL || null,
    project,
    release,
    marketing: content.marketing || null,
    layers,
    coverage: cov,
    coverageThresholds: thresholds,
    phases: content.phases || [],
    features: content.features || [],
    guards: content.guards || [],
    engineGaps,
    reverseCoverage,
  };

  fs.writeFileSync(outPath, JSON.stringify(status, null, 2));
  console.log(`[gen-dashboard] wrote ${outPath}`);
  const failed = layers.filter((l) => l.status === "fail").length;
  console.log(`[gen-dashboard] layers: ${layers.length}, failed: ${failed}`);
}

const E2E_SKIPPED_NOTE =
  "not run on push: the same suite runs sharded in Web client CI, and nightly on this dashboard";

function integNote(integ) {
  const parts = [];
  if (integ.selfTest) parts.push("self-test:" + integ.selfTest);
  if (integ.humanTest) parts.push("human-test:" + integ.humanTest);
  if (integ.verify) parts.push("verify:" + integ.verify);
  if (integ.verifyRestart) parts.push("verify-restart:" + integ.verifyRestart);
  if (integ.e2eReal) parts.push("e2e-real:" + integ.e2eReal);
  return parts.length ? parts.join(" · ") : integ.status;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) build();

export { build };
