import { test } from "node:test";
import assert from "node:assert/strict";
import { vitestVerdict } from "./test.mjs";

const GATE_MISS = " ERROR: Coverage for lines (71.2%) does not meet global threshold (80%)";

const green = (gate) => ({
  code: gate ? 1 : 0,
  stdout: [" Test Files  3 passed (3)", "      Tests  40 passed (40)", gate ? GATE_MISS : ""].join("\n"),
  stderr: "",
});

const fileLevelFailure = {
  code: 1,
  stdout: [
    " FAIL  src/broken.test.ts [ src/broken.test.ts ]",
    "Error: Failed to load url ./missing",
    " Test Files  1 failed | 2 passed (3)",
    "      Tests  40 passed (40)",
    GATE_MISS,
  ].join("\n"),
  stderr: "",
};

const testFailure = {
  code: 1,
  stdout: [" Test Files  1 failed | 2 passed (3)", "      Tests  2 failed | 38 passed (40)", GATE_MISS].join("\n"),
  stderr: "",
};

const unhandledError = {
  code: 1,
  stdout: [" Test Files  3 passed (3)", "      Tests  40 passed (40)", "     Errors  1 error", GATE_MISS].join("\n"),
  stderr: "",
};

test("a clean run passes the unit layer", () => {
  assert.equal(vitestVerdict(green(false), "unit").code, 0);
});

test("a coverage gate miss alone passes the unit layer", () => {
  assert.equal(vitestVerdict(green(true), "unit").code, 0);
});

test("a coverage gate miss fails the coverage layer", () => {
  assert.equal(vitestVerdict(green(true), "coverage").code, 1);
});

test("a test file that fails to load fails the unit layer, not only the coverage layer", () => {
  assert.equal(vitestVerdict(fileLevelFailure, "unit").code, 1);
});

test("failing tests fail the unit layer", () => {
  assert.equal(vitestVerdict(testFailure, "unit").code, 1);
});

test("unhandled errors fail the unit layer", () => {
  assert.equal(vitestVerdict(unhandledError, "unit").code, 1);
});
