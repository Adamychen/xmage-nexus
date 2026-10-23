import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseVitest,
  unitVerdict,
  coverageVerdict,
  parsePlaywright,
  fakeE2eLayer,
  proxyVerdict,
  demoVerdict,
} from "./gen-dashboard.mjs";

const vitestGreen = {
  numTotalTests: 10,
  numPassedTests: 10,
  numFailedTests: 0,
  numTotalTestSuites: 2,
  numFailedTestSuites: 0,
  success: true,
  startTime: 0,
  endTime: 5,
};

const vitestFileLoadFailure = {
  numTotalTests: 0,
  numPassedTests: 0,
  numFailedTests: 0,
  numTotalTestSuites: 3,
  numFailedTestSuites: 1,
  success: false,
  startTime: 0,
  endTime: 5,
};

const vitestTestFailure = {
  numTotalTests: 10,
  numPassedTests: 8,
  numFailedTests: 2,
  numTotalTestSuites: 2,
  numFailedTestSuites: 1,
  success: false,
  startTime: 0,
  endTime: 5,
};

test("a test file that fails to load fails the unit layer", () => {
  assert.equal(unitVerdict(parseVitest(vitestFileLoadFailure), null), "fail");
});

test("failing tests fail the unit layer", () => {
  assert.equal(unitVerdict(parseVitest(vitestTestFailure), null), "fail");
});

test("a clean vitest run passes the unit layer", () => {
  assert.equal(unitVerdict(parseVitest(vitestGreen), { status: "pass", code: 0 }), "pass");
});

test("a coverage gate miss keeps the unit layer green (the coverage layer owns it)", () => {
  assert.equal(unitVerdict(parseVitest(vitestGreen), { status: "fail", code: 1 }), "pass");
});

test("no vitest report and a failed vitest exit fails the unit layer; no evidence at all is pending", () => {
  assert.equal(unitVerdict(null, { status: "fail", code: 1 }), "fail");
  assert.equal(unitVerdict(null, null), "pending");
});

test("the file-level failure is named in the unit note", () => {
  assert.match(parseVitest(vitestFileLoadFailure).note, /1 test file\(s\) failed to run/);
});

test("coverage below a threshold fails the coverage layer", () => {
  assert.equal(coverageVerdict({ lines: 70 }, { lines: 80 }, null), "fail");
  assert.equal(coverageVerdict({ lines: 85 }, { lines: 80 }, null), "pass");
});

test("a missing coverage summary fails the coverage layer when vitest exited non-zero", () => {
  assert.equal(coverageVerdict(null, { lines: 80 }, { status: "fail", code: 1 }), "fail");
  assert.equal(coverageVerdict(null, { lines: 80 }, null), "pending");
});

const pwGreen = { stats: { expected: 5, unexpected: 0, flaky: 0, skipped: 0, duration: 1000 }, errors: [] };

test("parsePlaywright totals every outcome, not only the expected ones", () => {
  const pw = parsePlaywright({ stats: { expected: 5, unexpected: 1, flaky: 2, skipped: 3, duration: 9 }, errors: [] });
  assert.equal(pw.total, 11);
  assert.equal(pw.failed, 1);
  assert.equal(pw.flaky, 2);
  assert.equal(pw.executed, 8);
});

test("a green fake e2e run passes", () => {
  const e2e = fakeE2eLayer({ skipped: false, pw: parsePlaywright(pwGreen), marker: { status: "pass", code: 0 } });
  assert.equal(e2e.status, "pass");
});

test("a report with zero executed tests fails the fake e2e layer", () => {
  const empty = { stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 }, errors: [] };
  const e2e = fakeE2eLayer({ skipped: false, pw: parsePlaywright(empty), marker: { status: "pass", code: 0 } });
  assert.equal(e2e.status, "fail");
  assert.match(e2e.note, /no tests executed/);
});

test("load errors (spec or webServer failed to start) fail the fake e2e layer", () => {
  const loadError = { stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 }, errors: [{ message: "webServer exited" }] };
  const e2e = fakeE2eLayer({ skipped: false, pw: parsePlaywright(loadError), marker: { status: "fail", code: 1 } });
  assert.equal(e2e.status, "fail");
  assert.match(e2e.note, /1 load error/);
});

test("a missing playwright report fails the fake e2e layer when it was not skipped", () => {
  const e2e = fakeE2eLayer({ skipped: false, pw: null, marker: { status: "fail", code: 1 } });
  assert.equal(e2e.status, "fail");
  assert.match(e2e.note, /no Playwright JSON report/);
});

test("a non-zero playwright exit fails even when the report looks green", () => {
  const e2e = fakeE2eLayer({ skipped: false, pw: parsePlaywright(pwGreen), marker: { status: "fail", code: 1 } });
  assert.equal(e2e.status, "fail");
  assert.match(e2e.note, /exited with code 1/);
});

test("failed tests fail the fake e2e layer", () => {
  const red = { stats: { expected: 4, unexpected: 1, flaky: 0, skipped: 0 }, errors: [] };
  assert.equal(fakeE2eLayer({ skipped: false, pw: parsePlaywright(red), marker: { status: "fail", code: 1 } }).status, "fail");
});

test("flaky tests keep the fake e2e layer green and are named in the note", () => {
  const flaky = { stats: { expected: 9, unexpected: 0, flaky: 1, skipped: 0 }, errors: [] };
  const e2e = fakeE2eLayer({ skipped: false, pw: parsePlaywright(flaky), marker: { status: "pass", code: 0 } });
  assert.equal(e2e.status, "pass");
  assert.match(e2e.note, /1 flaky/);
});

test("the fake e2e layer is pending only when skipped", () => {
  const e2e = fakeE2eLayer({ skipped: true, pw: null, marker: { status: "fail", code: 1 } });
  assert.equal(e2e.status, "pending");
});

const proxyGreen = { total: 40, passed: 40, failed: 0, durationMs: null };

test("a failed mvn run fails the proxy layer even when the surefire reports look green", () => {
  const pv = proxyVerdict(proxyGreen, { status: "fail", code: 1 });
  assert.equal(pv.status, "fail");
  assert.match(pv.note, /exited with code 1/);
});

test("a passing mvn run with no surefire reports fails the proxy layer", () => {
  const pv = proxyVerdict(null, { status: "pass", code: 0 });
  assert.equal(pv.status, "fail");
  assert.match(pv.note, /no surefire reports/);
});

test("no proxy marker and no reports is pending", () => {
  assert.equal(proxyVerdict(null, null).status, "pending");
});

test("failing proxy tests fail the proxy layer", () => {
  assert.equal(proxyVerdict({ total: 40, passed: 38, failed: 2 }, { status: "pass", code: 0 }).status, "fail");
});

test("a green proxy run passes the proxy layer", () => {
  assert.equal(proxyVerdict(proxyGreen, { status: "pass", code: 0 }).status, "pass");
});

test("no demo marker is pending", () => {
  assert.equal(demoVerdict(null), "pending");
});

test("a passing verify-demo run passes the demo layer", () => {
  assert.equal(demoVerdict({ status: "pass", checks: 14 }), "pass");
});

test("a failing verify-demo run fails the demo layer", () => {
  assert.equal(demoVerdict({ status: "fail", failed: 2 }), "fail");
});
