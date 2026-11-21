/*
 * The body of a release, taken from the "What's new in <version>" section of readme.md.
 *
 * The readme has carried one such section per version since 0.5.0, hand-written in the PR
 * that bumps the version, and it is what anyone landing on the repository reads. The
 * GitHub release of that version and the news bell in the client say the same thing, so
 * that section is the single source instead of a second file that drifts from it:
 * deploy.yml reads it when it opens the release, and release.yml falls back to it when its
 * notes input is left empty.
 *
 *   node scripts/release-notes.mjs --version 0.9.0 [--readme readme.md] [--out notes.md]
 *
 * Exit code 1 when the section is missing, so the caller decides what that means. Both
 * workflows warn and carry on: the deploy has already happened by then, and a release with
 * a thin body beats no release at all.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HEADING = /^##\s+What's new in\s+(\S+)\s*$/i

/** The lines under "## What's new in <version>", up to the next "## " heading; null when there is no such section. */
export function sectionFor(readme, version) {
  const lines = readme.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((line) => HEADING.exec(line)?.[1] === version)
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => /^##\s/.test(line))
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  return body || null
}

function arg(name, fallback = '') {
  const i = process.argv.indexOf('--' + name)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

// Run as a command, not when imported by its test. Resolved both ways so it also
// fires on Windows, where argv[1] is a drive path and the file:// comparison never matches.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = arg('version')
  const readme = arg('readme', 'readme.md')
  const out = arg('out')
  if (!version) {
    console.error('release-notes: --version is required')
    process.exit(2)
  }
  const body = sectionFor(readFileSync(readme, 'utf8'), version)
  if (!body) {
    console.error(`release-notes: ${readme} has no "What's new in ${version}" section`)
    process.exit(1)
  }
  if (out) {
    writeFileSync(out, body + '\n')
    console.error(`release-notes: ${version} -> ${out} (${body.split('\n').length} lines)`)
  } else {
    process.stdout.write(body)
  }
}
