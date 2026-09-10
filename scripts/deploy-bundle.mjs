#!/usr/bin/env node
// Assemble a copy-paste deployment bundle for the multi-user host machine.
// Output: deploy/bundle/  (ignored by git via the /deploy rule)
//         proxy fat jar + web-dist + start scripts + guide
//
// Usage:
//   node scripts/build.mjs proxy            # once, produces the jar
//   npm --prefix web run build              # produces web/dist
//   node scripts/deploy-bundle.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "deploy", "bundle");

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const jarDir = path.join(repoRoot, "Mage.Proxy", "target");
  const jar = fs.existsSync(jarDir)
    ? fs.readdirSync(jarDir).find((f) => /^mage-proxy-.*\.jar$/.test(f))
    : null;
  if (!jar) {
    console.error("Missing proxy jar — run: node scripts/build.mjs proxy");
    process.exit(1);
  }
  fs.copyFileSync(path.join(jarDir, jar), path.join(outDir, jar));

  const dist = path.join(repoRoot, "web", "dist");
  if (!fs.existsSync(dist)) {
    console.error("Missing web/dist — run: npm --prefix web run build");
    process.exit(1);
  }
  fs.cpSync(dist, path.join(outDir, "web-dist"), { recursive: true });

  for (const f of ["start-proxy.sh", "start-proxy.bat"]) {
    fs.copyFileSync(path.join(repoRoot, "scripts", "deploy", f), path.join(outDir, f));
  }
  fs.copyFileSync(path.join(repoRoot, "docs", "deploy-playit.md"), path.join(outDir, "README.md"));
  fs.chmodSync(path.join(outDir, "start-proxy.sh"), 0o755);

  console.log(`[deploy-bundle] wrote ${outDir}`);
  console.log(`[deploy-bundle]   ${jar}`);
  console.log("[deploy-bundle]   web-dist/  start-proxy.sh  start-proxy.bat  README.md");
  console.log("[deploy-bundle] Copy this folder to the host machine and follow README.md.");
}

main();
