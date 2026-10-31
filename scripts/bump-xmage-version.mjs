#!/usr/bin/env node
// Moves every reference to the XMage release the product is built on to a new one, the step 3
// of the mage-fork-upgrade skill. It only rewrites the forms that name the current release
// (1.4.62-V1, xmage_1.4.62V1, mage-proxy-1.4.62.jar, XMAGE_VERSION, the proxy pom version and the
// launcher component release); a bare "1.4.62" in a comment is history and stays as it is.
// Usage: node scripts/bump-xmage-version.mjs <from, e.g. 1.4.62-V1> <to, e.g. 1.4.63-V1> [--dry-run]

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseRelease } from './check-upstream-release.mjs'

const EXCLUDED = [
  /^\.github\/workflows\//,
  /^docs\/history\//,
  /^ROADMAP\.md$/,
  /^site\/status\.json$/,
  /^web\/fixtures\/recorded\//,
  /^scripts\/check-upstream-release\.test\.mjs$/,
  /^scripts\/assemble-modules\.test\.mjs$/,
  /^scripts\/bump-xmage-version(\.test)?\.mjs$/,
  /^Mage\.Proxy\/src\/test\//,
  /^web\/src\//,
]

function parts(release) {
  const parsed = parseRelease(release)
  if (!parsed) throw new Error(`not an XMage release: ${release}`)
  const [major, minor, patch, build, letter] = parsed.key
  const maven = `${major}.${minor}.${patch}`
  const info = `V${build}${letter}`
  return { maven, info, full: `${maven}-${info}`, tag: `xmage_${maven}${info}` }
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function replacementsFor(fromRelease, toRelease) {
  const from = parts(fromRelease)
  const to = parts(toRelease)
  return {
    from,
    to,
    everywhere: [
      [from.tag, to.tag],
      [from.full, to.full],
      [`mage-proxy-${from.maven}.jar`, `mage-proxy-${to.maven}.jar`],
    ],
    perFile: {
      'scripts/lib.mjs': [[`XMAGE_VERSION = '${from.maven}'`, `XMAGE_VERSION = '${to.maven}'`]],
      'scripts/gen-manifest.mjs': [['`${XMAGE_VERSION}-' + from.info + '`', '`${XMAGE_VERSION}-' + to.info + '`']],
      'Mage.Proxy/pom.xml': [
        [`<artifactId>mage-proxy</artifactId>\n    <version>${from.maven}</version>`, `<artifactId>mage-proxy</artifactId>\n    <version>${to.maven}</version>`],
      ],
      'launcher/manifest.example.json': [[`"${from.maven}-1"`, `"${to.maven}-1"`]],
      'launcher/src/manifest.rs': [[`"${from.maven}-1"`, `"${to.maven}-1"`]],
    },
  }
}

export function bumpText(file, text, plan) {
  let out = text.replace(/\r\n/g, '\n')
  const crlf = text.includes('\r\n')
  for (const [a, b] of plan.everywhere) out = out.replace(new RegExp(`${escape(a)}(?![0-9A-Za-z])`, 'g'), b)
  for (const [a, b] of plan.perFile[file] ?? []) out = out.split(a).join(b)
  if (crlf) out = out.replace(/\n/g, '\r\n')
  return out
}

function trackedFiles(root) {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !EXCLUDED.some((re) => re.test(f)))
}

export function bumpRepo(root, fromRelease, toRelease, { dryRun = false, files = trackedFiles(root) } = {}) {
  const plan = replacementsFor(fromRelease, toRelease)
  const changed = []
  for (const file of files) {
    const full = path.join(root, file)
    let text
    try {
      text = fs.readFileSync(full, 'utf8')
    } catch {
      continue
    }
    if (text.includes('\u0000')) continue
    const next = bumpText(file, text, plan)
    if (next === text) continue
    changed.push(file)
    if (!dryRun) fs.writeFileSync(full, next)
  }
  const pending = Object.entries(plan.perFile)
    .filter(([f, pairs]) => pairs.some(([a, b]) => a !== b) && files.includes(f) && !changed.includes(f))
    .map(([f]) => f)
  return { changed, pending }
}

function main() {
  const args = process.argv.slice(2)
  const [from, to] = args.filter((a) => !a.startsWith('--'))
  if (!from || !to) {
    console.error('usage: node scripts/bump-xmage-version.mjs <from> <to> [--dry-run]')
    process.exit(2)
  }
  const root = path.resolve(import.meta.dirname, '..')
  const { changed, pending } = bumpRepo(root, from, to, { dryRun: args.includes('--dry-run') })
  for (const f of changed) console.log(`bumped ${f}`)
  if (pending.length > 0) {
    console.error(`::error::these files should name ${from} and were not changed: ${pending.join(', ')}`)
    process.exit(1)
  }
  console.log(`${changed.length} files moved from ${from} to ${to}`)
}

if (import.meta.main) main()
