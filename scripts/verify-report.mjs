#!/usr/bin/env node
// Verifies the report channel against the real proxy: the auth gate, the caps, the quota, and
// that what the client sent actually lands (journal line + file).
//
// Usage: node scripts/verify-report.mjs [--reports-dir <path>]
// Requires: local stack running (node scripts/ctl.mjs status). The proxy writes its reports
// relative to its own working directory, which for the dev stack is Mage.Proxy/.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from './lib.mjs'

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const SUFFIX = String(Date.now()).slice(-6)
const USER_A = `rp-${SUFFIX}`
const USER_B = `rq-${SUFFIX}`
const REPORTS_DIR = flagValue('--reports-dir') ?? path.join(repoRoot, 'Mage.Proxy', 'reports')

function flagValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

let passCount = 0
let failCount = 0

function check(name, ok, detail = '') {
  if (ok) {
    passCount++
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failCount++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
  return ok
}

function makeConn(tag) {
  const ws = new WebSocket(WS_URL)
  const pending = new Map()
  const lines = []
  ws.onmessage = (msg) => {
    let m
    try {
      m = JSON.parse(String(msg.data))
    } catch {
      return
    }
    if (m.type === 'result') {
      const list = pending.get(m.action) ?? []
      const res = list.shift()
      if (res) res(m)
    }
  }
  const opened = new Promise((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error(`[${tag}] no se pudo conectar al proxy`))
  })
  const send = (action, args) => {
    ws.send(JSON.stringify({ action, args }))
    return new Promise((resolve) => {
      const list = pending.get(action) ?? []
      list.push(resolve)
      pending.set(action, list)
    })
  }
  return {
    tag,
    ws,
    opened,
    send,
    close: () => ws.close(),
    log: lines,
  }
}

const payload = {
  kind: 'bug',
  fingerprint: `verify-report-${SUFFIX}`,
  text: 'the angel kept priority after I lost',
  viewport: { width: 1920, height: 1080, dpr: 1 },
  errors: [{ at: Date.now(), source: 'boundary', text: 'TypeError: cannot read property of undefined' }],
  bundle: {
    appVersion: 'verify',
    userAgent: 'node',
    language: 'en',
    wsUrl: WS_URL,
    conn: { wsUrl: WS_URL, wsAlive: true, serverHost: SERVER_HOST, port: SERVER_PORT, username: USER_A },
    session: { phase: 'game', gameId: null, stagingTableId: null, watchingTableId: null },
    game: { turn: 4, step: 'MAIN1', activePlayer: null, players: [] },
    settings: { boardLayout: 'classic', uiScale: 1, soundEnabled: true, effects: true },
    log: [],
    frames: [],
  },
}

async function main() {
  const logged = makeConn('logged')
  await logged.opened
  const login = await logged.send('connect', {
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: USER_A,
    password: '',
  })
  if (!check('login en el servidor local', login.ok, login.error ?? '')) {
    logged.close()
    finish()
    return
  }

  const first = await logged.send('report_issue', payload)
  const id = first.data?.id
  check('a report is stored and answers with a reference', first.ok && first.data?.stored === true, JSON.stringify(first.data ?? first.error))
  check('the reference is eight hex characters', typeof id === 'string' && /^[0-9a-f]{8}$/.test(id), String(id))

  // the per-session interval is 30 s, so a second report inside it must be refused out loud
  // (the exact quota/duplicate rules are covered by ReportSinkTest, which can move the clock)
  const second = await logged.send('report_issue', { ...payload, fingerprint: `verify-report-2-${SUFFIX}` })
  check('a second report inside the interval is refused, not dropped', second.ok && second.data?.stored === false && second.data?.reason === 'rate', JSON.stringify(second.data))

  const fat = await logged.send('report_issue', { ...payload, fingerprint: `fat-${SUFFIX}`, bundle: { ...payload.bundle, log: [{ time: 1, from: 'x', text: 'z'.repeat(200_000) }] } })
  check('an oversized payload is refused with a visible error', fat.ok === false && /too large/i.test(fat.error ?? ''), fat.error ?? JSON.stringify(fat.data))

  const anonymous = makeConn('anon')
  await anonymous.opened
  const noSession = await anonymous.send('report_issue', { ...payload, fingerprint: `anon-${SUFFIX}` })
  check('the channel needs a session, so it cannot be flooded anonymously', noSession.ok === false && noSession.errorCode === 'NOT_AUTHORIZED', noSession.errorCode)
  anonymous.close()

  // the journal is the thing a maintainer greps, so it has to carry the reference
  const logFile = path.join(repoRoot, '.run', 'proxy.out.log')
  const journal = existsSync(logFile) ? readFileSync(logFile, 'utf8') : ''
  if (id) {
    const line = journal.split('\n').find((l) => l.includes(`ref=${id}`))
    check('the journal carries the report line', line !== undefined, line?.slice(-120) ?? 'no line')
  }

  if (existsSync(REPORTS_DIR)) {
    const days = readdirSync(REPORTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
    const files = days.flatMap((d) => readdirSync(path.join(REPORTS_DIR, d.name)).map((f) => path.join(d.name, f)))
    const mine = files.filter((f) => f.includes(id ?? '—'))
    check('the report file is on disk', mine.length === 1, `${files.length} files, mine=${mine.join(',')}`)
    if (mine.length === 1) {
      const body = JSON.parse(readFileSync(path.join(REPORTS_DIR, mine[0]), 'utf8'))
      check('the file carries the errors and the board, not just the text',
        body.text === payload.text && body.payload.errors.length === 1 && body.payload.bundle.game.turn === 4,
        `${Object.keys(body.payload).join(',')}`)
    }
  } else {
    console.log(`  SKIP  no ${REPORTS_DIR} (this proxy wrote no reports on this machine)`)
  }

  logged.send('disconnect', {})
  await new Promise((r) => setTimeout(r, 500))
  logged.close()
  finish()
}

function finish() {
  console.log(`\n  ${passCount} pass, ${failCount} fail`)
  process.exit(failCount > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(`error: ${err.stack ?? err.message}`)
  process.exit(1)
})
