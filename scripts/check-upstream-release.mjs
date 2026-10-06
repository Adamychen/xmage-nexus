#!/usr/bin/env node
// Fails when magefree/mage has published a release newer than the one the fork
// (and therefore the proxy) is built from. The public server moves to every new
// release and refuses any other version, so a newer tag means the proxy is about
// to stop logging anyone in: merge it into the fork and rebuild.
// Usage: node scripts/check-upstream-release.mjs [fork version, e.g. 1.4.61-V1]

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { forkPath } from './lib.mjs'

const UPSTREAM = 'https://github.com/magefree/mage'

function parse(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)-?V(\d+)([a-z]*)$/i.exec(version)
  if (!m) return null
  return { text: `${m[1]}.${m[2]}.${m[3]}-V${m[4]}${m[5]}`, key: [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), m[5].toLowerCase()] }
}

function compare(a, b) {
  for (let i = 0; i < 4; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i]
  return a.key[4] < b.key[4] ? -1 : a.key[4] > b.key[4] ? 1 : 0
}

function forkVersion() {
  const src = fs.readFileSync(forkPath('Mage.Common/src/main/java/mage/utils/MageVersion.java'), 'utf8')
  const num = (name) => new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(src)?.[1]
  const info = /MAGE_VERSION_RELEASE_INFO\s*=\s*"([^"]*)"/.exec(src)?.[1]
  return `${num('MAGE_VERSION_MAJOR')}.${num('MAGE_VERSION_MINOR')}.${num('MAGE_VERSION_RELEASE')}-${info}`
}

function upstreamReleases() {
  const out = execFileSync('git', ['ls-remote', '--tags', UPSTREAM, 'xmage_*'], { encoding: 'utf8' })
  return out.split('\n')
    .map((line) => /refs\/tags\/xmage_([^\s^]+)$/.exec(line.trim())?.[1])
    .filter(Boolean)
    .map(parse)
    .filter(Boolean)
}

const ours = parse(process.argv[2] ?? forkVersion())
if (!ours) {
  console.error(`::error::cannot read the fork's XMage version (${process.argv[2] ?? forkVersion()})`)
  process.exit(2)
}
const releases = upstreamReleases()
if (releases.length === 0) {
  console.error(`::error::no xmage_* release tags found at ${UPSTREAM}`)
  process.exit(2)
}
const latest = releases.reduce((a, b) => (compare(a, b) >= 0 ? a : b))
if (compare(latest, ours) > 0) {
  console.error(`::error::magefree/mage released ${latest.text}; the fork and the proxy are still on ${ours.text}. `
    + 'The public server refuses older clients: merge the release into the fork (mage-fork-upgrade skill), rebuild and redeploy the proxy.')
  process.exit(1)
}
console.log(`Fork on ${ours.text}; newest upstream release ${latest.text}: up to date.`)
