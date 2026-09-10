#!/usr/bin/env node
// Emite el fragmento de latest.json del updater para UNA plataforma, a partir
// de los bundles firmados que deja `cargo tauri build` en target/*/bundle.
// Uso:
//   node scripts/gen-latest.mjs --tag v0.1.0 --repo Adamychen/xmage-nexus \
//     --target-key darwin-aarch64 --bundle-dir target/release/bundle \
//     --out latest-darwin-aarch64.json
// El job publish fusiona los 3 fragmentos en latest.json.

import fs from 'node:fs'
import path from 'node:path'

function argValue(args, name) {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function main() {
  const args = process.argv.slice(2)
  const tag = argValue(args, '--tag')
  const repo = argValue(args, '--repo') ?? 'Adamychen/xmage-nexus'
  const targetKey = argValue(args, '--target-key')
  const bundleDir = path.resolve(argValue(args, '--bundle-dir') ?? 'target/release/bundle')
  const out = path.resolve(argValue(args, '--out') ?? `latest-${targetKey}.json`)
  if (!tag || !targetKey) {
    console.error('faltan --tag y/o --target-key')
    process.exit(1)
  }
  const files = walk(bundleDir).map((f) => path.basename(f))
  const archive = files.find(
    (f) => f.endsWith('.app.tar.gz') || f.endsWith('.AppImage.tar.gz') || f.endsWith('.nsis.zip'),
  )
  if (!archive) {
    console.error(`sin bundle de updater en ${bundleDir} (${files.join(', ')})`)
    process.exit(1)
  }
  const sigFile = walk(bundleDir).find((f) => f.endsWith(`${archive}.sig`))
  if (!sigFile) {
    console.error(`sin firma ${archive}.sig en ${bundleDir}`)
    process.exit(1)
  }
  const partial = {
    [targetKey]: {
      signature: fs.readFileSync(sigFile, 'utf8').trim(),
      url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(archive)}`,
    },
  }
  fs.writeFileSync(out, `${JSON.stringify(partial, null, 2)}\n`)
  console.log(`${targetKey}: ${archive} → ${out}`)
}

main()
