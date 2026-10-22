#!/usr/bin/env node
// tunnel-sync.mjs — repairs the ephemeral quick-tunnel hostnames after a reboot.
//
// The public path is three Cloudflare QUICK tunnels (no account, no domain):
//   cloudflared-web.service  -> 127.0.0.1:8788 (web client)
//   cloudflared-ws.service   -> 127.0.0.1:8787 (WebSocket gateway)
//   cloudflared-xdhs.service -> 127.0.0.1:8797 (XDHS flavor)
// Each (re)start mints a NEW *.trycloudflare.com hostname. This script reads the
// live hostname of each unit from its journal and rewrites every place the
// hostname is baked in:
//   1. <host-repo>/web/.env.production.local         (client build defaults)
//   2. web/dist rebuild on the host                  (bakes the WS URL into the client)
//   3. site/content.json + site/status.json playUrl  (GitHub Pages invitation link)
// The --allowedOrigins of the proxy system units ALSO carry the old web hostname.
// Fixing them needs sudo, so this script only prints the exact commands:
//   sudo sed -i <old> <new> on /etc/systemd/system/xmage-proxy*.service && sudo systemctl daemon-reload
//   sudo systemctl restart xmage-proxy xmage-proxy-xdhs
//
// Usage:
//   node scripts/tunnel-sync.mjs [--check]     # --check: report drift, change nothing
//   HOST=adam@192.168.1.225 node scripts/tunnel-sync.mjs
//   HOST=... REPO=~/Escritorio/xmage-nexus node scripts/tunnel-sync.mjs
//
// The hostname files here (site/*.json) are rewritten in the CURRENT checkout;
// commit + push afterwards so GitHub Pages picks the new link up.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = process.env.HOST || 'adam@192.168.1.225';
const HOST_REPO = process.env.REPO || '~/Escritorio/xmage-nexus';
const CHECK = process.argv.includes('--check');

const UNITS = [
  { unit: 'cloudflared-web.service', key: 'web' },
  { unit: 'cloudflared-ws.service', key: 'ws' },
  { unit: 'cloudflared-xdhs.service', key: 'xdhs' },
];

function sh(cmd, opts = {}) {
  return (execFileSync('ssh', [HOST, cmd], { encoding: 'utf8', ...opts }) || '').trim();
}

// 1. Live hostnames from the user units' journals (last one wins; the unit
//    prints exactly one quick-tunnel URL per start).
const urls = {};
for (const { unit, key } of UNITS) {
  const out = sh(`journalctl --user -u ${unit} --no-pager -n 400 | grep -oE 'https://[a-z0-9-]+\\.trycloudflare\\.com' | tail -1`);
  if (!out) {
    console.error(`✗ ${unit}: no trycloudflare hostname found in journal — is the unit running?`);
    process.exit(1);
  }
  urls[key] = out;
}
console.log('Live hostnames:');
for (const [k, v] of Object.entries(urls)) console.log(`  ${k.padEnd(4)} ${v}`);

// 2. Hostname currently baked into the host's client build defaults.
const envPath = `${HOST_REPO}/web/.env.production.local`;
const env = sh(`cat ${envPath}`);
const oldWs = env.match(/^VITE_DEFAULT_PROXY_HOST=(\S+)/m)?.[1];
const oldXdhs = env.match(/^VITE_DEFAULT_XDHS_PROXY_HOST=(\S+)/m)?.[1];

const hostOf = (u) => u.replace(/^(https?|wss?):\/\//, '');
if (hostOf(oldWs) === hostOf(urls.ws) && hostOf(oldXdhs) === hostOf(urls.xdhs)) {
  console.log('✓ Host .env matches live tunnels — nothing to do.');
} else {
  if (CHECK) {
    console.log(`! Drift: .env has ws=${oldWs} xdhs=${oldXdhs}; live ws=${urls.ws} xdhs=${urls.xdhs}`);
    process.exit(2);
  }
  sh(`sed -i 's|${oldWs}|wss://${hostOf(urls.ws)}|; s|${oldXdhs}|wss://${hostOf(urls.xdhs)}|' ${envPath}`);
  console.log('✓ .env.production.local rewritten.');

  // 3. Rebuild the client so the new WS URL is baked into dist/.
  sh(`bash -c "source ~/.nvm/nvm.sh >/dev/null 2>&1; cd ${HOST_REPO}/web && npm run build" 2>&1 | tail -1`);
  const baked = sh(`grep -rlo ${urls.ws.split('//')[1].split('.')[0]} ${HOST_REPO}/web/dist/assets/*.js | head -1`);
  if (!baked) {
    console.error('✗ dist rebuild did not pick up the new hostname — inspect the build output.');
    process.exit(1);
  }
  console.log(`✓ dist rebuilt and carries the new WS hostname (${baked}).`);
}

// 4. Local site/*.json playUrl (GitHub Pages invitation link).
const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
let siteChanged = false;
for (const f of ['site/content.json', 'site/status.json']) {
  const p = path.join(repoRoot, f);
  const text = readFileSync(p, 'utf8');
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
  const current = [...new Set(m || [])];
  const target = urls.web;
  if (current.length === 1 && current[0] === target) continue;
  if (CHECK) {
    console.log(`! Drift: ${f} points to ${current.join(', ')}; live web=${target}`);
    process.exit(2);
  }
  writeFileSync(p, text.replace(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g, target));
  console.log(`✓ ${f} playUrl -> ${target}`);
  siteChanged = true;
}

// 5. allowedOrigins of the proxy units: sudo required, print the commands.
const proxyArgs = sh(`systemctl cat xmage-proxy 2>/dev/null | grep -oE -- '--allowedOrigins \\S+' || true`);
const xdhsArgs = sh(`systemctl cat xmage-proxy-xdhs 2>/dev/null | grep -oE -- '--allowedOrigins \\S+' || true`);
const expected = `--allowedOrigins ${urls.web}`;
if (proxyArgs.includes(urls.web) && xdhsArgs.includes(urls.web)) {
  console.log('✓ Proxy allowedOrigins already accept the live web hostname.');
} else {
  console.log(`
⚠ The proxy system units still gate on an OLD web hostname (needs sudo):
  sudo sed -i 's|${(proxyArgs.match(/https:\/\/\S+/) || ['OLD'])[0]}|${urls.web}|' /etc/systemd/system/xmage-proxy.service /etc/systemd/system/xmage-proxy-xdhs.service
  sudo systemctl daemon-reload && sudo systemctl restart xmage-proxy xmage-proxy-xdhs
`);
}

if (siteChanged && !CHECK) {
  console.log('Next: commit + push site/*.json so the GitHub Pages link follows the new hostname.');
}