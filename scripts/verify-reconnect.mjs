#!/usr/bin/env node
// Verifies that a player whose connection drops mid-game gets the game back WITH
// the pending prompt, against the local stack (HUMAN vs HUMAN duel, no browser;
// both players only pass, so the game runs on its own):
//   1) short drop (reload, network switch, phone in the background): A stays
//      silent on a prompt of its own (the engine now waits for it), its WebSocket
//      closes for 20 s, a new one re-attaches to the SAME XMage session
//      (`attached: true`, the proxy kept it alive) and `joinGame` replays the
//      state + the pending prompt; answering it makes the game advance,
//   1b) resumable stream: A drops while B holds the prompt, B answers during the
//      gap, and A re-attaches with its resume token: the proxy replays every
//      frame A missed (`resumed: true`, in stream order), including A's new
//      prompt, with no rejoin at all,
//   2) proxy restart mid-game: the server sees a lost connection (NOT a
//      "left XMage", which would remove the players from the table), both players
//      log in again through the new proxy (`attached: false`), the server restores
//      the game (`User.onReconnect`: START_GAME, GAME_INIT, re-asked prompt) and
//      the restore reaches the clients in server order with nothing dropped by
//      the proxy; the game advances again,
//   3) the proxy negotiates permessage-deflate with a client that offers it,
//   4) SIM seat across a proxy restart: in a HUMAN vs SIM game the proxy keeps
//      the bot on its roster, logs it in again when its owner comes back, and the
//      game keeps going through the bot's turns,
//   5) closed tab: a player whose page announces `leaving` and closes is gone
//      for good after the short grace period (45 s, not the 180 s of a dropped
//      connection): the opponent wins the game then,
//   6) (--server-outage only) the proxy loses the XMage server mid-game (the
//      server process is frozen with SIGSTOP for 30 s, like a network outage):
//      both players get `serverLink` lost → retrying → restored instead of being
//      sent back to the login screen, the server restores the game to the
//      re-logged sessions and it goes on, all on the same sockets.
//
// Regression guard for "the game froze waiting for my opponent, but it was my
// turn", and "it looked like I had abandoned the match", after a reconnect.
//
// Usage: node scripts/verify-reconnect.mjs [--skip-restart] [--server-outage] [--only-server-outage] [--only-leave]
// Requires: local server (testMode) + proxy started by scripts/ctl.mjs.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(ROOT, 'web', 'package.json'))
const WebSocket = require('ws')

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const PROXY_LOG = path.join(ROOT, '.run', 'proxy.err.log')
const SKIP_RESTART = process.argv.includes('--skip-restart')
const ONLY_OUTAGE = process.argv.includes('--only-server-outage')
const SERVER_OUTAGE = ONLY_OUTAGE || process.argv.includes('--server-outage')
const OUTAGE_SECS = 30
const ONLY_LEAVE = process.argv.includes('--only-leave')
const LEAVE_GRACE_SECS = 45
const STAMP = Date.now() % 1000000
const USER_A = `rcA${STAMP}`.slice(0, 14)
const USER_B = `rcB${STAMP}`.slice(0, 14)
const USER_C = `rcC${STAMP}`.slice(0, 14)
const USER_D = `rcD${STAMP}`.slice(0, 14)
const USER_E = `rcE${STAMP}`.slice(0, 14)
const USER_F = `rcF${STAMP}`.slice(0, 14)
const USER_G = `rcG${STAMP}`.slice(0, 14)
const SHORT_DROP_SECS = 20

const HUMAN_DECK = {
  name: 'Mage Web reconnect',
  cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
  sideboard: [],
}
const PROMPTS = new Set(['GAME_SELECT', 'GAME_ASK', 'GAME_TARGET', 'GAME_PLAY_MANA', 'GAME_PLAY_XMANA', 'GAME_CHOOSE_ABILITY', 'GAME_CHOOSE_CHOICE', 'GAME_GET_AMOUNT'])

const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function mkConn(label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, { perMessageDeflate: true, handshakeTimeout: 10000 })
    const pending = new Map()
    const waiters = []
    const conn = { ws, label, gameId: null, maxTurn: 0, lastViewAt: 0, events: [], frames: [], answering: true, streamId: null, lastSeq: 0 }
    let rid = 0

    conn.call = (action, args, ms = 20000) =>
      new Promise((res) => {
        const id = `${label}-${++rid}`
        const timer = setTimeout(() => {
          pending.delete(id)
          res({ ok: false, error: 'timeout' })
        }, ms)
        pending.set(id, (m) => {
          clearTimeout(timer)
          res(m)
        })
        ws.send(JSON.stringify({ requestId: id, action, args }))
      })

    conn.wait = (pred, ms, what) =>
      new Promise((res, rej) => {
        const hit = conn.events.find((e) => pred(e.msg))?.msg ?? conn.frames.find((f) => f.type !== 'event' && pred(f))
        if (hit) return res(hit)
        const timer = setTimeout(() => rej(new Error(`timeout waiting for ${what}`)), ms)
        waiters.push((m) => {
          if (!pred(m)) return false
          clearTimeout(timer)
          res(m)
          return true
        })
      })

    conn.answer = (m) => {
      const gameId = conn.gameId
      const d = m.data ?? {}
      const q = String(d.message ?? '')
      if (m.method === 'GAME_TARGET' && /discard/i.test(q)) {
        const pt = d.options?.possibleTargets ?? d.targets ?? []
        const id = Array.isArray(pt) ? (typeof pt[0] === 'string' ? pt[0] : pt[0]?.id) : Object.keys(pt)[0]
        if (id) return conn.call('sendPlayerUUID', { gameId, value: id })
      }
      return conn.call('sendPlayerBoolean', { gameId, value: false })
    }

    ws.on('open', () => resolve(conn))
    ws.on('error', () => reject(new Error('cannot reach the proxy')))
    ws.on('message', (raw) => {
      let m
      try {
        m = JSON.parse(String(raw))
      } catch {
        return
      }
      if (m.requestId && pending.has(m.requestId)) {
        if (m.action === 'connect' && m.ok && m.data?.streamId) conn.streamId = m.data.streamId
        pending.get(m.requestId)(m)
        pending.delete(m.requestId)
        return
      }
      if (typeof m.seq === 'number') conn.lastSeq = Math.max(conn.lastSeq, m.seq)
      if (m.type !== 'lobby') conn.frames.push(m)
      for (let i = waiters.length - 1; i >= 0; i--) if (m.type !== 'event' && waiters[i](m)) waiters.splice(i, 1)
      if (m.type !== 'event') return
      if (m.objectId && (m.method === 'START_GAME' || m.method === 'GAME_INIT') && !conn.gameId) conn.gameId = String(m.objectId)
      const view = m.data?.gameView ?? (m.method?.startsWith('GAME_') && m.data?.players ? m.data : null)
      if (view) {
        conn.maxTurn = Math.max(conn.maxTurn, Number(view.turn ?? 0))
        conn.lastViewAt = Date.now()
      }
      conn.events.push({ at: Date.now(), msg: m })
      if (conn.answering && conn.gameId && m.objectId === conn.gameId && PROMPTS.has(m.method)) void conn.answer(m)
      for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i](m)) waiters.splice(i, 1)
    })
  })
}

function proxyPid() {
  try {
    return fs.readFileSync(path.join(ROOT, '.run', 'proxy.pid'), 'utf8').trim()
  } catch {
    return ''
  }
}

function isAlive(pid) {
  try {
    process.kill(Number(pid), 0)
    return true
  } catch {
    return false
  }
}

function proxyLogSize() {
  try {
    return fs.statSync(PROXY_LOG).size
  } catch {
    return 0
  }
}

function proxyLogSince(offset) {
  try {
    const fd = fs.openSync(PROXY_LOG, 'r')
    const size = fs.fstatSync(fd).size
    const buf = Buffer.alloc(Math.max(0, size - offset))
    fs.readSync(fd, buf, 0, buf.length, offset)
    fs.closeSync(fd)
    return buf.toString('utf8')
  } catch {
    return ''
  }
}

async function login(label, user, gameId, attempts = 1, resume = null) {
  for (let i = 0; i < attempts; i++) {
    let c = null
    try {
      c = await mkConn(label)
    } catch {
      await sleep(2000)
      continue
    }
    c.gameId = gameId
    c.answering = false
    // right after a restart the server spends ~40 s on every callback to a session the old
    // proxy left behind, so a login can take minutes; like the web, wait for it instead of
    // opening a competing login
    const res = await c.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: user, password: 'x', ...(resume ? { resume } : null) }, 240000)
    if (res.ok) return { c, res }
    c.ws.terminate()
    await sleep(2000)
  }
  return { c: null, res: { ok: false, error: 'no login' } }
}

async function waitAdvance(conns, turn, ms) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline && Math.max(...conns.map((c) => c.maxTurn)) <= turn) await sleep(250)
  return Math.max(...conns.map((c) => c.maxTurn))
}

async function silentPrompt(c) {
  c.answering = false
  const since = c.events.length
  return c.wait(
    (m) => m.objectId === c.gameId && PROMPTS.has(m.method) && c.events.findIndex((e) => e.msg === m) >= since,
    90000,
    `a prompt of ${c.label} to leave unanswered`,
  )
}

async function main() {
  console.log(`[reconnect] ${USER_A} vs ${USER_B} on ${SERVER_HOST}:${SERVER_PORT} via ${WS_URL}`)
  let A = await mkConn('A')
  let B = await mkConn('B')
  check('permessage-deflate negotiated with the proxy', /permessage-deflate/.test(A.ws.extensions ?? ''), `extensions='${A.ws.extensions}'`)

  let res = await A.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER_A, password: 'x' })
  if (!check('login A', !!res.ok, res.error ?? '')) return
  res = await B.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER_B, password: 'x' })
  if (!check('login B', !!res.ok, res.error ?? '')) return
  res = await A.call('createTable', {
    name: `reconnect-${STAMP}`,
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Pioneer',
    winsNeeded: 1,
    playerTypes: ['HUMAN', 'HUMAN'],
    skipInitShuffling: true,
    skipStartingPlayerChoice: true,
  })
  const tableId = res.ok ? (res.data?.tableId ?? res.data?.table?.tableId ?? null) : null
  if (!check('createTable HUMAN vs HUMAN', !!tableId, res.error ?? '')) return
  for (const [c, user] of [[A, USER_A], [B, USER_B]]) {
    res = await c.call('joinTable', { tableId, playerName: user, playerType: 'HUMAN', skill: 1, deck: HUMAN_DECK })
    if (!check(`joinTable ${c.label}`, !!res.ok, res.error ?? '')) return
  }
  const startA = A.wait((m) => m.method === 'START_GAME', 30000, 'START_GAME A')
  const startB = B.wait((m) => m.method === 'START_GAME', 30000, 'START_GAME B')
  res = await A.call('startMatch', { tableId })
  if (!check('startMatch', !!res.ok, res.error ?? '')) return
  const gameId = String((await startA).objectId)
  await startB
  A.gameId = gameId
  B.gameId = gameId
  await A.call('joinGame', { gameId })
  await B.call('joinGame', { gameId })

  if (!check('the game reached turn >= 2', (await waitAdvance([A, B], 1, 90000)) >= 2, `turn=${Math.max(A.maxTurn, B.maxTurn)}`)) return

  // 1) short drop: the proxy keeps the XMage session, the web re-attaches
  let prompt = await silentPrompt(A)
  let turnAtDrop = Math.max(A.maxTurn, B.maxTurn)
  check('[drop] the engine waits for A', true, `${prompt.method} on turn ${turnAtDrop}`)
  A.ws.terminate()
  console.log(`[reconnect] A dropped for ${SHORT_DROP_SECS}s…`)
  await sleep(SHORT_DROP_SECS * 1000)
  ;({ c: A, res } = await login('A2', USER_A, gameId))
  if (!check('[drop] A logs in again', !!res.ok, res.error ?? '')) return
  check('[drop] it re-attached to the live XMage session', res.data?.attached === true, `attached=${res.data?.attached}`)
  res = await A.call('joinGame', { gameId })
  check('[drop] joinGame (the web resume)', !!res.ok, res.error ?? '')
  let replayed = null
  try {
    replayed = await A.wait((m) => m.objectId === gameId && PROMPTS.has(m.method), 10000, 'the replayed prompt')
  } catch {
    replayed = null
  }
  check('[drop] the pending prompt was replayed', !!replayed, replayed ? replayed.method : A.events.map((e) => e.msg.method).join(' '))
  A.answering = true
  if (replayed) await A.answer(replayed)
  check('[drop] the game advances after answering it', (await waitAdvance([A, B], turnAtDrop, 90000)) > turnAtDrop,
    `turn ${turnAtDrop} → ${Math.max(A.maxTurn, B.maxTurn)}`)

  // 1b) resumable stream: A misses frames while away and gets exactly those back
  B.answering = false
  prompt = await silentPrompt(B)
  turnAtDrop = Math.max(A.maxTurn, B.maxTurn)
  const token = { streamId: A.streamId, seq: A.lastSeq }
  check('[resume] A holds a resume token', !!token.streamId && token.seq > 0, JSON.stringify(token))
  A.ws.terminate()
  B.answering = true
  await B.answer(prompt)
  await sleep(4000)
  ;({ c: A, res } = await login('A4', USER_A, gameId, 1, token))
  if (!check('[resume] A logs in again with its token', !!res.ok, res.error ?? '')) return
  check('[resume] the proxy resumed the stream', res.data?.resumed === true, JSON.stringify(res.data))
  await sleep(1500)
  const seqs = A.frames.map((f) => f.seq).filter((n) => typeof n === 'number')
  check('[resume] only frames after the token, in stream order',
    seqs.length > 0 && seqs[0] > token.seq && seqs.every((n, i) => i === 0 || n > seqs[i - 1]), seqs.slice(0, 10).join(','))
  const missedPrompt = A.events.find((e) => e.msg.objectId === gameId && PROMPTS.has(e.msg.method))
  check('[resume] the prompt A missed arrived without any rejoin', !!missedPrompt, A.events.map((e) => e.msg.method).join(' '))
  A.answering = true
  if (missedPrompt) await A.answer(missedPrompt.msg)
  check('[resume] the game advances', (await waitAdvance([A, B], turnAtDrop, 90000)) > turnAtDrop,
    `turn ${turnAtDrop} → ${Math.max(A.maxTurn, B.maxTurn)}`)

  if (SKIP_RESTART) {
    await cleanup(A, B, tableId)
    await leavePhase()
    if (SERVER_OUTAGE) await serverOutagePhase()
    return
  }

  // a HUMAN vs SIM game is started now so the proxy restart below also covers the bot
  const sim = await startSimGame()

  // 2) proxy restart: new XMage sessions, the server restores the game
  prompt = await silentPrompt(A)
  turnAtDrop = Math.max(A.maxTurn, B.maxTurn)
  check('[restart] the engine waits for A', true, `${prompt.method} on turn ${turnAtDrop}`)
  B.answering = false
  console.log('[reconnect] restarting the proxy…')
  A.ws.terminate()
  B.ws.terminate()
  const oldPid = proxyPid()
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'ctl.mjs'), 'restart', 'proxy'], { stdio: 'ignore' })
  const restartDeadline = Date.now() + 120000
  while (Date.now() < restartDeadline && (proxyPid() === oldPid || isAlive(oldPid))) await sleep(500)
  if (!check('[restart] the proxy process was replaced', proxyPid() !== oldPid && !isAlive(oldPid), `pid ${oldPid} → ${proxyPid()}`)) return
  const logOffset = proxyLogSize()
  ;({ c: A, res } = await login('A3', USER_A, gameId, 60))
  if (!check('[restart] A logs in through the new proxy', !!res.ok, res.error ?? '')) return
  check('[restart] it is a new XMage session', res.data?.attached === false, `attached=${res.data?.attached}`)
  ;({ c: B, res } = await login('B3', USER_B, gameId, 10))
  if (!check('[restart] B logs in through the new proxy', !!res.ok, res.error ?? '')) return

  let restored = null
  try {
    restored = await A.wait((m) => m.objectId === gameId && PROMPTS.has(m.method), 30000, 'the restored prompt')
  } catch {
    restored = null
  }
  const methods = A.events.map((e) => `${e.msg.method}#${e.msg.messageId}`)
  check('[restart] the restored prompt reached A without any rejoin', !!restored, restored ? restored.method : `events: ${methods.join(' ')}`)
  const init = A.events.find((e) => e.msg.method === 'GAME_INIT' && e.msg.objectId === gameId)
  check('[restart] GAME_INIT of the game was restored', !!init)
  if (restored && init) {
    check('[restart] the prompt arrived after its GAME_INIT', A.events.indexOf(init) < A.events.findIndex((e) => e.msg === restored),
      methods.slice(0, 8).join(' '))
  }
  // lobby chat is held back until the login handshake ends (ProxyClient.handshakeBuffer), so
  // only the game's own events must keep the server order
  const ids = A.events.filter((e) => e.msg.objectId === gameId || e.msg.method === 'JOINED_TABLE')
    .map((e) => e.msg.messageId).filter((n) => typeof n === 'number')
  check('[restart] restored game events are in messageId order', ids.every((n, i) => i === 0 || n > ids[i - 1]), ids.slice(0, 12).join(','))
  for (const c of [A, B]) {
    res = await c.call('joinGame', { gameId })
    check(`[restart] joinGame ${c.label} (the web resume)`, !!res.ok, res.error ?? '')
  }
  A.answering = true
  B.answering = true
  if (restored) await A.answer(restored)
  const lastB = [...B.events].reverse().find((e) => e.msg.objectId === gameId && PROMPTS.has(e.msg.method))
  if (lastB) await B.answer(lastB.msg)
  check('[restart] the game advances after answering it', (await waitAdvance([A, B], turnAtDrop, 90000)) > turnAtDrop,
    `turn ${turnAtDrop} → ${Math.max(A.maxTurn, B.maxTurn)}`)
  const ignored = proxyLogSince(logOffset).split('\n').filter((l) => l.includes('event IGNORED') && l.includes(gameId))
  check('[restart] the proxy dropped no event of the game as foreign', ignored.length === 0, ignored.slice(0, 2).join(' | '))
  await cleanup(A, B, tableId)
  if (sim) await simAfterRestart(sim, logOffset)
  await leavePhase()
  if (SERVER_OUTAGE) await serverOutagePhase()
}

const SIM_DECK = {
  name: 'Sim lands',
  cards: [{ cardName: 'Island', setCode: 'LEA', cardNumber: '288', amount: 60 }],
  sideboard: [],
}

async function startSimGame() {
  const C = await mkConn('C')
  let res = await C.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER_C, password: 'x' })
  if (!check('[sim] login C', !!res.ok, res.error ?? '')) return null
  res = await C.call('createTable', {
    name: `reconnect-sim-${STAMP}`,
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Pioneer',
    winsNeeded: 1,
    playerTypes: ['HUMAN', 'SIM'],
    simDecks: [SIM_DECK],
    skipInitShuffling: true,
    skipStartingPlayerChoice: true,
  })
  const tableId = res.ok ? (res.data?.tableId ?? res.data?.table?.tableId ?? null) : null
  if (!check('[sim] createTable HUMAN vs SIM', !!tableId, res.error ?? '')) return null
  res = await C.call('joinTable', { tableId, playerName: USER_C, playerType: 'HUMAN', skill: 1, deck: HUMAN_DECK })
  if (!check('[sim] joinTable C', !!res.ok, res.error ?? '')) return null
  const start = C.wait((m) => m.method === 'START_GAME', 30000, 'START_GAME C')
  res = await C.call('startMatch', { tableId })
  if (!check('[sim] startMatch', !!res.ok, res.error ?? '')) return null
  const gameId = String((await start).objectId)
  C.gameId = gameId
  await C.call('joinGame', { gameId })
  if (!check('[sim] the SIM game reached turn >= 2', (await waitAdvance([C], 1, 90000)) >= 2, `turn=${C.maxTurn}`)) return null
  C.answering = false
  return { C, gameId, tableId }
}

async function simAfterRestart(sim, logOffset) {
  sim.C.ws.terminate()
  const turnAtRestart = sim.C.maxTurn
  const { c: C, res } = await login('C2', USER_C, sim.gameId, 30)
  if (!check('[sim] C logs in through the new proxy', !!res.ok, res.error ?? '')) return
  let restoredLine = ''
  const deadline = Date.now() + 30000
  while (Date.now() < deadline && !restoredLine) {
    restoredLine = proxyLogSince(logOffset).split('\n').find((l) => /sim sim-\d+ restored for .*=> true/.test(l)) ?? ''
    await sleep(500)
  }
  check('[sim] the proxy logged the SIM seat in again', !!restoredLine, restoredLine.trim())
  C.answering = true
  const lastPrompt = [...C.events].reverse().find((e) => e.msg.objectId === sim.gameId && PROMPTS.has(e.msg.method))
  if (lastPrompt) await C.answer(lastPrompt.msg)
  await C.call('joinGame', { gameId: sim.gameId })
  const turn = await waitAdvance([C], turnAtRestart + 1, 120000)
  check('[sim] the game goes on through the SIM turns', turn > turnAtRestart + 1, `turn ${turnAtRestart} → ${turn}`)
  C.answering = false
  await C.call('quitMatch', { gameId: sim.gameId })
  await C.call('removeTable', { tableId: sim.tableId })
  C.ws.close()
}

async function startDuel(labelA, userA, labelB, userB) {
  const A = await mkConn(labelA)
  const B = await mkConn(labelB)
  for (const [c, user] of [[A, userA], [B, userB]]) {
    const r = await c.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: user, password: 'x' })
    if (!check(`login ${c.label}`, !!r.ok, r.error ?? '')) return null
  }
  let res = await A.call('createTable', {
    name: `reconnect-${labelA}-${STAMP}`,
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Pioneer',
    winsNeeded: 1,
    playerTypes: ['HUMAN', 'HUMAN'],
    skipInitShuffling: true,
    skipStartingPlayerChoice: true,
  })
  const tableId = res.ok ? (res.data?.tableId ?? res.data?.table?.tableId ?? null) : null
  if (!check(`createTable ${labelA} vs ${labelB}`, !!tableId, res.error ?? '')) return null
  for (const [c, user] of [[A, userA], [B, userB]]) {
    res = await c.call('joinTable', { tableId, playerName: user, playerType: 'HUMAN', skill: 1, deck: HUMAN_DECK })
    if (!check(`joinTable ${c.label}`, !!res.ok, res.error ?? '')) return null
  }
  const startA = A.wait((m) => m.method === 'START_GAME', 30000, `START_GAME ${labelA}`)
  const startB = B.wait((m) => m.method === 'START_GAME', 30000, `START_GAME ${labelB}`)
  res = await A.call('startMatch', { tableId })
  if (!check(`startMatch ${labelA} vs ${labelB}`, !!res.ok, res.error ?? '')) return null
  const gameId = String((await startA).objectId)
  await startB
  A.gameId = gameId
  B.gameId = gameId
  await A.call('joinGame', { gameId })
  await B.call('joinGame', { gameId })
  return { A, B, gameId, tableId }
}

async function leavePhase() {
  const duel = await startDuel('F', USER_F, 'G', USER_G)
  if (!duel) return
  const { A: F, B: G, gameId, tableId } = duel
  if (!check('[leave] the game reached turn >= 2', (await waitAdvance([F, G], 1, 90000)) >= 2, `turn=${Math.max(F.maxTurn, G.maxTurn)}`)) return
  // F leaves; G keeps playing, as an opponent at the keyboard would (the server handles the
  // departure when the game gets to it, so a silent G on its own prompt would stall it)
  F.answering = false
  G.answering = true
  const leftAt = Date.now()
  F.ws.send(JSON.stringify({ action: 'leaving', args: {} }))
  F.ws.close(1001)
  const over = (m) => m.objectId === gameId && (m.method === 'GAME_OVER' || m.method === 'END_GAME_INFO')
  let ended = null
  try {
    ended = await G.wait(over, (LEAVE_GRACE_SECS + 60) * 1000, 'the end of the game')
  } catch {
    ended = null
  }
  const secs = Math.round((Date.now() - leftAt) / 1000)
  check('[leave] the opponent wins after the short grace period', !!ended && secs >= LEAVE_GRACE_SECS - 2 && secs < LEAVE_GRACE_SECS + 45,
    ended ? `${ended.method} after ${secs}s` : `nothing after ${secs}s`)
  G.answering = false
  await G.call('quitMatch', { gameId })
  await G.call('removeTable', { tableId })
  G.ws.close()
}

function serverPid() {
  try {
    return Number(fs.readFileSync(path.join(ROOT, '.run', 'server.pid'), 'utf8').trim())
  } catch {
    return 0
  }
}

async function serverOutagePhase() {
  const duel = await startDuel('D', USER_D, 'E', USER_E)
  if (!duel) return
  const { A: D, B: E, gameId, tableId } = duel
  if (!check('[outage] the game reached turn >= 2', (await waitAdvance([D, E], 1, 90000)) >= 2, `turn=${Math.max(D.maxTurn, E.maxTurn)}`)) return
  const prompt = await silentPrompt(D)
  const turnAtOutage = Math.max(D.maxTurn, E.maxTurn)
  check('[outage] the engine waits for D', true, `${prompt.method} on turn ${turnAtOutage}`)
  const pid = serverPid()
  if (!check('[outage] server pid known', pid > 0)) return
  const eventsBefore = D.events.length
  console.log(`[reconnect] freezing the XMage server for ${OUTAGE_SECS}s…`)
  process.kill(pid, 'SIGSTOP')
  const link = (state) => (m) => m.type === 'serverLink' && m.state === state
  let lost = null
  try {
    lost = await D.wait(link('lost'), (OUTAGE_SECS - 2) * 1000, 'serverLink lost')
  } catch {
    lost = null
  } finally {
    await sleep(Math.max(0, OUTAGE_SECS * 1000))
    process.kill(pid, 'SIGCONT')
  }
  console.log('[reconnect] server resumed')
  check('[outage] D is told the server link was lost', !!lost)
  let restored = null
  try {
    restored = await D.wait(link('restored'), 240000, 'serverLink restored')
  } catch {
    restored = null
  }
  const trail = (c) => c.frames.filter((f) => f.type === 'serverLink').map((f) => `${f.state}${f.attempt ? `#${f.attempt}` : ''}`).join(' ')
  check('[outage] the proxy logged D in again by itself', !!restored, trail(D))
  try {
    await E.wait(link('restored'), 120000, 'serverLink restored E')
    check('[outage] and E', true, trail(E))
  } catch {
    check('[outage] and E', false, trail(E))
  }
  check('[outage] nobody was sent to the login screen', ![D, E].some((c) => c.frames.some((f) => f.type === 'disconnected')))
  let again = null
  try {
    again = await D.wait((m) => m.objectId === gameId && PROMPTS.has(m.method) && D.events.findIndex((e) => e.msg === m) >= eventsBefore,
      60000, 'the restored prompt')
  } catch {
    again = null
  }
  if (!again) {
    // the web rejoins on `restored`; do the same
    await D.call('joinGame', { gameId })
    await E.call('joinGame', { gameId })
    try {
      again = await D.wait((m) => m.objectId === gameId && PROMPTS.has(m.method) && D.events.findIndex((e) => e.msg === m) >= eventsBefore,
        20000, 'the replayed prompt')
    } catch {
      again = null
    }
  }
  check('[outage] D has its prompt again on the same socket', !!again, D.events.slice(eventsBefore).map((e) => e.msg.method).join(' '))
  D.answering = true
  E.answering = true
  if (again) await D.answer(again)
  const lastE = [...E.events].reverse().find((e) => e.msg.objectId === gameId && PROMPTS.has(e.msg.method))
  if (lastE) await E.answer(lastE.msg)
  check('[outage] the game goes on after the outage', (await waitAdvance([D, E], turnAtOutage, 90000)) > turnAtOutage,
    `turn ${turnAtOutage} → ${Math.max(D.maxTurn, E.maxTurn)}`)
  await cleanup(D, E, tableId)
}

async function cleanup(A, B, tableId) {
  for (const c of [A, B]) {
    c.answering = false
    await c.call('quitMatch', { gameId: c.gameId })
  }
  await A.call('removeTable', { tableId })
  A.ws.close()
  B.ws.close()
}

try {
  if (ONLY_OUTAGE) await serverOutagePhase()
  else if (ONLY_LEAVE) await leavePhase()
  else await main()
} catch (e) {
  check('run', false, e.message)
}
const failed = checks.filter((c) => !c.ok)
console.log(`[reconnect] ${checks.length - failed.length}/${checks.length} checks passed`)
process.exit(failed.length ? 1 : 0)
