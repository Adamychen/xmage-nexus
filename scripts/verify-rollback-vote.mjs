#!/usr/bin/env node
// Verifies the multiplayer rollback vote against the real local stack, with no
// browser: a 4-player Free For All with 4 HUMAN seats, each driven by its own
// WebSocket session (A requests, B/C/D vote). Three phases on the same game:
//   1) all accept   — B/C/D get USER_REQUEST_DIALOG (relatedUserName = A),
//                     all three accept, the server announces
//                     "Rolling back to start of turn T" and restores turn T.
//   2) mixed        — B accepts, C denies: "Rollback request denied by C" and
//                     no rollback; D's late accept is ignored.
//   3) slow voter   — B/C accept, D does not answer while the game advances;
//                     D's late accept executes the rollback counted from the
//                     turn in which it arrives (GameImpl.rollbackTurns uses
//                     getTurnNum() at execution time), not from the turn of the
//                     request. This documents the server semantics the web
//                     dialog warns about.
//   4) SIM seats    — a second table with 2 HUMAN + 2 SIM: the server counts SIM
//                     seats as human voters, so the proxy's SimPlayer must
//                     accept or no rollback could ever complete there.
//
// Usage: node scripts/verify-rollback-vote.mjs
// Requires: local server (testMode) + proxy (node scripts/ctl.mjs status).

import { wsConn } from './lib.mjs'

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const STAMP = Date.now() % 100000
const NAMES = ['A', 'B', 'C', 'D'].map((k) => `rv${k}${STAMP}`.slice(0, 14))
const SIM_NAMES = ['E', 'F'].map((k) => `rv${k}${STAMP}`.slice(0, 14))

const DECK = {
  name: 'Rollback vote lands',
  cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
  sideboard: [],
}

const SIM_DECK = {
  name: 'Rollback vote sim lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '263', amount: 50 },
  ],
  sideboard: [],
}

let passCount = 0
let failCount = 0

function check(name, ok, detail = '') {
  if (ok) passCount++
  else failCount++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

async function mkConn(name) {
  const conn = await wsConn(WS_URL, {
    name,
    init: {
      turn: 0, maxTurn: 0, lastViewAt: Date.now(),
      hold: false, heldSelect: null, chat: [], requests: [], turnsSeen: [],
    },
    onMessage(conn, m) {
      const gv = m.data?.gameView ?? (m.method === 'GAME_UPDATE' ? m.data : null)
      if (gv && typeof gv.turn === 'number') {
        conn.view = gv
        conn.turn = gv.turn
        conn.maxTurn = Math.max(conn.maxTurn, gv.turn)
        conn.lastViewAt = Date.now()
        if (conn.turnsSeen.at(-1)?.turn !== gv.turn) conn.turnsSeen.push({ turn: gv.turn, at: Date.now() })
      }
      if (m.method === 'CHATMESSAGE') conn.chat.push({ user: m.data?.username ?? '', text: stripTags(m.data?.message), at: Date.now() })
      if (m.method === 'USER_REQUEST_DIALOG') conn.requests.push({ data: m.data ?? {}, at: Date.now() })
    },
    autoAnswer(conn, m) {
      if (!conn.gameId) return
      const d = m.data ?? {}
      const q = String(d.message ?? '')
      if (m.method === 'GAME_SELECT') {
        if (conn.hold) {
          conn.heldSelect = m
          return
        }
        conn.pass()
        return
      }
      if (m.method === 'GAME_ASK' || m.method === 'GAME_PLAY_MANA' || m.method === 'GAME_PLAY_XMANA') {
        conn.pass()
        return
      }
      if (m.method === 'GAME_TARGET') {
        if (/discard/i.test(q)) {
          const pt = d.options?.possibleTargets ?? d.targets ?? []
          const id = Array.isArray(pt) ? (typeof pt[0] === 'string' ? pt[0] : pt[0]?.id) : Object.keys(pt)[0]
          if (id) {
            conn.ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId: conn.gameId, value: id } }))
            return
          }
        }
        conn.pass()
      }
    },
  })
  conn.pass = () => {
    if (!conn.gameId) return
    conn.ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId: conn.gameId, value: false } }))
  }
  conn.release = () => {
    conn.hold = false
    if (conn.heldSelect) {
      conn.heldSelect = null
      conn.pass()
    }
  }
  return conn
}

const isRollbackRequest = (m) => m.method === 'USER_REQUEST_DIALOG' && m.data?.button1Action === 'ADD_PERMISSION_TO_ROLLBACK_TURN'
const announceIn = (conn, since) => conn.chat.find((c) => c.at >= since && /rolling back to start of turn/i.test(c.text))
const announcedTurn = (entry) => Number(/turn\s+(\d+)/i.exec(entry?.text ?? '')?.[1] ?? NaN)

async function waitUntil(pred, ms, label, conns) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (pred()) return true
    if (conns && conns.every((c) => Date.now() - c.lastViewAt > 25000)) throw new Error(`game frozen while waiting for ${label}`)
    await sleep(250)
  }
  throw new Error(`timeout waiting for ${label}`)
}

async function holdPriority(A, others) {
  A.hold = true
  await waitUntil(() => A.heldSelect != null, 60000, 'priority for A', [A, ...others])
  await sleep(300)
  return A.turn
}

async function requestFromA(A, voters, turns) {
  const since = Date.now()
  const requests = voters.map((v) => v.wait(isRollbackRequest, 15000, 'rollback USER_REQUEST_DIALOG'))
  const res = await A.call('sendPlayerAction', { gameId: A.gameId, action: 'ROLLBACK_TURNS', data: turns })
  check(`A sends ROLLBACK_TURNS ${turns}`, !!res.ok, res.error ?? '')
  const got = await Promise.all(requests)
  return { since, requests: got }
}

const vote = (conn, req, accept) =>
  conn.call('sendPlayerAction', {
    gameId: conn.gameId,
    action: accept ? 'ADD_PERMISSION_TO_ROLLBACK_TURN' : 'DENY_PERMISSION_TO_ROLLBACK_TURN',
    data: req.data?.relatedUserId,
  })

async function simPhase() {
  console.log('\n[phase 4] 2 HUMAN + 2 SIM: the SIM seats accept')
  const conns = []
  let tableId = null
  try {
    for (const n of SIM_NAMES) conns.push(await mkConn(n))
    const [A, B] = conns
    for (const c of conns) {
      const res = await c.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: c.name, password: 'x' })
      if (!check(`connect/login ${c.name}`, !!res.ok, res.error ?? '')) return
    }
    let res = await A.call('createTable', {
      name: `rollback-sim-${STAMP}`,
      gameType: 'Free For All',
      deckType: 'Constructed - Pioneer',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'HUMAN', 'SIM', 'SIM'],
      simDecks: [SIM_DECK, SIM_DECK],
      rollbackTurnsAllowed: true,
      skipInitShuffling: true,
      skipStartingPlayerChoice: true,
    })
    tableId = res.ok ? (res.data?.tableId ?? res.data?.table?.tableId ?? null) : null
    if (!check('createTable FFA 4 (2 HUMAN + 2 SIM) with rollbacks', !!tableId, res.error ?? '')) return
    for (const c of conns) {
      res = await c.call('joinTable', { tableId, playerName: c.name, playerType: 'HUMAN', skill: 1, deck: DECK })
      if (!check(`joinTable ${c.name}`, !!res.ok, res.error ?? '')) return
    }
    const starts = conns.map((c) => c.wait((m) => m.method === 'START_GAME', 30000, 'START_GAME'))
    res = await A.call('startMatch', { tableId })
    if (!check('startMatch', !!res.ok, res.error ?? '')) return
    const startEvents = await Promise.all(starts)
    for (let i = 0; i < conns.length; i++) {
      const gameId = String(startEvents[i].objectId)
      await conns[i].call('joinGame', { gameId })
      const chat = await conns[i].call('getGameChatId', { gameId })
      conns[i].chatId = chat.data ?? chat.chatId
      if (conns[i].chatId) await conns[i].call('joinChat', { chatId: conns[i].chatId })
    }
    await waitUntil(() => A.maxTurn >= 2, 60000, 'turn 2', conns)
    const t = await holdPriority(A, [B])
    const p = await requestFromA(A, [B], 0)
    await vote(B, p.requests[0], true)
    await waitUntil(() => announceIn(A, p.since), 20000, 'rollback announce with SIM voters', conns)
    const ann = announceIn(A, p.since)
    check('with B and both SIM seats accepting, the rollback completes', announcedTurn(ann) === t, `${ann.text} (requested at ${t})`)
    A.release()
  } catch (err) {
    check('phase 4 without exceptions', false, err instanceof Error ? err.message : String(err))
  } finally {
    for (const c of conns) {
      if (c.gameId) await c.call('sendPlayerAction', { gameId: c.gameId, action: 'CONCEDE' }, 3000).catch(() => {})
    }
    if (tableId && conns[0]) await conns[0].call('removeTable', { tableId }, 5000).catch(() => {})
    for (const c of conns) await c.call('disconnect', {}, 3000).catch(() => {})
    for (const c of conns) c.close()
  }
}

async function main() {
  console.log(`[rollback-vote] 4 humans ${NAMES.join(', ')} against ${WS_URL}…`)
  const conns = []
  let tableId = null
  try {
    for (const n of NAMES) conns.push(await mkConn(n))
    const [A, B, C, D] = conns
    check('WebSockets to the proxy (4 sessions)', true)

    for (const c of conns) {
      const res = await c.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: c.name, password: 'x' })
      if (!check(`connect/login ${c.name}`, !!res.ok, res.error ?? '')) return
    }

    let res = await A.call('createTable', {
      name: `rollback-${STAMP}`,
      gameType: 'Free For All',
      deckType: 'Constructed - Pioneer',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'HUMAN', 'HUMAN', 'HUMAN'],
      rollbackTurnsAllowed: true,
      skipInitShuffling: true,
      skipStartingPlayerChoice: true,
    })
    tableId = res.ok ? (res.data?.tableId ?? res.data?.table?.tableId ?? null) : null
    if (!check('createTable FFA 4 HUMAN with rollbacks', !!tableId, res.error ?? '')) return

    for (const c of conns) {
      res = await c.call('joinTable', { tableId, playerName: c.name, playerType: 'HUMAN', skill: 1, deck: DECK })
      if (!check(`joinTable ${c.name}`, !!res.ok, res.error ?? '')) return
    }

    const starts = conns.map((c) => c.wait((m) => m.method === 'START_GAME', 30000, 'START_GAME'))
    res = await A.call('startMatch', { tableId })
    if (!check('startMatch', !!res.ok, res.error ?? '')) return
    const startEvents = await Promise.all(starts)
    for (let i = 0; i < conns.length; i++) {
      const c = conns[i]
      const gameId = String(startEvents[i].objectId)
      await c.call('joinGame', { gameId })
      const chat = await c.call('getGameChatId', { gameId })
      const chatId = chat.data ?? chat.chatId
      c.chatId = chatId
      if (chatId) await c.call('joinChat', { chatId })
    }
    check('START_GAME + joinGame + game chat for all four', conns.every((c) => !!c.gameId))

    await waitUntil(() => A.maxTurn >= 2, 60000, 'turn 2', conns)
    check('the game runs (turn >= 2)', true, `turn=${A.turn}`)

    console.log('\n[phase 1] all three accept')
    const t1 = await holdPriority(A, [B, C, D])
    const p1 = await requestFromA(A, [B, C, D], 0)
    const r0 = p1.requests[0].data
    check('voters get relatedUserName = requester', p1.requests.every((r) => r.data?.relatedUserName === A.name), `relatedUserName=${r0.relatedUserName}`)
    check('voters get relatedUserId', p1.requests.every((r) => typeof r.data?.relatedUserId === 'string' && r.data.relatedUserId.length > 0))
    check('message names the current turn', /current turn/i.test(r0.message ?? ''), r0.message)
    check('server title shows the voter, not the requester (upstream quirk)', !String(r0.title ?? '').includes(A.name), r0.title)
    await vote(B, p1.requests[0], true)
    const acceptText = (turn) => `accepted the rollback request (turn ${turn}, ${new Date().toTimeString().slice(0, 8)})`
    const chatSince = Date.now()
    const text1 = acceptText(t1)
    await B.call('sendChatMessage', { chatId: B.chatId, text: text1 })
    await waitUntil(() => A.chat.some((c) => c.at >= chatSince && c.user === B.name && c.text === text1), 10000, 'accept chat relayed', conns)
    check('the accept announcement reaches the other players as B\'s chat line', true, text1)
    await B.call('sendChatMessage', { chatId: B.chatId, text: text1 })
    await sleep(1500)
    check('server anti-spam drops an identical repeated line (why the web text varies)', A.chat.filter((c) => c.at >= chatSince && c.text === text1).length === 1)
    await vote(C, p1.requests[1], true)
    await sleep(1500)
    check('no rollback before the last vote', !announceIn(A, p1.since))
    await vote(D, p1.requests[2], true)
    await waitUntil(() => announceIn(A, p1.since) && announceIn(D, p1.since), 20000, 'rollback announce', conns)
    const ann1 = announceIn(A, p1.since)
    check('all accepted → server announces the rollback to every player', true, ann1.text)
    check('rolled back to the start of the requested turn', announcedTurn(ann1) === t1, `requested at ${t1}, announced ${announcedTurn(ann1)}`)
    A.release()
    await waitUntil(() => A.lastViewAt > ann1.at && A.turn === t1, 20000, 'restored view', conns)
    check('restored view arrives with the same turn', A.turn === t1, `turn=${A.turn}`)
    await waitUntil(() => A.maxTurn > t1, 90000, 'game advancing after rollback', conns)
    check('game keeps running after the rollback', true, `turn=${A.turn}`)

    console.log('\n[phase 2] B accepts, C denies, D late')
    const t2 = await holdPriority(A, [B, C, D])
    const p2 = await requestFromA(A, [B, C, D], 1)
    check('message names the previous turn', /previous turn/i.test(p2.requests[0].data?.message ?? ''), p2.requests[0].data?.message)
    await vote(B, p2.requests[0], true)
    await vote(C, p2.requests[1], false)
    await waitUntil(() => A.chat.some((c) => c.at >= p2.since && /rollback request denied by/i.test(c.text)), 15000, 'deny announce', conns)
    const deny = A.chat.find((c) => c.at >= p2.since && /rollback request denied by/i.test(c.text))
    check('deny is announced in chat with the denier name', deny.text.includes(C.name), deny.text)
    await vote(D, p2.requests[2], true)
    await sleep(3000)
    check('late accept after a deny does not roll back', !announceIn(A, p2.since))
    check('turn did not go back', A.turn >= t2, `before=${t2} now=${A.turn}`)
    A.release()

    console.log('\n[phase 3] D answers late while the game advances')
    const t3 = await holdPriority(A, [B, C, D])
    const p3 = await requestFromA(A, [B, C, D], 0)
    await vote(B, p3.requests[0], true)
    await vote(C, p3.requests[1], true)
    A.release()
    await waitUntil(() => A.maxTurn > t3, 90000, 'game advancing with the vote open', conns)
    check('the game advances while one vote is pending', true, `requested at ${t3}, now ${A.turn}`)
    const lateTurn = A.turn
    await vote(D, p3.requests[2], true)
    await waitUntil(() => announceIn(A, p3.since), 20000, 'late rollback announce', conns)
    const ann3 = announceIn(A, p3.since)
    check('late last accept executes the rollback', true, ann3.text)
    check('rollback counts from the turn of the last vote, not the request', announcedTurn(ann3) >= lateTurn && announcedTurn(ann3) > t3, `requested at ${t3} (0 turns back), last vote at ${lateTurn}, announced ${announcedTurn(ann3)}`)
  } catch (err) {
    check('run without exceptions', false, err instanceof Error ? err.message : String(err))
  } finally {
    for (const c of conns) {
      if (c.gameId) await c.call('sendPlayerAction', { gameId: c.gameId, action: 'CONCEDE' }, 3000).catch(() => {})
    }
    if (tableId && conns[0]) await conns[0].call('removeTable', { tableId }, 5000).catch(() => {})
    for (const c of conns) await c.call('disconnect', {}, 3000).catch(() => {})
    for (const c of conns) c.close()
  }
  await simPhase()
  console.log(`\n[rollback-vote] ${passCount} PASS, ${failCount} FAIL`)
  process.exit(failCount === 0 ? 0 : 1)
}

main()
