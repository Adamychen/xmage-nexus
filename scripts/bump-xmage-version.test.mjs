import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bumpRepo, bumpText, replacementsFor } from "./bump-xmage-version.mjs";

const plan = replacementsFor("1.4.62-V1", "1.4.63-V1");

test("the release, its upstream tag and the proxy jar move to the new release", () => {
  const text = "XMage 1.4.62-V1, tag `xmage_1.4.62V1`, jar Mage.Proxy/target/mage-proxy-1.4.62.jar";
  assert.equal(bumpText("AGENTS.md", text, plan), "XMage 1.4.63-V1, tag `xmage_1.4.63V1`, jar Mage.Proxy/target/mage-proxy-1.4.63.jar");
});

test("a bare version in prose is history and stays", () => {
  const text = "// re-validated in 1.4.62: the AI closes the game first";
  assert.equal(bumpText("scripts/record.mjs", text, plan), text);
});

test("a longer build number is not mistaken for the current one", () => {
  assert.equal(bumpText("readme.md", "1.4.62-V10 and xmage_1.4.62V12", plan), "1.4.62-V10 and xmage_1.4.62V12");
});

test("the per-file forms change only in their own file", () => {
  assert.equal(bumpText("scripts/lib.mjs", "export const XMAGE_VERSION = '1.4.62'", plan), "export const XMAGE_VERSION = '1.4.63'");
  assert.equal(bumpText("docs/x.md", "XMAGE_VERSION = '1.4.62'", plan), "XMAGE_VERSION = '1.4.62'");
  const pom = "<artifactId>mage-proxy</artifactId>\n    <version>1.4.62</version>\n<dependency><version>1.4.62</version></dependency>";
  assert.equal(bumpText("Mage.Proxy/pom.xml", pom, plan), "<artifactId>mage-proxy</artifactId>\n    <version>1.4.63</version>\n<dependency><version>1.4.62</version></dependency>");
  assert.equal(bumpText("launcher/src/manifest.rs", '"release": "1.4.62-1"', plan), '"release": "1.4.63-1"');
});

test("a new build letter or number reaches the gen-manifest template", () => {
  const v2 = replacementsFor("1.4.62-V1", "1.4.62-V2");
  assert.equal(bumpText("scripts/gen-manifest.mjs", "export const XMAGE_RELEASE = `${XMAGE_VERSION}-V1`", v2), "export const XMAGE_RELEASE = `${XMAGE_VERSION}-V2`");
});

test("CRLF files keep their line endings", () => {
  const pom = "<artifactId>mage-proxy</artifactId>\r\n    <version>1.4.62</version>\r\n";
  assert.equal(bumpText("Mage.Proxy/pom.xml", pom, plan), "<artifactId>mage-proxy</artifactId>\r\n    <version>1.4.63</version>\r\n");
});

test("bumpRepo writes the changed files and reports a per-file form it could not find", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bump-"));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.writeFileSync(path.join(root, "AGENTS.md"), "XMage 1.4.62-V1\n");
  fs.writeFileSync(path.join(root, "scripts", "lib.mjs"), "export const XMAGE_VERSION = '1.4.61'\n");
  const files = ["AGENTS.md", "scripts/lib.mjs"];
  const { changed, pending } = bumpRepo(root, "1.4.62-V1", "1.4.63-V1", { files });
  assert.deepEqual(changed, ["AGENTS.md"]);
  assert.deepEqual(pending, ["scripts/lib.mjs"]);
  assert.equal(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), "XMage 1.4.63-V1\n");
});

test("a dry run reports without writing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bump-"));
  fs.writeFileSync(path.join(root, "AGENTS.md"), "XMage 1.4.62-V1\n");
  const { changed } = bumpRepo(root, "1.4.62-V1", "1.4.63-V1", { dryRun: true, files: ["AGENTS.md"] });
  assert.deepEqual(changed, ["AGENTS.md"]);
  assert.equal(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), "XMage 1.4.62-V1\n");
});

test("a version that is not an XMage release is refused", () => {
  assert.throws(() => replacementsFor("1.4.62", "1.4.63-V1"), /not an XMage release/);
});
