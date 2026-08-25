#!/usr/bin/env node
// Orquesta las capas ligeras de CI, escribe marcadores y genera el dashboard.
// Uso: node scripts/dashboard-ci.mjs
// Capas: unit+coverage (vitest), typecheck, build, fake-e2e, proxy java.
// Los resultados crudos se dejan en web/ para que gen-dashboard.mjs los consuma.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run, binName, repoRoot } from "./lib.mjs";
import { build } from "./gen-dashboard.mjs";

const webDir = path.join(repoRoot, "web");

function writeMarker(name, status) {
  fs.writeFileSync(path.join(webDir, name), JSON.stringify({ status }));
}

async function main() {
  // 1. Unit + coverage (un solo run vitest que emite ambos artefactos)
  run("npm", ["run", "test:coverage", "--", "--reporter=json", "--outputFile=test-results.json"], {
    cwd: webDir,
    timeoutMs: 600_000,
  });

  // 2. Typecheck
  const tc = run("npm", ["run", "typecheck"], { cwd: webDir, timeoutMs: 300_000 });
  writeMarker(".typecheck.json", tc.code === 0 ? "pass" : "fail");

  // 3. Build
  const b = run("npm", ["run", "build"], { cwd: webDir, timeoutMs: 300_000 });
  writeMarker(".build.json", b.code === 0 ? "pass" : "fail");

  // 4. Fake E2E (no requiere el stack XMage; vite levanta solo)
  run("npx", ["playwright", "test", "--reporter=json", "--output-file=e2e-results.json"], {
    cwd: webDir,
    timeoutMs: 900_000,
  });

  // 5. Proxy (java)
  run(binName("mvn"), ["-pl", "Mage.Proxy", "-am", "test"], { timeoutMs: 900_000 });

  // 6. Generar status.json
  build();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
