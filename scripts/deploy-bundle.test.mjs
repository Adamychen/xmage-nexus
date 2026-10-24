import { test } from "node:test";
import assert from "node:assert/strict";
import { selectProxyJar } from "./deploy-bundle.mjs";
import { XMAGE_VERSION } from "./lib.mjs";

test("bundle picks the nexus proxy jar whatever the directory order", () => {
  const beta = `mage-proxy-${XMAGE_VERSION}.jar`;
  const xdhs = "mage-proxy-1.6.1.jar";
  assert.equal(selectProxyJar([xdhs, beta]), beta);
  assert.equal(selectProxyJar([beta, xdhs]), beta);
});

test("bundle refuses to ship the XDHS jar when the nexus jar is missing", () => {
  assert.equal(selectProxyJar(["mage-proxy-1.6.1.jar", "notes.txt"]), null);
  assert.equal(selectProxyJar([]), null);
});

test("bundle does not match stray names that only look like a proxy jar", () => {
  assert.equal(selectProxyJar([`mage-proxy-${XMAGE_VERSION}.jar.bak`, `old-mage-proxy-${XMAGE_VERSION}.jar`]), null);
});
