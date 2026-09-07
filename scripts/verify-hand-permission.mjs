#!/usr/bin/env node
// Verifica el flujo de permiso de mano (G12-1) contra el stack real:
// A (jugador) crea mesa HUMAN vs IA y arranca; B (espectador) pide ver la
// mano de A -> A recibe USER_REQUEST_DIALOG (Accept) -> A concede ->
// B re-observa y su GameView trae watchedHands con la mano de A.
// Uso: node scripts/verify-hand-permission.mjs
// Requiere: servidor local (testMode) + proxy (node scripts/ctl.mjs status).

import { repoRoot } from './lib.mjs'

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const SUFFIX = Date.now() % 100000
const USER_A = process.argv[2] ?? `hp-${SUFFIX}`
const USER_B = process.argv[3] ?? `hq-${SUFFIX}`

const STARTER_DECK = {
  name: 'Mage Web starter',
  cards: [
    { cardName: 'Plains', setCode: 'LEA', cardNumber: '286', amount: 12 },
    { cardName: 'Island', setCode: 'LEA', cardNumber: '288', amount: 12 },
    { cardName: 'Silvercoat Lion', setCode: 'M10', cardNumber: '36', amount: 12 },
    { cardName: 'Giant Growth', setCode: 'LEA', cardNumber: '202', amount: 12 },
    { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 12 },
  ],
  sideboard: [],
}

// La IA juega solo tierras: nunca mata y la partida no termina mientras B espera vistas.
const AI_LANDS_DECK = {
  name: 'AI lands',
  cards: [
    { cardName: 'Plains', setCode: 'LEA', cardNumber: '286', amount: 20 },
    { cardName: 'Island', setCode: 'LEA', cardNumber: '288', amount: 20 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 },
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

function makeConn(tag) {
  const ws = new WebSocket(WS_URL)
  const pending = new Map()
  const waiters = []
  ws.onmessage = (msg) => {
    let m
    try {
      m = JSON.parse(String(msg.data))
    } catch {
      return
    }
    if (process.env.HP_DEBUG && m.method) {
      const gv = m.data?.gameView ?? m.data ?? {}
      const extra = gv.watchedHands ? ` watched=${JSON.stringify(gv.watchedHands).slice(0, 300)}` : ''
      console.log(`  [${tag}] ${m.method}${m.message ? ` :: ${String(m.message).slice(0, 80)}` : ''}${extra}`)
    }
    if (m.type === 'result') {
      const list = pending.get(m.action) ?? []
      const res = list.shift()
      if (res) res(m)
    } else if (m.type === 'error') {
      console.log(`  nota [${tag}]: error del proxy: ${m.message}`)
    } else {
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i](m)) waiters.splice(i, 1)
      }
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
  const waitEvent = (pred, label, ms = 30000) => {
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
  // Bucle de supervivencia del humano: keep en mulligan, pasa prioridades y
  // elige starting player (él mismo). Sin esto la partida se atasca y el
  // espectador no recibe vistas nuevas.
  const autoPlay = (myPlayerId, gameId) => {
    waiters.push((ev) => {
      try {
        if (ev.method === 'GAME_ASK' && /mulligan/i.test(ev.message ?? '')) {
          void send('sendPlayerBoolean', { gameId, value: false })
          return false
        }
        if (ev.method === 'GAME_SELECT') {
          void send('sendPlayerBoolean', { gameId, value: false })
          return false
        }
        if (ev.method === 'GAME_TARGET' && /starting player/i.test(ev.message ?? '')) {
          void send('sendPlayerUUID', { gameId, value: myPlayerId })
          return false
        }
      } catch { /* noop */ }
      return false
    })
  }
  return { ws, send, waitEvent, opened, autoPlay }
}

function gameViewOf(ev) {
  return ev.data?.gameView ?? ev.data ?? {}
}

async function main() {
  console.log(`[hand-permission] A=${USER_A} (jugador) B=${USER_B} (espectador) contra ${WS_URL}…`)
  const A = makeConn('A')
  const B = makeConn('B')
  let tableId = null
  let gameId = null

  try {
    await Promise.race([A.opened, timeout(10000, 'apertura WS de A')])
    await Promise.race([B.opened, timeout(10000, 'apertura WS de B')])
    check('WebSockets al proxy (2 sesiones)', true)

    let res = await Promise.race([
      A.send('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER_A, password: 'x' }),
      timeout(15000, 'connect de A'),
    ])
    if (!check('connect/login A', !!res.ok, `lastError='${res.error ?? ''}'`)) return
    res = await Promise.race([
      B.send('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER_B, password: 'x' }),
      timeout(15000, 'connect de B'),
    ])
    if (!check('connect/login B (sesión aislada)', !!res.ok, `lastError='${res.error ?? ''}'`)) return

    res = await Promise.race([
      A.send('createTable', {
        name: `hand-perm-${SUFFIX}`,
        gameType: 'Two Player Duel',
        deckType: 'Constructed - Modern',
        winsNeeded: 1,
        playerTypes: ['HUMAN', 'COMPUTER_MAD'],
        watchingAllowed: true,
        spectatorsAllowed: true,
        skipInitShuffling: true,
        skipStartingPlayerChoice: true,
        quitRatio: 100,
      }),
      timeout(15000, 'createTable'),
    ])
    tableId = res.ok ? (res.data?.tableId ?? res.data?.table?.tableId ?? null) : null
    if (!check('createTable HUMAN vs IA', !!tableId, res.ok ? '' : (res.error ?? ''))) return

    res = await Promise.race([
      A.send('joinTable', { tableId, playerName: USER_A, playerType: 'HUMAN', skill: 1, deck: STARTER_DECK }),
      timeout(15000, 'joinTable HUMAN'),
    ])
    if (!check('joinTable HUMAN (A)', !!res.ok, res.error ?? '')) return

    res = await Promise.race([
      A.send('joinTable', { tableId, playerName: 'Computer', playerType: 'COMPUTER_MAD', skill: 1, deck: AI_LANDS_DECK }),
      timeout(15000, 'joinTable IA'),
    ])
    if (!check('joinTable IA', !!res.ok, res.error ?? '')) return

    const initP = A.waitEvent((m) => m.method === 'GAME_INIT', 'GAME_INIT de A', 30000)
    res = await Promise.race([A.send('startMatch', { tableId }), timeout(20000, 'startMatch')])
    if (!check('startMatch', !!res.ok, res.error ?? '')) return

    let initEv = null
    try {
      initEv = await Promise.race([initP, timeout(30000, 'GAME_INIT de A')])
      gameId = initEv.objectId ?? null
    } catch (e) {
      check('GAME_INIT de A', false, e.message)
      return
    }
    const gvA = gameViewOf(initEv)
    const meA = (gvA.players ?? []).find((p) => p.name === USER_A) ?? {}
    const myPlayerId = meA.playerId ?? meA.id ?? null
    if (!check('GAME_INIT con jugador propio', !!gameId && !!myPlayerId, gameId ? `gameId=${String(gameId).slice(0, 8)}…` : '')) return
    A.autoPlay(myPlayerId, gameId)

    // B observa la partida en curso.
    const bInitP = B.waitEvent((m) => m.method === 'GAME_INIT', 'GAME_INIT de B', 30000)
    res = await Promise.race([B.send('watchTable', { tableId }), timeout(15000, 'watchTable de B')])
    if (!check('watchTable (B espectador)', !!res.ok, res.error ?? '')) return
    try {
      const wgev = await Promise.race([
        B.waitEvent((m) => m.method === 'WATCHGAME', 'WATCHGAME de B', 30000),
        timeout(30000, 'WATCHGAME de B'),
      ])
      gameId = wgev.objectId ?? gameId
    } catch (e) {
      check('WATCHGAME de B', false, e.message)
      return
    }
    res = await Promise.race([B.send('watchGame', { gameId }), timeout(15000, 'watchGame de B')])
    if (!check('watchGame de B', !!res.ok, res.error ?? '')) return
    try {
      await Promise.race([bInitP, timeout(30000, 'GAME_INIT de B')])
      check('GAME_INIT de B (observando)', true)
    } catch (e) {
      check('GAME_INIT de B (observando)', false, e.message)
      return
    }

    // B ya observa: su próxima vista (GAME_UPDATE en vivo) debe traer
    // watchedHands con la mano de A. El waiter se registra ANTES de pedir,
    // porque las vistas con la mano pueden llegar justo tras conceder.
    const watchedPred = (m) => {
      if (m.method !== 'GAME_INIT' && m.method !== 'GAME_UPDATE' && m.method !== 'GAME_UPDATE_AND_INFORM') return false
      const gv = gameViewOf(m)
      const wh = gv.watchedHands ?? {}
      return Object.values(wh).some((hand) => hand && Object.keys(hand).length > 0)
    }
    const freshP = B.waitEvent(watchedPred, 'vista con watchedHands en B', 45000)
    // B pide ver la mano de A -> A debe recibir el diálogo con Accept + relatedUserId.
    const dialogP = A.waitEvent(
      (m) => m.method === 'USER_REQUEST_DIALOG' && JSON.stringify(m.data ?? {}).includes('ADD_PERMISSION_TO_SEE_HAND_CARDS'),
      'USER_REQUEST_DIALOG en A',
      30000,
    )
    res = await Promise.race([
      B.send('sendPlayerAction', { action: 'REQUEST_PERMISSION_TO_SEE_HAND_CARDS', gameId, data: myPlayerId }),
      timeout(15000, 'request de B'),
    ])
    if (!check('B pide permiso (REQUEST_PERMISSION_TO_SEE_HAND_CARDS)', !!res.ok, res.error ?? '')) return

    let relatedUserId = null
    try {
      const dlg = await Promise.race([dialogP, timeout(30000, 'USER_REQUEST_DIALOG en A')])
      relatedUserId = dlg.data?.relatedUserId ?? null
      check('A recibe diálogo con relatedUserId', !!relatedUserId, relatedUserId ? `related=${String(relatedUserId).slice(0, 8)}…` : 'sin relatedUserId')
    } catch (e) {
      check('A recibe diálogo con relatedUserId', false, e.message)
      return
    }
    if (!relatedUserId) return

    // A acepta con el relatedUserId como data (igual que el desktop).
    res = await Promise.race([
      A.send('sendPlayerAction', { action: 'ADD_PERMISSION_TO_SEE_HAND_CARDS', gameId, data: relatedUserId }),
      timeout(15000, 'accept de A'),
    ])
    if (!check('A concede (ADD_PERMISSION_TO_SEE_HAND_CARDS)', !!res.ok, res.error ?? '')) return

    const watchedDesc = (fresh) => {
      const wh = gameViewOf(fresh).watchedHands ?? {}
      const cards = Object.values(wh).reduce((n, hand) => n + Object.keys(hand ?? {}).length, 0)
      return { cards, keys: Object.keys(wh).join(',') || '?' }
    }
    try {
      const fresh = await Promise.race([freshP, timeout(45000, 'vista con watchedHands en B')])
      const { cards, keys } = watchedDesc(fresh)
      check('watchedHands con cartas en B (en vivo)', cards > 0, `${cards} cartas en: ${keys}`)
    } catch {
      // Fallback determinista: re-observar genera un GAME_INIT bajo demanda
      // con las vistas ya concedidas (no depende del flujo de la partida).
      console.log('  nota: sin updates en vivo, re-observando…')
      try {
        await Promise.race([B.send('stopWatching', { gameId }), timeout(15000, 'stopWatching de B')])
      } catch { /* noop */ }
      const reP = B.waitEvent(watchedPred, 'GAME_INIT con watchedHands en B', 60000)
      await Promise.race([B.send('watchTable', { tableId }), timeout(15000, 're-watchTable de B')])
      try {
        await Promise.race([
          B.waitEvent((m) => m.method === 'WATCHGAME', 're-WATCHGAME de B', 30000),
          timeout(30000, 're-WATCHGAME de B'),
        ])
      } catch { /* puede reutilizar el watch previo */ }
      await Promise.race([B.send('watchGame', { gameId }), timeout(15000, 're-watchGame de B')])
      try {
        const fresh = await Promise.race([reP, timeout(60000, 'GAME_INIT con watchedHands en B')])
        const { cards, keys } = watchedDesc(fresh)
        check('watchedHands con cartas en B (re-watch)', cards > 0, `${cards} cartas en: ${keys}`)
      } catch (e) {
        check('watchedHands con cartas en B (re-watch)', false, e.message)
      }
    }

    // Disparadores del menú (G12-2): ver sideboard/mazo propio -> eventos.
    const sbP = A.waitEvent((m) => m.method === 'VIEW_SIDEBOARD', 'VIEW_SIDEBOARD en A', 20000)
    res = await Promise.race([
      A.send('sendPlayerAction', { action: 'VIEW_SIDEBOARD', gameId, data: myPlayerId }),
      timeout(15000, 'view sideboard de A'),
    ])
    if (check('A pide ver sideboard (VIEW_SIDEBOARD)', !!res.ok, res.error ?? '')) {
      try {
        await Promise.race([sbP, timeout(20000, 'VIEW_SIDEBOARD en A')])
        check('evento VIEW_SIDEBOARD recibido', true)
      } catch (e) {
        check('evento VIEW_SIDEBOARD recibido', false, e.message)
      }
    }
    const deckP = A.waitEvent((m) => m.method === 'VIEW_LIMITED_DECK', 'VIEW_LIMITED_DECK en A', 20000)
    res = await Promise.race([
      A.send('sendPlayerAction', { action: 'VIEW_LIMITED_DECK', gameId, data: myPlayerId }),
      timeout(15000, 'view deck de A'),
    ])
    if (check('A pide ver mazo (VIEW_LIMITED_DECK)', !!res.ok, res.error ?? '')) {
      try {
        await Promise.race([deckP, timeout(20000, 'VIEW_LIMITED_DECK en A')])
        check('evento VIEW_LIMITED_DECK recibido', true)
      } catch (e) {
        check('evento VIEW_LIMITED_DECK recibido', false, e.message)
      }
    }
  } catch (e) {
    check('flujo global', false, e.message)
  } finally {
    if (gameId) {
      try {
        await Promise.race([A.send('quitMatch', { gameId }), timeout(10000, 'quitMatch')])
      } catch { /* noop */ }
    }
    if (tableId) {
      try {
        await Promise.race([A.send('removeTable', { tableId }), timeout(10000, 'removeTable')])
      } catch { /* noop */ }
    }
    try { A.ws.close() } catch { /* noop */ }
    try { B.ws.close() } catch { /* noop */ }
  }

  console.log('')
  console.log(`[hand-permission] RESULTADO: ${failCount === 0 ? 'TODO PASS' : `${failCount} FALLOS`} (${passCount} pass, ${failCount} fail)`)
  process.exit(failCount === 0 ? 0 : 1)
}

await main()
