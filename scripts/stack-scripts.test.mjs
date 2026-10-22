import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(scriptsDir, name), "utf8");

test("build.mjs stamps the org.mage artifacts only after the plugins installed", () => {
  const src = read("build.mjs");
  const pluginStep = src.indexOf("PLUGIN_MODULES.join");
  const stamp = src.indexOf("stampMageArtifacts()");
  assert.ok(pluginStep > 0 && stamp > pluginStep, "stampMageArtifacts() must come after the plugin install");
});

test("install.mjs stamps the artifacts after the plugin install", () => {
  const src = read("install.mjs");
  const pluginStep = src.indexOf("PLUGIN_MODULES.join");
  const stamp = src.indexOf("stampMageArtifacts()");
  assert.ok(pluginStep > 0 && stamp > pluginStep, "install.mjs must stamp the fork commit");
});

test("build.mjs failures include the stdout tail (mvn -q writes errors to stdout)", () => {
  assert.match(read("build.mjs"), /res\.stdout/);
});

test("verify-tournament-watch never exits from inside its try, so the finally cleanup runs", () => {
  const src = read("verify-tournament-watch.mjs");
  const body = src.slice(src.indexOf("let tableId = null"), src.indexOf("} finally {"));
  assert.equal(body.includes("process.exit"), false);
  assert.match(src, /disconnect/);
});

test("self-test quits the match before removing its table", () => {
  const src = read("self-test.mjs");
  const cleanup = src.slice(src.indexOf("} finally {"));
  const quit = cleanup.indexOf("quitMatch");
  const remove = cleanup.indexOf("removeTable");
  assert.ok(quit > 0 && remove > quit, "quitMatch must precede removeTable in the finally");
});

test("every probe logs out with disconnect before closing its socket", () => {
  for (const file of [
    "self-test.mjs",
    "human-test.mjs",
    "warmup.mjs",
    "fuzz.mjs",
    "verify-reconnect.mjs",
    "verify-tournament-watch.mjs",
    "clean-tables.mjs",
  ]) {
    assert.match(read(file), /'disconnect'|disconnectConn/, `${file} must send disconnect`);
  }
});

test("ctl.mjs keeps the child's output in .run/dev.out.log and validates its arguments", () => {
  const src = read("ctl.mjs");
  assert.equal(src.includes("stdio: 'ignore'"), false);
  assert.match(src, /dev\.out\.log/);
  assert.match(src, /parseStackCommand/);
});

test("tunnel-sync.mjs resolves its root with fileURLToPath, not a percent-encoded pathname", () => {
  const src = read("tunnel-sync.mjs");
  assert.equal(src.includes("import.meta.url).pathname"), false);
  assert.match(src, /fileURLToPath/);
});
