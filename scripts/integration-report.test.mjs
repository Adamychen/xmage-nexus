import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
