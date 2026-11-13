import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webCi = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "web-ci.yml"), "utf8");

function jobBlock(yml, name) {
  const lines = yml.split(/\r?\n/);
  const start = lines.indexOf(`  ${name}:`);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !/^  \S/.test(lines[end])) end++;
  return lines.slice(start + 1, end).join("\n");
}

function needsOf(yml, name) {
  const block = jobBlock(yml, name);
  assert.ok(block !== null, `job ${name} exists`);
  const m = block.match(/^ {4}needs:\s*\[([^\]]*)\]/m);
  return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
}

test("integration waits for the web and proxy jobs (it builds the whole stack)", () => {
  assert.deepEqual(needsOf(webCi, "integration").sort(), ["proxy", "web"]);
});

test("e2e-fake shards stay without needs (intentional: they run in parallel with the rest)", () => {
  assert.deepEqual(needsOf(webCi, "e2e-fake"), []);
});

function webJobSteps(yml) {
  return jobBlock(yml, "web") || "";
}

test("the web job runs the node tests of scripts/ (dashboard and CI helpers)", () => {
  assert.match(webJobSteps(webCi), /run: node --test scripts\/\*\.test\.mjs/);
});

test("TST-4: the nightly integration steps run without continue-on-error", () => {
  const pages = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "pages.yml"), "utf8");
  const build = jobBlock(pages, "build");
  assert.ok(build !== null, "build job exists");
  const lines = build.split(/\r?\n/);
  const stepStarts = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\s*- name: /.test(lines[i])) stepStarts.push(i);
  }
  for (const step of ["Integration (real stack, nightly only)", "Re-record golden frames (nightly only)", "Validate re-recorded frames (nightly only)"]) {
    const idx = stepStarts.find((i) => lines[i].includes(step));
    assert.ok(idx !== undefined, `step ${step} exists`);
    const end = stepStarts.find((i) => i > idx) ?? lines.length;
    const block = lines.slice(idx, end).join("\n");
    assert.doesNotMatch(block, /continue-on-error:\s*true/, `${step} must not swallow failures`);
  }
});

// The fake e2e runs in two lanes (web/playwright.config.ts HEAVY_SPECS): e2e-fake takes
// everything but the heavy specs, e2e-heavy takes only them. If the two drift apart, specs stop
// running in CI and nothing else notices, so this pins them to the same constant.
const pwConfig = fs.readFileSync(path.join(repoRoot, "web", "playwright.config.ts"), "utf8");

function heavySpecs() {
  const m = pwConfig.match(/^const HEAVY_SPECS = \[([^\]]*)\]/m);
  assert.ok(m, "web/playwright.config.ts declares HEAVY_SPECS");
  return m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
}

test("every heavy spec names a file that exists", () => {
  const specs = heavySpecs();
  assert.ok(specs.length > 0, "HEAVY_SPECS is not empty");
  for (const glob of specs) {
    assert.match(glob, /^\*\*\//, `${glob} is a **/ glob, so it matches wherever testDir points`);
    const file = path.join(repoRoot, "web", "e2e", glob.replace("**/", ""));
    assert.ok(fs.existsSync(file), `${glob} exists (${file})`);
  }
});

test("the two lanes split the suite on the same constant, so no spec falls out of CI", () => {
  assert.match(pwConfig, /testIgnore:\s*LANE === 'light' \? HEAVY_SPECS : undefined/,
    "the light lane ignores exactly HEAVY_SPECS");
  assert.match(pwConfig, /testMatch:\s*LANE === 'heavy' \? HEAVY_SPECS : undefined/,
    "the heavy lane runs exactly HEAVY_SPECS");
});

test("web-ci runs both lanes", () => {
  const fake = jobBlock(webCi, "e2e-fake");
  const heavy = jobBlock(webCi, "e2e-heavy");
  assert.ok(fake !== null && heavy !== null, "both e2e jobs exist");
  assert.match(fake, /E2E_LANE: light/, "e2e-fake runs the light lane");
  assert.match(heavy, /E2E_LANE: heavy/, "e2e-heavy runs the heavy lane");
  assert.doesNotMatch(heavy, /E2E_LANE: light/, "e2e-heavy does not also run the light lane");
});
