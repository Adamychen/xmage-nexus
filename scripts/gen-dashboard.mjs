#!/usr/bin/env node
// Genera site/status.json consumiendo los artefactos de test y site/content.json.
// Uso: node scripts/gen-dashboard.mjs
// Entradas esperadas (generadas por CI):
//   web/test-results.json                  (vitest --reporter=json --outputFile)
//   web/coverage/coverage-summary.json      (vitest coverage json-summary)
//   web/e2e-results.json                    (playwright --reporter=json --output-file)
//   Mage.Proxy/target/surefire-reports/*.xml (junit del proxy)
//   reports/integration-result.json         (nightly, stack real)
// Variables de entorno: GITHUB_SHA, GITHUB_RUN_URL

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

// Cruza el baseline commiteado (fuente de verdad del guard engineViewCoverage)
// con las anotaciones legibles de content.json. Si un campo anotado deja de
// estar en el baseline (upstream lo expone), se marca exposed para no hacer drift.
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

// Reverse-drift (server->client): todo campo que el server puede emitir
// (oracle server-view-schema.json) debe estar modelado en contract.schema.json.
// Auto-sincronizado: lee ambos artefactos commiteados, sin lista manual.
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
    const m = txt.match(/<testsuite[^>]*\btests="(\d+)"[^>]*\bfailures="(\d+)"[^>]*\berrors="(\d+)"/);
    if (!m) continue;
    tests += Number(m[1]);
    failures += Number(m[2]);
    errors += Number(m[3]);
  }
  if (!tests) return null;
  return { total: tests, passed: tests - failures - errors, failed: failures + errors, durationMs: null };
}

function build() {
  const content = readJson(path.join(siteDir, "content.json")) || {};
  const thresholds = (content.project && content.project.coverageThresholds) || {};

  const vitest = readVitest();
  const pw = readPlaywright();
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
    layer("fake-e2e", "E2E (fake, no stack)", pw ? (pw.failed ? "fail" : "pass") : "pending", pw),
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
    project: content.project || {},
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

function integNote(integ) {
  const parts = [];
  if (integ.selfTest) parts.push("self-test:" + integ.selfTest);
  if (integ.humanTest) parts.push("human-test:" + integ.humanTest);
  if (integ.e2eReal) parts.push("e2e-real:" + integ.e2eReal);
  return parts.length ? parts.join(" · ") : integ.status;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) build();

export { build };
