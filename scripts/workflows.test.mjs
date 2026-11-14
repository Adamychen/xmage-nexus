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

// integration used to wait for web and proxy. That was never a data dependency, only a cheaper
// red: it skipped the stack build when the basics failed. It cost 4.5 min of waiting on every
// run and made this job the critical path (8.0 min of work finishing at 12.4 on run 43455026794,
// with the e2e done at 9.4), to save free runner minutes on the ~1 run in 10 where web or proxy
// fail. What has to stay true is that the job can start cold, so this guards that instead.
test("integration starts cold: no needs, and nothing it reads comes from another job", () => {
  assert.deepEqual(needsOf(webCi, "integration"), []);
  const block = jobBlock(webCi, "integration");
  assert.ok(block !== null, "job integration exists");
  assert.doesNotMatch(block, /\$\{\{\s*needs\./, "integration reads no other job's outputs");
  assert.doesNotMatch(block, /download-artifact/, "integration downloads no other job's artifacts");
  assert.match(block, /node scripts\/build\.mjs/,
    "integration builds the stack itself (ensureMageArtifacts installs org.mage from the fork)");
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
// everything but the heavy specs, e2e-fake-heavy takes only them. If the two drift apart, specs stop
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
  const heavy = jobBlock(webCi, "e2e-fake-heavy");
  assert.ok(fake !== null && heavy !== null, "both e2e jobs exist");
  assert.match(fake, /E2E_LANE: light/, "e2e-fake runs the light lane");
  assert.match(heavy, /E2E_LANE: heavy/, "e2e-fake-heavy runs the heavy lane");
  assert.doesNotMatch(heavy, /E2E_LANE: light/, "e2e-fake-heavy does not also run the light lane");
});

// The deploy workflow runs on the self-hosted runner, which executes ~/deploy-xmage.sh on the
// server. Two things must hold forever: it is never reachable from a fork's pull request, and it
// only publishes the commit that bumps the app version. Before 2026-11-14 every push to master
// deployed, so a README typo went to production and a version bump was indistinguishable from it.
const deploy = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "deploy.yml"), "utf8");

test("deploy triggers only on master pushes touching web/package.json, plus a manual run", () => {
  const on = deploy.slice(deploy.indexOf("\non:"), deploy.indexOf("\npermissions:"));
  assert.match(on, /push:/, "it still triggers on push");
  assert.match(on, /branches:\s*\[master\]/, "only on master");
  assert.match(on, /paths:\s*\['web\/package\.json'\]/, "prefiltered to the file that carries the version");
  assert.match(on, /workflow_dispatch:/, "a manual run stays available for a hotfix");
  // The header comment names the triggers to avoid, so the guard reads the file without comments.
  const triggers = deploy.replace(/(^|\n)\s*#[^\n]*/g, "$1");
  assert.doesNotMatch(triggers, /pull_request/, "a job on the server is never reachable from a pull request");
});

test("the gate reads the version of the pushed commit and of its first parent", () => {
  const gate = jobBlock(deploy, "gate");
  assert.ok(gate !== null, "job gate exists");
  assert.match(gate, /runs-on: ubuntu-latest/, "the comparison runs on a GitHub runner, not on the server");
  assert.match(gate, /fetch-depth: 2/, "HEAD~1 has to be in the checkout");
  assert.match(gate, /git show HEAD~1:web\/package\.json/, "it compares against the first parent");
  assert.match(gate, /changed=true/, "it publishes a changed output");
  assert.match(gate, /outputs:[\s\S]*changed: \$\{\{ steps\.version\.outputs\.changed \}\}/,
    "the output is wired to the step that computes it");
});

test("the self-hosted job waits for the gate and runs only on a version bump or a manual run", () => {
  assert.deepEqual(needsOf(deploy, "deploy"), ["gate"]);
  const job = jobBlock(deploy, "deploy");
  assert.match(job, /runs-on: \[self-hosted, xmage-nexus\]/, "this is the job that touches the server");
  const condition = job.match(/^ {4}if: (.*)$/m);
  assert.ok(condition, "the self-hosted job is conditional");
  assert.match(condition[1], /needs\.gate\.outputs\.changed == 'true'/, "a bump deploys");
  assert.match(condition[1], /github\.event_name == 'workflow_dispatch'/, "a manual run deploys");
});

test("the token of the job that runs on the server stays read-only", () => {
  const job = jobBlock(deploy, "deploy");
  assert.match(job, /permissions:\n {6}contents: read/, "the self-hosted job declares a read-only token");
  assert.doesNotMatch(job, /contents: write/, "nothing on the server may write to the repository");
  assert.match(deploy, /^permissions:\n {2}contents: read$/m, "the workflow default is read-only too");
});

test("deploy keeps one run at a time and never cancels one in flight", () => {
  const block = deploy.slice(deploy.indexOf("\nconcurrency:"), deploy.indexOf("\njobs:"));
  assert.match(block, /group: deploy/);
  assert.match(block, /cancel-in-progress: false/, "cancelling mid-deploy would leave the server half updated");
  assert.match(jobBlock(deploy, "deploy"), /timeout-minutes: 30/, "a hung deploy must not hold the runner forever");
});
