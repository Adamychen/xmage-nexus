import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { failedStatus, writeIntegrationResult } from "./integration-report.mjs";

const LAYER_KEYS = ["selfTest", "humanTest", "verify", "verifyRestart", "e2eReal"];

test("a crash produces a report where every layer is failed and the error is named", () => {
  const s = failedStatus("boom");
  for (const k of LAYER_KEYS) assert.equal(s[k], "fail", k);
  assert.equal(s.status, "fail");
  assert.match(s.note, /boom/);
  assert.ok(s.generatedAt);
});

test("the crash report is written to disk, so the dashboard reads red instead of pending", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-report-"));
  try {
    writeIntegrationResult(failedStatus("boom"), dir);
    const written = JSON.parse(fs.readFileSync(path.join(dir, "integration-result.json"), "utf8"));
    assert.equal(written.status, "fail");
    assert.match(written.note, /boom/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("TST-5: every @real spec is in REAL_E2E_SPECS and vice versa", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const src = fs.readFileSync(path.join(repoRoot, "scripts", "integration-report.mjs"), "utf8");
  const m = src.match(/REAL_E2E_SPECS\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, "REAL_E2E_SPECS array literal found");
  const set = [...m[1].matchAll(/"([^"]+\.spec\.ts)"/g)].map((x) => x[1]).sort();
  const e2eDir = path.join(repoRoot, "web", "e2e");
  const tagged = fs
    .readdirSync(e2eDir)
    .filter((f) => f.endsWith(".spec.ts"))
    .filter((f) => /@real/.test(fs.readFileSync(path.join(e2eDir, f), "utf8")))
    .sort();
  assert.deepEqual(set, tagged);
});
