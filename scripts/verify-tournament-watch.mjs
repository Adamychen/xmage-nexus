#!/usr/bin/env node
// Verifica ver un match vivo de torneo contra el stack real (sin navegador):
// login -> torneo Constructed Elimination 2xIA -> arranque (owner) ->
// watch de la tabla torneo -> poll getTournament -> watch del match vivo ->
// WATCHGAME -> watchGame -> GAME_INIT. Imprime PASS/FAIL por paso.
// Uso: node scripts/verify-tournament-watch.mjs
// Requiere: servidor local (testMode) + proxy + vite (node scripts/ctl.mjs status).

import { repoRoot } from './lib.mjs'

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const USER = process.argv[2] ?? `tw-${Date.now() % 100000}`

// Mazo rápido con win-con: la partida IA vs IA termina en pocos turnos y el
// torrente de GAME_UPDATEs es corto (una partida sin win-con inunda la cola de
// callbacks y el WATCHGAME siguiente puede perderse). Mismo mazo que self-test.
const AI_DECK = {
  name: 'Mage Web starter',
  cards: [
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 4 },
    { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
    { cardName: 'Island', setCode: 'LEA', cardNumber: '288', amount: 20 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 16 },
    { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
  ],
  sideboard: [],
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

const timeout = (ms, label) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout esperando ${label} (${ms}ms)`)), ms))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`[tournament-watch] conectando a ${WS_URL} como ${USER}…`)

  const ws = new WebSocket(WS_URL)
  const pending = new Map()
  const waiters = []

  const waitEvent = (pred, label, ms = 20000) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout esperando ${label}`)), ms)
      const waiter = (ev) => {
        if (pred(ev)) {
          clearTimeout(timer)
          resolve(ev)
          return true
        }
        return false
      }
      waiters.push(waiter)
    })
  }

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
    } else if (m.type === 'error') {
      console.log(`  nota: error del proxy: ${m.message}`)
    } else {
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i](m)) waiters.splice(i, 1)
      }
    }
  }

  const opened = new Promise((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('no se pudo conectar al proxy'))
  })

  const send = (action, args) => {
    ws.send(JSON.stringify({ action, args }))
    return new Promise((resolve) => {
      const list = pending.get(action) ?? []
      list.push(resolve)
      pending.set(action, list)
    })
  }

  let tableId = null
  let gameId = null
  try {
    await Promise.race([opened, timeout(10000, 'apertura del WebSocket')])
    check('WebSocket al proxy', true)

    let res = await Promise.race([
      send('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER, password: 'x' }),
      timeout(15000, 'resultado de connect'),
    ])
    if (!check('connect/login', !!res.ok, `lastError='${res.error ?? ''}'`)) {
      ws.close()
      process.exit(1)
    }

    // Constructed Elimination: sin draft ni construcción, arranca directo al run.
    // Todo-IA: el proxy no expone joinTournament (los HUMAN no llegarían a joined
    // y el torneo no arrancaría); las IA quedan joined solas al sentarse.
    res = await Promise.race([
      send('createTournamentTable', {
        name: `tourn-eye-${Date.now() % 100000}`,
        tournamentType: 'Constructed Elimination',
        matchType: 'Two Player Duel',
        gameType: 'Two Player Duel',
        deckType: 'Constructed - Modern',
        winsNeeded: 1,
        password: '',
        playerTypes: ['COMPUTER_MAD', 'COMPUTER_MAD'],
        watchingAllowed: true,
        spectatorsAllowed: true,
        quitRatio: 100,
      }),
      timeout(15000, 'createTournamentTable'),
    ])
    tableId = res.ok ? (res.data?.tableId ?? null) : null
    if (!check('createTournamentTable', !!tableId, res.ok ? `tableId=${String(tableId).slice(0, 8)}…` : (res.error ?? ''))) {
      ws.close()
      process.exit(1)
    }

    for (let i = 0; i < 2; i++) {
      res = await Promise.race([
        send('joinTournamentTable', {
          tableId,
          playerName: i === 0 ? 'Computer' : 'Computer 2',
          playerType: 'COMPUTER_MAD',
          skill: 1,
          deck: AI_DECK,
        }),
        timeout(15000, `joinTournamentTable #${i + 1}`),
      ])
      if (!check(`joinTournamentTable IA ${i + 1}`, !!res.ok, res.error ?? '')) {
        ws.close()
        process.exit(1)
      }
    }

    res = await Promise.race([send('startTournament', { tableId }), timeout(20000, 'startTournament')])
    if (!check('startTournament (owner)', !!res.ok, res.error ?? '')) {
      ws.close()
      process.exit(1)
    }

    // Watch de la tabla torneo -> SHOW_TOURNAMENT (objectId = tournamentId).
    // Esto es lo que hace el modal del lobby al abrir el bracket.
    const showEvP = waitEvent((m) => m.method === 'SHOW_TOURNAMENT', 'SHOW_TOURNAMENT', 20000)
    res = await Promise.race([send('watchTournamentTable', { tableId }), timeout(15000, 'watchTournamentTable (torneo)')])
    if (!check('watchTournamentTable (tabla torneo)', !!res.ok, res.error ?? '')) {
      ws.close()
      process.exit(1)
    }
    let tournamentId = null
    try {
      const showEv = await Promise.race([showEvP, timeout(20000, 'SHOW_TOURNAMENT')])
      tournamentId = showEv.objectId ?? null
      check('evento SHOW_TOURNAMENT recibido', !!tournamentId, tournamentId ? `tournamentId=${String(tournamentId).slice(0, 8)}…` : '')
    } catch (e) {
      check('evento SHOW_TOURNAMENT recibido', false, e.message)
    }
    if (!tournamentId) {
      ws.close()
      process.exit(1)
    }

    // Poll del bracket hasta que haya un match vivo (mismo dato que pinta el ojo).
    let matchTableId = null
    const deadline = Date.now() + 60000
    while (!matchTableId && Date.now() < deadline) {
      res = await Promise.race([send('getTournament', { tournamentId }), timeout(10000, 'getTournament')])
      const rounds = res.ok ? (res.data?.rounds ?? []) : []
      for (const r of rounds) {
        for (const g of r.games ?? []) {
          if (g.tableId && typeof g.state === 'string' && g.state.startsWith('Dueling')) {
            matchTableId = g.tableId
            if (g.gameId) gameId = g.gameId
            break
          }
        }
        if (matchTableId) break
      }
      if (!matchTableId) await sleep(500)
    }
    if (!check('match vivo en el bracket', !!matchTableId, matchTableId ? `matchTable=${String(matchTableId).slice(0, 8)}…` : 'sin Dueling en 60s')) {
      ws.close()
      process.exit(1)
    }

    // El ojo del bracket: watchTournamentTable(matchTableId) -> WATCHGAME.
    let ev = null
    for (let attempt = 0; attempt < 2 && !ev; attempt++) {
      res = await Promise.race([send('watchTournamentTable', { tableId: matchTableId }), timeout(15000, 'watchTournamentTable (match)')])
      if (attempt === 0) check('watchTournamentTable (match vivo)', !!res.ok, res.error ?? '')
      if (!res.ok) break
      try {
        ev = await Promise.race([
          waitEvent((m) => m.method === 'WATCHGAME', 'WATCHGAME', 30000),
          timeout(30000, 'WATCHGAME'),
        ])
      } catch {
        if (attempt === 0) console.log('  nota: WATCHGAME lento, reintentando el watch del match…')
      }
    }
    if (!check('evento WATCHGAME del match recibido', !!ev, res.error ?? '')) {
      ws.close()
      process.exit(1)
    }
    gameId = ev.objectId ?? gameId
    const initEv = waitEvent((m) => m.method === 'GAME_INIT' && (!gameId || m.objectId === gameId), 'GAME_INIT', 30000)
    const gameWatchRes = await Promise.race([send('watchGame', { gameId }), timeout(15000, 'watchGame')])
    check('watchGame', !!gameWatchRes.ok, gameWatchRes.error ?? '')
    try {
      const init = await Promise.race([initEv, timeout(30000, 'GAME_INIT')])
      const players = init.data?.players?.length ?? init.data?.gameView?.players?.length ?? 0
      check('GAME_INIT con tablero', players >= 2, `${players} jugadores en el GameView`)
    } catch (e) {
      check('GAME_INIT con tablero', false, e.message)
    }
  } catch (e) {
    check('flujo global', false, e.message)
  } finally {
    // Higiene: la tabla torneo huérfana deja IAs jugando y degrada el servidor
    // (maxGameThreads=10); si falla, node scripts/clean-tables.mjs <usuario>.
    if (gameId) {
      try {
        await Promise.race([send('quitMatch', { gameId }), timeout(10000, 'quitMatch')])
      } catch { /* noop */ }
    }
    if (tableId) {
      try {
        await Promise.race([send('removeTable', { tableId }), timeout(10000, 'removeTable')])
      } catch { /* noop */ }
    }
    try {
      ws.close()
    } catch { /* noop */ }
  }

  console.log('')
  console.log(`[tournament-watch] RESULTADO: ${failCount === 0 ? 'TODO PASS' : `${failCount} FALLOS`} (${passCount} pass, ${failCount} fail)`)
  process.exit(failCount === 0 ? 0 : 1)
}

await main()
