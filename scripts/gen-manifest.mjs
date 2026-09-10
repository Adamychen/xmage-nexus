#!/usr/bin/env node
// Genera components-manifest.json (+ latest.json para el updater) a partir de
// los tarballs de componentes empaquetados por modules.yml / release.yml.
// Uso:
//   node scripts/gen-manifest.mjs --tag v0.1.0 --repo Adamychen/xmage-nexus \
//     --dir /tmp/artifacts --out components-manifest.json
//   (--base-url para desarrollo local con tarballs file://)

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const COMPONENTS = ['jre', 'server', 'proxy']
const TARGETS = ['linux-x64', 'win-x64', 'mac-arm64']

function argValue(args, name) {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function main() {
  const args = process.argv.slice(2)
  const tag = argValue(args, '--tag')
  const repo = argValue(args, '--repo') ?? 'Adamychen/xmage-nexus'
  const dir = path.resolve(argValue(args, '--dir') ?? '.')
  const out = path.resolve(argValue(args, '--out') ?? 'components-manifest.json')
  const xmage = argValue(args, '--xmage') ?? '1.4.61-V1'
  const baseUrl =
    argValue(args, '--base-url') ?? `https://github.com/${repo}/releases/download/${tag}`
  if (!tag) {
    console.error('falta --tag (p. ej. v0.1.0)')
    process.exit(1)
  }
  const release = tag.startsWith('v') ? tag.slice(1) : tag
  const components = {}
  let files = 0
  for (const name of COMPONENTS) {
    const perTarget = {}
    for (const target of TARGETS) {
      const file = `nexus-${name}-${target}.tar.gz`
      const full = path.join(dir, file)
      if (!fs.existsSync(full)) continue
      perTarget[target] = {
        url: `${baseUrl}/${file}`,
        sha256: sha256(full),
        bytes: fs.statSync(full).size,
      }
      files++
    }
    if (Object.keys(perTarget).length) components[name] = perTarget
  }
  if (!files) {
    console.error(`sin tarballs nexus-*-*.tar.gz en ${dir}`)
    process.exit(1)
  }
  const manifest = {
    schema: 1,
    release,
    xmage,
    git_sha: gitSha(),
    min_launcher: '0.1.0',
    components,
  }
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`manifiesto ${release}: ${files} ficheros → ${out}`)
}

main()
