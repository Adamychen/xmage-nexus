import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions } from "./assemble-modules.mjs";

test("plugin versions compare numerically per segment (1.4.10 is newer than 1.4.9)", () => {
  assert.ok(compareVersions("1.4.10", "1.4.9") > 0);
  assert.ok(compareVersions("1.4.9", "1.4.10") < 0);
  assert.ok(compareVersions("1.10.0", "1.9.9") > 0);
});

test("equal versions compare as zero, including suffixed ones", () => {
  assert.equal(compareVersions("1.4.62-V1", "1.4.62-V1"), 0);
  assert.equal(compareVersions("1.4.9", "1.4.9"), 0);
});

test("suffixes compare numerically too (-V10 is newer than -V9)", () => {
  assert.ok(compareVersions("1.4.62-V10", "1.4.62-V9") > 0);
  assert.ok(compareVersions("1.4.62-V1", "1.4.62-V2") < 0);
});

test("a longer version with the same prefix is newer", () => {
  assert.ok(compareVersions("1.4.62-V1", "1.4.62") > 0);
});
