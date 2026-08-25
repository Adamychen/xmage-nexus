#!/usr/bin/env node
// Nightly: corre las capas que requieren el stack XMage real (ya levantado por el workflow)
// y escribe reports/integration-result.json para que gen-dashboard.mjs lo consuma.
// Uso: node scripts/integration-report.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run, repoRoot } from "./lib.mjs";

const webDir = path.join(repoRoot, "web");

async function main() {
  const selfTest = run("node", ["scripts/self-test.mjs"], { cwd: repoRoot, timeoutMs: 1_800_000 });
  const humanTest = run("node", ["scripts/human-test.mjs"], { cwd: repoRoot, timeoutMs: 1_800_000 });
  const e2eReal = run(
    "npx",
    ["playwright", "test"],
    { cwd: webDir, timeoutMs: 1_800_000, env: Object.assign({}, process.env, { E2E_BACKEND: "real" }) },
  );

  const status = {
    generatedAt: new Date().toISOString(),
    selfTest: selfTest.code === 0 ? "pass" : "fail",
    humanTest: humanTest.code === 0 ? "pass" : "fail",
    e2eReal: e2eReal.code === 0 ? "pass" : "fail",
  };
  status.status = Object.values(status).includes("fail") ? "fail" : "pass";

  fs.mkdirSync(path.join(repoRoot, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, "reports", "integration-result.json"),
    JSON.stringify(status, null, 2),
  );
  console.log("[integration-report] " + JSON.stringify(status));
  process.exit(status.status === "pass" ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
