import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDevServer, injectRibbon, ribbonHtml } from "./dev-web-server.mjs";

const INFO = {
  ref: "feature/board-fix",
  sha: "0123456789abcdef0123456789abcdef01234567",
  shortSha: "0123456",
  builtAt: "2026-11-22T00:30:00.000Z",
  actor: "adamychen",
  runUrl: "https://github.com/Adamychen/xmage-nexus/actions/runs/1",
};

function fixture({ info = INFO, html = "<!doctype html><html><body><div id=\"root\"></div></body></html>" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dev-web-"));
  fs.writeFileSync(path.join(root, "index.html"), html);
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(path.join(root, "assets", "app-abc123.js"), "console.log(1)\n");
  if (info) fs.writeFileSync(path.join(root, "dev-info.json"), JSON.stringify(info));
  return root;
}

async function start(root) {
  const server = createDevServer({ root, log: () => {} });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(resolve);
  }) };
}

test("the dev site serves the branch build with the ribbon and noindex", async () => {
  const root = fixture();
  const { base, close } = await start(root);
  try {
    const res = await fetch(`${base}/`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.match(res.headers.get("cache-control"), /no-store/);
    assert.match(res.headers.get("x-robots-tag"), /noindex/);
    assert.match(body, /data-dev-ribbon="1"/);
    assert.match(body, /feature\/board-fix @ 0123456/);
    assert.match(body, /actions\/runs\/1/);
  } finally {
    await close();
  }
});

test("the ribbon never lets a ref inject markup", () => {
  const html = ribbonHtml({ ...INFO, ref: '<img src=x onerror="alert(1)">' });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.equal(ribbonHtml(null), "");
});

test("injectRibbon keeps the document intact and appends when there is no body", () => {
  const withBody = injectRibbon("<html><body><main></main></body></html>", INFO);
  assert.match(withBody, /<main><\/main><div data-dev-ribbon="1"/);
  assert.match(withBody, /<\/div><\/body>/);
  const withoutBody = injectRibbon("<main></main>", INFO);
  assert.match(withoutBody, /^<main><\/main><div data-dev-ribbon="1"/);
  assert.equal(injectRibbon("<main></main>", null), "<main></main>");
});

test("unknown routes fall back to index.html (single-page app)", async () => {
  const { base, close } = await start(fixture());
  try {
    const res = await fetch(`${base}/lobby/some/deep/route`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.match(await res.text(), /data-dev-ribbon="1"/);
  } finally {
    await close();
  }
});

test("a missing asset is a 404, not the SPA shell", async () => {
  const { base, close } = await start(fixture());
  try {
    const res = await fetch(`${base}/assets/missing.js`);
    assert.equal(res.status, 404);
    assert.doesNotMatch(await res.text(), /data-dev-ribbon/);
  } finally {
    await close();
  }
});

test("hashed assets are immutable and keep their content type", async () => {
  const { base, close } = await start(fixture());
  try {
    const res = await fetch(`${base}/assets/app-abc123.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /javascript/);
    assert.match(res.headers.get("cache-control"), /immutable/);
    assert.equal(await res.text(), "console.log(1)\n");
  } finally {
    await close();
  }
});

test("dev-info.json is readable and never cached", async () => {
  const { base, close } = await start(fixture());
  try {
    const res = await fetch(`${base}/dev-info.json`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("cache-control"), /no-store/);
    assert.deepEqual(await res.json(), INFO);
  } finally {
    await close();
  }
});

test("robots.txt disallows the dev site even when the build has none", async () => {
  const { base, close } = await start(fixture());
  try {
    const res = await fetch(`${base}/robots.txt`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Disallow: \//);
  } finally {
    await close();
  }
});

test("path traversal never escapes the published directory", async () => {
  const { base, close } = await start(fixture());
  try {
    // `%2e%2e` is normalised by the URL parser into a plain path, so it lands on the SPA
    // shell; an encoded separator is the one that would actually reach the filesystem.
    for (const probe of ["/..%2f..%2f..%2fetc%2fpasswd", "/%2e%2e/%2e%2e/etc/passwd", "/assets/..%2f..%2fdev-info.json"]) {
      const res = await fetch(`${base}${probe}`);
      const body = await res.text();
      assert.doesNotMatch(body, /root:x:/, `${probe} leaked a file outside the root`);
      if (res.status === 200) {
        assert.match(body, /data-dev-ribbon/, `${probe} answered 200 with something other than the SPA shell`);
      } else {
        assert.ok([400, 403, 404].includes(res.status), `${probe} -> ${res.status}`);
      }
    }
    const escaped = await fetch(`${base}/..%2f..%2f..%2fetc%2fpasswd`);
    assert.equal(escaped.status, 403, "an encoded separator outside the root is refused");
  } finally {
    await close();
  }
});

test("an empty dev directory says so instead of pretending to serve a site", async () => {
  const { base, close } = await start(path.join(os.tmpdir(), "dev-web-does-not-exist"));
  try {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 503);
    assert.match(await res.text(), /no build published yet/);
  } finally {
    await close();
  }
});

test("HEAD returns the headers without a body", async () => {
  const { base, close } = await start(fixture());
  try {
    const res = await fetch(`${base}/`, { method: "HEAD" });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "");
  } finally {
    await close();
  }
});
