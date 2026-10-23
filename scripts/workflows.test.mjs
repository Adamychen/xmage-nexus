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

test("the demo verification result is regenerated into status.json before deploy", () => {
  const pages = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "pages.yml"), "utf8");
  const build = jobBlock(pages, "build");
  const verifyIdx = build.indexOf("Verify the demo");
  const regenIdx = build.indexOf("Regenerate status.json with demo results");
  const uploadIdx = build.indexOf("Upload Pages artifact");
  assert.ok(verifyIdx !== -1, "verify-demo step exists");
  assert.ok(regenIdx > verifyIdx, "the status regen must follow the demo verify");
  assert.ok(uploadIdx > regenIdx, "the status regen must run before the site is uploaded");
});
