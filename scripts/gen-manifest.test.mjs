import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { XMAGE_RELEASE, readForkSha } from "./gen-manifest.mjs";

test("manifest xmage release is the engine version with its release suffix", () => {
  assert.equal(XMAGE_RELEASE, "1.4.62-V1");
});

function tarballWithVersion(dir, target, version) {
  const src = fs.mkdtempSync(path.join(dir, "src-"));
  fs.writeFileSync(path.join(src, "version.json"), JSON.stringify(version));
  execFileSync("tar", ["-czf", path.join(dir, `nexus-server-${target}.tar.gz`), "-C", src, "."]);
}

test("manifest records the fork commit read from the server tarball version.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-"));
  tarballWithVersion(dir, "linux-x64", { schema: 1, forkSha: "0123456789abcdef0123456789abcdef01234567" });
  assert.equal(readForkSha(dir), "0123456789abcdef0123456789abcdef01234567");
});

test("manifest fork commit is unknown when no tarball carries one (older releases)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-"));
  tarballWithVersion(dir, "linux-x64", { schema: 1, gitSha: "abc1234" });
  assert.equal(readForkSha(dir), "unknown");
  assert.equal(readForkSha(fs.mkdtempSync(path.join(os.tmpdir(), "empty-"))), "unknown");
});
