#!/usr/bin/env node
// Promote a collected report into a GitHub issue.
//
// Reports land on the machine that ran the proxy (the proxy writes them, see
// Mage.Proxy/ReportSink). This reads them, groups them by fingerprint so forty players are one
// row, renders the body with the fields the issue templates ask for, and - only with --yes -
// opens the issue with `gh`. The human stays in the loop on purpose: the payload carries other
// players' names and card lists, and the tracker is public.
//
// Usage
//   node scripts/issue-from-report.mjs --list
//   node scripts/issue-from-report.mjs --show <id|prefix>
//   node scripts/issue-from-report.mjs --open <id|fingerprint> [--yes] [--labels a,b]
//
// Options
//   --dir <path>     local reports directory (default: none, use --host or an explicit path)
//   --host <u@h>     fetch the reports over ssh first (tar over a single shell line)
//   --remote <path>  path on the host (default: ~/reports)
//   --repo <owner/repo>  passed to gh (default: Adamychen/xmage-nexus)
//   --days <n>       only reports newer than n days
//   --limit <n>      show at most n groups
//
// Exit codes: 0 ok, 1 nothing to do or gh failed.

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execSync, execFileSync } from 'node:child_process'

const DEFAULT_REPO = 'Adamychen/xmage-nexus'

function parseArgs(argv) {
  const opts = { repo: DEFAULT_REPO, days: 0, limit: 20, yes: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (arg === '--list') opts.command = 'list'
    else if (arg === '--show') { opts.command = 'show'; opts.target = next() }
    else if (arg === '--open') { opts.command = 'open'; opts.target = next() }
    else if (arg === '--yes') opts.yes = true
    else if (arg === '--dir') opts.dir = next()
    else if (arg === '--host') opts.host = next()
    else if (arg === '--remote') opts.remote = next()
    else if (arg === '--repo') opts.repo = next()
    else if (arg === '--days') opts.days = Number(next()) || 0
    else if (arg === '--limit') opts.limit = Number(next()) || 20
    else if (arg === '--labels') opts.labels = next()
    else {
      console.error(`unknown argument: ${arg}`)
      process.exit(1)
    }
  }
  opts.command ||= 'list'
  return opts
}

/** Reports live as <dir>/<yyyy-mm-dd>/<id>.json. */
function collect(dir, days) {
  if (!existsSync(dir)) return []
  const cutoff = days > 0 ? Date.now() - days * 86_400_000 : 0
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dayDir = path.join(dir, entry.name)
    for (const file of readdirSync(dayDir)) {
      if (!file.endsWith('.json')) continue
      const full = path.join(dayDir, file)
      const stat = statSync(full)
      if (cutoff && stat.mtimeMs < cutoff) continue
      try {
        const report = JSON.parse(readFileSync(full, 'utf8'))
        report.__file = full
        out.push(report)
      } catch (err) {
        console.error(`skip ${full}: ${err.message}`)
      }
    }
  }
  return out
}

function fetchFromHost(host, remote, dest) {
  console.error(`[reports] fetching ${remote} from ${host}`)
  const cmd = `ssh ${host} "cd '${remote}' && tar -cf - ." | tar -xf - -C '${dest}'`
  execSync(cmd, { stdio: 'inherit' })
  return dest
}

function groupBy(reports) {
  const byFp = new Map()
  for (const report of reports) {
    const fp = report.fingerprint || 'unknown'
    if (!byFp.has(fp)) byFp.set(fp, { fingerprint: fp, kind: report.kind, items: [] })
    byFp.get(fp).items.push(report)
  }
  const groups = [...byFp.values()].map((group) => {
    const items = [...group.items].sort((a, b) => (b.at || 0) - (a.at || 0))
    return {
      ...group,
      items,
      count: items.length,
      lastSeen: items[0]?.at ?? 0,
      versions: [...new Set(items.map((r) => r.payload?.bundle?.appVersion).filter(Boolean))],
      samples: [...new Set(items.map((r) => r.text).filter(Boolean))].slice(0, 3),
    }
  })
  return groups.sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
}

function formatTime(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16)
}

function listText(groups, limit) {
  const lines = []
  for (const group of groups.slice(0, limit)) {
    const versions = group.versions.length > 0 ? group.versions.join(', ') : 'unknown version'
    lines.push(`${String(group.count).padStart(4)}  ${group.kind.padEnd(8)} ${formatTime(group.lastSeen)}  ${versions}`)
    for (const sample of group.samples) lines.push(`        "${sample.slice(0, 100)}"`)
    lines.push(`        ${group.fingerprint}`)
    lines.push(`        ids: ${group.items.slice(0, 4).map((r) => r.id).join(', ')}${group.count > 4 ? ', …' : ''}`)
    lines.push('')
  }
  if (groups.length > limit) lines.push(`… ${groups.length - limit} more groups (raise --limit)`)
  if (groups.length === 0) lines.push('no reports in this directory')
  return lines.join('\n')
}

/** The two levels a report file has: the envelope the proxy wrote, and the bundle inside it. */
function wireOf(report) {
  return report.payload ?? {}
}

function bundleOf(report) {
  return wireOf(report).bundle ?? {}
}

/** The one line of the payload that tells us where in the game to look. */
function gameState(report) {
  const game = bundleOf(report).game
  if (!game) return null
  const players = (game.players ?? []).map((p) => `${p.name} ${String(p.life)}`).join(', ')
  return { turn: game.turn, step: game.step, active: game.activePlayer, players }
}

function errorLines(report, max = 8) {
  const errors = wireOf(report).errors ?? []
  return errors.slice(-max).map((e) => `- \`${e.text}\``)
}

function frameLines(report, max = 12) {
  const frames = bundleOf(report).frames ?? []
  return frames.slice(-max).map((f) => `- ${formatTime(f.at)} ${f.kind} (${f.bytes} bytes)`)
}

function titleFor(report) {
  const first = (report.text || '').split('\n')[0].trim()
  if (first.length > 0) return first.slice(0, 70)
  const game = gameState(report)
  return game ? `${report.kind}: something wrong around turn ${String(game.turn)}` : report.fingerprint.slice(0, 70)
}

function bodyFor(report, group) {
  const game = gameState(report)
  const wire = wireOf(report)
  const bundle = bundleOf(report)
  const viewport = wire.viewport ?? {}
  const environment = [
    `- Mode: ${bundle.conn?.wsAlive ? 'full stack (real)' : 'not connected at report time'}`,
    `- Proxy: ${bundle.conn?.wsUrl ?? 'none'}`,
    `- XMage server: ${bundle.conn?.serverHost ?? 'none'}:${bundle.conn?.port ?? 0}`,
    `- Client: ${bundle.appVersion ?? 'unknown'} (${bundle.userAgent ?? 'unknown browser'})`,
    `- Screen: ${viewport.width ?? '?'}x${viewport.height ?? '?'} at ${viewport.dpr ?? '?'}x`,
    game ? `- Game: ${game.players || 'no players'} - turn ${String(game.turn)}, step ${String(game.step)}` : '- Game: not in a game',
    `- Reported by ${group.count} player(s) with the same fingerprint, most recent ${formatTime(group.lastSeen)}`,
    `- Fingerprint: \`${report.fingerprint}\``,
  ]
  const sections =
    report.kind === 'bug'
      ? [
          '## What happened',
          '',
          report.text || '(no description)',
          '',
          '## Repro steps',
          '',
          'Reported by a player; steps not reproduced yet. The state below is what their client had.',
          '',
          '## Environment',
          '',
          ...environment,
          '',
          '## Logs',
          '',
          '```',
          ...errorLines(report),
          '```',
          '',
          'Last frames the client saw:',
          '',
          '```',
          ...frameLines(report),
          '```',
        ]
      : [
          '## What I was doing',
          '',
          report.text || '(no description)',
          '',
          '## Environment',
          '',
          ...environment,
        ]
  return sections.join('\n')
}

function openIssue(opts, report, group) {
  const labels = report.kind === 'bug' ? 'bug' : 'feedback'
  const extra = opts.labels ? `,${opts.labels}` : ''
  const body = bodyFor(report, group)
  console.log(body)
  if (!opts.yes) {
    console.log('\n(dry run: pass --yes to open it with gh)')
    return 0
  }
  const tmp = mkdtempSync(path.join(tmpdir(), 'nexus-report-'))
  const file = path.join(tmp, 'body.md')
  writeFileSync(file, body)
  try {
    const out = execFileSync(
      'gh',
      [
        'issue', 'create',
        '--repo', opts.repo,
        '--title', titleFor(report),
        '--body-file', file,
        '--label', `${labels}${extra}`,
      ],
      { encoding: 'utf8' },
    )
    console.log(`\nopened: ${out.trim()}`)
    return 0
  } catch (err) {
    console.error(`gh failed: ${err.message}`)
    return 1
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  let dir = opts.dir
  if (!dir && opts.host) {
    const tmp = mkdtempSync(path.join(tmpdir(), 'nexus-reports-'))
    try {
      dir = fetchFromHost(opts.host, opts.remote ?? '~/reports', tmp)
    } catch (err) {
      console.error(`could not fetch the reports: ${err.message}`)
      process.exit(1)
    }
  }
  if (!dir || !existsSync(dir)) {
    console.error('no reports directory: pass --dir <path> or --host <user@machine>')
    process.exit(1)
  }

  const reports = collect(dir, opts.days)
  const groups = groupBy(reports)

  if (opts.command === 'list') {
    console.log(listText(groups, opts.limit))
    process.exit(0)
  }

  const matches =
    groups.find((g) => g.fingerprint === opts.target) ??
    groups.find((g) => g.items.some((r) => r.id === opts.target || r.id?.startsWith(opts.target)))
  if (!matches) {
    console.error(`nothing matches "${opts.target}" (run --list to see the groups)`)
    process.exit(1)
  }
  const newest = matches.items[0]
  if (opts.command === 'show') {
    console.log(bodyFor(newest, matches))
    process.exit(0)
  }
  process.exit(openIssue(opts, newest, matches))
}

main()
