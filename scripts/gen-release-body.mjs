/*
 * Build the body of a GitHub release so its 27 assets are decodable.
 *
 * The release carries one launcher installer per OS plus everything the launcher
 * downloads by itself (JRE, server, both proxy flavours) and the updater
 * signatures. Visitors used to see 27 files and no clue; the reporter on issue #12
 * spent longer on that list than on the client. So the body now names the ONE file
 * each OS needs, and says out loud that the rest is machine-only.
 *
 * The extension table below is mirrored in site/app.js (OS_FILES): the site picks
 * the same files at page load from the release API. Change one, change the other.
 *
 *   node scripts/gen-release-body.mjs --assets-dir release-assets --tag v0.4.5 \
 *        --notes "..." --out release-body.md
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const HUMAN_FILES = [
  { label: 'Windows 10/11', suffix: '.exe', hint: 'run the installer' },
  { label: 'Windows (alternative)', suffix: '.msi', hint: 'run the installer' },
  { label: 'macOS (Apple Silicon)', suffix: '.dmg', hint: 'open the disk image' },
  { label: 'Linux (no install)', suffix: '.AppImage', hint: 'chmod +x, then run it' },
  { label: 'Linux (.deb, Debian/Ubuntu)', suffix: '.deb', hint: 'install with your package manager' },
  { label: 'Linux (.rpm, Fedora/openSUSE)', suffix: '.rpm', hint: 'install with your package manager' },
]

const MACHINE_PREFIXES = ['nexus-jre-', 'nexus-server-', 'nexus-proxy-', 'latest.json', 'components-manifest.json']

function arg(name, fallback = '') {
  const i = process.argv.indexOf('--' + name)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function mb(bytes) {
  const m = bytes / 1048576
  return (m >= 10 ? Math.round(m) : Math.round(m * 10) / 10) + ' MB'
}

function isUpdaterNoise(name) {
  return name.endsWith('.sig') || name.endsWith('.app.tar.gz') || name === 'latest.json' || name === 'components-manifest.json'
}

function isMachineOnly(name) {
  return MACHINE_PREFIXES.some((p) => name.startsWith(p)) || isUpdaterNoise(name)
}

export function buildBody({ files, tag, notes }) {
  const rows = []
  const taken = new Set()
  for (const entry of HUMAN_FILES) {
    const file = files.find((f) => f.name.endsWith(entry.suffix) && !isMachineOnly(f.name) && !isUpdaterNoise(f.name))
    if (!file) continue
    taken.add(file.name)
    rows.push(`| ${entry.label} | \`${file.name}\` | ${mb(file.size)} | ${entry.hint} |`)
  }

  const machine = files.filter((f) => isMachineOnly(f.name))
  const machineBytes = machine.reduce((sum, f) => sum + f.size, 0)
  const leftovers = files.filter((f) => !taken.has(f.name) && !isMachineOnly(f.name) && !isUpdaterNoise(f.name))

  const lines = []
  if (rows.length) {
    lines.push('## Download: pick ONE file, the one for your system', '')
    lines.push('| Your system | File | Size | Then |', '| --- | --- | --- | --- |', ...rows, '')
    lines.push('You do not need to clone anything or run any command to play.', '')
  } else {
    lines.push('## Download', '', 'No launcher installer was found in the assets below — pick the one for your system by hand.', '')
  }
  if (machine.length) {
    lines.push(
      `**The other ${machine.length} files (${mb(machineBytes)}) are not for you.** ` +
        'The `nexus-jre-*`, `nexus-server-*`, `nexus-proxy-*` and `nexus-proxy-xdhs-*` tarballs are fetched ' +
        'automatically by the launcher on first run (that is how it installs Java, the server and the proxy), ' +
        'and the `.sig` files plus `latest.json` are the updater signatures and its feed. ' +
        'Download them only if you are setting up a server by hand.',
      '',
    )
  }
  if (leftovers.length) {
    lines.push('Unrecognised assets (check these if a download guide row looks wrong): ' + leftovers.map((f) => `\`${f.name}\``).join(', '), '')
  }
  if (notes) lines.push(`<details><summary>What changed in ${tag || 'this release'}</summary>`, '', notes, '', '</details>', '')
  return lines.join('\n')
}

function readAssets(dir) {
  return readdirSync(dir)
    .filter((f) => statSync(path.join(dir, f)).isFile())
    .map((f) => ({ name: f, size: statSync(path.join(dir, f)).size }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = arg('assets-dir')
  const tag = arg('tag')
  const notes = arg('notes') || process.env.NOTES || ''
  const out = arg('out')
  let files = []
  try {
    files = readAssets(dir)
  } catch (e) {
    console.error(`gen-release-body: could not read ${dir} (${e.code}); emitting the notes only`)
  }
  const body = buildBody({ files, tag, notes })
  if (out) {
    writeFileSync(out, body)
    const guides = (body.match(/^\| /gm) || []).length
    console.log(`gen-release-body: ${files.length} assets -> ${out} (${guides} guide rows)`)
    if (guides === 0) {
      console.error('gen-release-body: WARNING - no installer recognised; check HUMAN_FILES (the release still goes out)')
    }
  } else {
    process.stdout.write(body)
  }
}
