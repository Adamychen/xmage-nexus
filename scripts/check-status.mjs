#!/usr/bin/env node
// Fail the CI run when a dashboard layer is red. Usage: node scripts/check-status.mjs
//
// Why this is a separate step and not dashboard-ci.mjs exiting non-zero: Pages deploys *after*
// the layers run, and a failing step skips the rest of the job. Exiting from the generator would
// have published nothing and left the site showing the last green snapshot — the failure would
// exist only as a red tick on a page nobody opens, which is how the walkway guard and the cold
// proxy ran red for a week while the dashboard said "everything is fine".
//
// So: the site is published with the true (red) data, and this gate runs afterwards to turn the
// run red too. Transparency and loudness, in that order.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const statusPath = path.join(repoRoot, "site", "status.json");

function main() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(statusPath, "utf8"));
  } catch (e) {
    console.error(`[check-status] ${statusPath} is missing or unreadable (${e.message})`);
    console.error("[check-status] the dashboard was never generated — that is a pipeline failure, not a green run");
    process.exit(1);
  }

  const layers = raw.layers ?? [];
  for (const l of layers) {
    console.log(`[check-status] ${l.status.padEnd(7)} ${l.label}${l.note ? ` — ${l.note}` : ""}`);
  }
  const failed = layers.filter((l) => l.status === "fail");
  if (failed.length) {
    console.error(
      `[check-status] ${failed.length} layer(s) RED: ${failed.map((l) => l.name).join(", ")}`,
    );
    process.exit(1);
  }
  const pending = layers.filter((l) => l.status === "pending").length;
  console.log(
    `[check-status] ${layers.length - pending - failed.length} pass, ${pending} pending, 0 fail`,
  );
}

main();
