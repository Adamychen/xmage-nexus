import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { sectionFor } from './release-notes.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(repoRoot, 'scripts', 'release-notes.mjs')

const README = [
  '# XMage Nexus',
  '',
  "## What's new in 0.9.0",
  '',
  '- **Decks**: the deck you play is the one you pick.',
  '',
  "## What's new in 0.8.0",
  '',
  '- **Search by rules text**: narrows to the cards that say it.',
  '',
  '## Install',
  '',
  'Download the installer.',
].join('\n')

test('a section is the lines under its heading, up to the next one', () => {
  assert.equal(sectionFor(README, '0.9.0'), '- **Decks**: the deck you play is the one you pick.')
  assert.equal(sectionFor(README, '0.8.0'), '- **Search by rules text**: narrows to the cards that say it.')
})

test('the heading itself never reaches the release body', () => {
  assert.doesNotMatch(sectionFor(README, '0.9.0'), /What's new/, 'the panel already shows the version')
})

test('a version with no section is null, and so is an empty one', () => {
  assert.equal(sectionFor(README, '0.7.0'), null)
  assert.equal(sectionFor("## What's new in 1.0.0\n\n\n## Install\n", '1.0.0'), null)
})

test('CRLF and a trailing section read the same', () => {
  assert.equal(sectionFor(README.split('\n').join('\r\n'), '0.9.0'), '- **Decks**: the deck you play is the one you pick.')
  assert.equal(sectionFor("## What's new in 2.0.0\n\n- Last one.\n", '2.0.0'), '- Last one.')
})

// The deploy publishes this section as the release body of the version it just put on the
// server, and the news bell shows it. A bump that forgets it would reach players as the one
// line the workflow falls back to, so the bump and the notes are checked together here.
test('readme.md has the section of the version in web/package.json', () => {
  const version = JSON.parse(fs.readFileSync(path.join(repoRoot, 'web', 'package.json'), 'utf8')).version
  const readme = fs.readFileSync(path.join(repoRoot, 'readme.md'), 'utf8')
  const body = sectionFor(readme, version)
  assert.ok(body, `readme.md needs a "What's new in ${version}" section: the deploy publishes it as the release body`)
  assert.match(body, /\S/)
})

test('the command prints the section, and fails loudly when it is missing', () => {
  const out = execFileSync(process.execPath, [script, '--version', JSON.parse(fs.readFileSync(path.join(repoRoot, 'web', 'package.json'), 'utf8')).version], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  assert.match(out, /\S/, 'the body goes to stdout')
  assert.throws(
    () => execFileSync(process.execPath, [script, '--version', '9.9.9'], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' }),
    /status 1|Command failed/,
    'a missing section is an exit code the workflow can branch on',
  )
})
