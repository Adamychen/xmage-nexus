#!/usr/bin/env node
// Verifica que un ESPECTADOR recibe END_GAME_INFO al terminar la partida
// (hueco histórico: GameController.endGameInfo() solo informaba a
// getGameSessions(); el TODO "inform watchers about game end and who won" se
// cerró el 2026-09-17 con GameSessionWatcher.endGameInfo(Table) — parche aditivo
// en el fork, misma versión 1.4.61).
//
// Flujo (sin navegador): P (HUMAN, dueño) crea mesa HUMAN+SIM -> joinTable ->
// startMatch -> joinGame -> la partida corre (P pasa prioridad; el SIM juega
// solo) -> S (HUMAN) se une TARDE como espectador (watchTable -> WATCHGAME ->
// watchGame -> GAME_INIT + GAME_UPDATEs) -> P concede -> se asertá:
//   1) P recibe END_GAME_INFO (control de jugador),
//   2) S recibe END_GAME_INFO con el GameEndView no nulo (players/matchInfo).
//
// Uso: node scripts/verify-spectator-end.mjs
// Requiere: servidor local (testMode) + proxy (node scripts/ctl.mjs status),
// con el parche de GameSessionWatcher/GameController compilado.
//
// Evidencia de docs/history/plan4.md §3.11 "Espectar partida y torneo" (2026-09-17).

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const STAMP = Date.now() % 100000

const SIM_DECK = {
  name: 'Mage Sim spectator lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '263', amount: 50 },
  ],
  sideboard: [],
}
const HUMAN_DECK = {
  name: 'Mage Web spectator rec',
  cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const timeout = (ms, label) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout esperando ${label} (${ms}ms)`)), ms))

// Conexión WS con call()/wait() y auto-respuesta de prompts del humano (P:
// keep mulligan, pasa prioridad, descarta la primera carta, declina maná).
function mkConn(name, { autoAnswer = false } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    const pending = new Map()
    const waiters = []
    const conn = { ws, name, gameId: null, view: null, endGameInfo: null, watchGame: null, maxTurn: 0, lastViewAt: 0, events: [] }
    let rid = 0

    conn.call = (action, args, ms = 15000) =>
      new Promise((res) => {
        const id = `${name}-${++rid}`
        const timer = setTimeout(() => {
          pending.delete(id)
          res({ ok: false, error: 'timeout' })
        }, ms)
        pending.set(id, (m) => {
          clearTimeout(timer)
          res(m)
        })
        try {
          ws.send(JSON.stringify({ requestId: id, action, args }))
        } catch {
          clearTimeout(timer)
          pending.delete(id)
          res({ ok: false, error: 'send-fail' })
        }
      })

    conn.wait = (pred, ms, label) =>
      new Promise((resolveWait, rejectWait) => {
        const timer = setTimeout(() => rejectWait(new Error(`timeout esperando ${label}`)), ms)
        waiters.push((m) => {
          if (pred(m)) {
            clearTimeout(timer)
            resolveWait(m)
            return true
          }
          return false
        })
      })

    conn.close = () => {
      try {
        ws.close()
      } catch {
        /* noop */
      }
    }

    function autoAnswerMsg(m) {
      if (!conn.gameId) return
      const d = m.data ?? {}
      const q = String(d.message ?? d.question ?? '')
      if (m.method === 'GAME_ASK') {
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId: conn.gameId, value: false } }))
        return
      }
      if (m.method === 'GAME_SELECT') {
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId: conn.gameId, value: false } }))
        return
      }
      if (m.method === 'GAME_TARGET') {
        if (/discard/i.test(q)) {
          const pt = d.options?.possibleTargets ?? d.targets ?? []
          const id = Array.isArray(pt) ? (typeof pt[0] === 'string' ? pt[0] : pt[0]?.id) : Object.keys(pt)[0]
          if (id) {
            ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId: conn.gameId, value: id } }))
            return
          }
        }
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId: conn.gameId, value: false } }))
        return
      }
      if (m.method === 'GAME_PLAY_MANA' || m.method === 'GAME_PLAY_XMANA') {
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId: conn.gameId, value: false } }))
      }
    }

    ws.onopen = () => resolve(conn)
    ws.onerror = () => reject(new Error('no se pudo conectar al proxy'))
    ws.onmessage = (raw) => {
      let m
      try {
        m = JSON.parse(String(raw.data ?? raw))
      } catch {
        return
      }
      if (m.requestId && pending.has(m.requestId)) {
        pending.get(m.requestId)(m)
        pending.delete(m.requestId)
        return
      }
      if (m.requestId || m.type === 'lobby' || m.type === 'error') return
      if (m.objectId && (m.method === 'START_GAME' || m.method === 'WATCHGAME' || m.method?.startsWith('GAME_')) && !conn.gameId) {
        conn.gameId = String(m.objectId)
      }
      if (m.method === 'GAME_INIT') conn.initAt = Date.now()
      if (m.data?.gameView) {
        conn.view = m.data.gameView
        conn.maxTurn = Math.max(conn.maxTurn, Number(conn.view.turn ?? 0))
        conn.lastViewAt = Date.now()
      }
      if (m.method === 'WATCHGAME') conn.watchGame = m
      if (m.method === 'END_GAME_INFO') conn.endGameInfo = m
      if (conn.events.length < 400) conn.events.push({ method: m.method, at: Date.now() })
      if (autoAnswer) autoAnswerMsg(m)
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i](m)) waiters.splice(i, 1)
      }
    }
  })
}

async function main() {
  const USER_P = `spP${STAMP}`.slice(0, 14)
  const USER_S = `spS${STAMP}`.slice(0, 14)
  console.log(`[spectator-end] conectando a ${WS_URL} como ${USER_P} (jugador) y ${USER_S} (espectador)…`)
  let P = null
  let S = null
  let tableId = null
  try {
    P = await mkConn(USER_P, { autoAnswer: true })
    S = await mkConn(USER_S)
    check('WebSocket al proxy (jugador + espectador)', true)

    let res = await P.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER_P, password: 'x' })
    if (!check('connect/login jugador', !!res.ok, res.error ?? '')) return
    res = await S.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER_S, password: 'x' })
    if (!check('connect/login espectador', !!res.ok, res.error ?? '')) return

    res = await P.call('createTable', {
      name: `spec-end-${STAMP}`,
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Pioneer',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'SIM'],
      simDecks: [SIM_DECK],
      skipInitShuffling: true,
      skipStartingPlayerChoice: true,
    })
    tableId = res.ok ? (res.data?.tableId ?? res.data?.table?.tableId ?? null) : null
    if (!check('createTable HUMAN+SIM', !!tableId, res.error ?? '')) return

    res = await P.call('joinTable', { tableId, playerName: USER_P, playerType: 'HUMAN', skill: 1, deck: HUMAN_DECK })
    if (!check('joinTable jugador', !!res.ok, res.error ?? '')) return

    const startP = P.wait((m) => m.method === 'START_GAME', 30000, 'START_GAME')
    res = await P.call('startMatch', { tableId })
    if (!check('startMatch', !!res.ok, res.error ?? '')) return
    const start = await startP
    await P.call('joinGame', { gameId: String(start.objectId) })
    check('START_GAME + joinGame del jugador', !!P.gameId, `gameId=${String(P.gameId).slice(0, 8)}…`)

    // Esperar a que la partida corra (turno >= 2) antes de que el espectador
    // entre: se prueba el camino "espectar partida EN CURSO".
    const runDeadline = Date.now() + 30000
    while (Date.now() < runDeadline && P.maxTurn < 2) await sleep(500)
    if (!check('la partida llegó a turno >= 2', P.maxTurn >= 2, `turn=${P.maxTurn}`)) return

    // Espectador: watchTable -> WATCHGAME -> watchGame -> GAME_INIT.
    const watchGameP = S.wait((m) => m.method === 'WATCHGAME', 30000, 'WATCHGAME')
    const specInitP = S.wait((m) => m.method === 'GAME_INIT', 30000, 'GAME_INIT (espectador)')
    res = await S.call('watchTable', { tableId })
    if (!check('watchTable del espectador', !!res.ok, res.error ?? '')) return
    const watchEv = await watchGameP
    const specGameId = String(watchEv.objectId)
    res = await S.call('watchGame', { gameId: specGameId })
    check('WATCHGAME + watchGame', !!res.ok && specGameId === String(P.gameId), `gameId=${specGameId.slice(0, 8)}…`)
    const specInit = await specInitP
    const specPlayers = specInit.data?.gameView?.players?.length ?? specInit.data?.players?.length ?? 0
    check('GAME_INIT del espectador con tablero', specPlayers >= 2, `${specPlayers} jugadores`)

    // El espectador ve la partida en vivo (GAME_UPDATEs frescos).
    const liveDeadline = Date.now() + 15000
    while (Date.now() < liveDeadline && S.lastViewAt === 0) await sleep(300)
    check('el espectador recibe GAME_UPDATEs en vivo', Date.now() - S.lastViewAt < 5000, `${Math.round((Date.now() - S.lastViewAt) / 1000)} s desde la última vista`)

    // P concede hasta terminar (puede caer sin prioridad; se reintenta).
    const endP = P.wait((m) => m.method === 'END_GAME_INFO' || m.method === 'GAME_OVER', 60000, 'END_GAME_INFO/GAME_OVER (jugador)')
    const endS = S.wait((m) => m.method === 'END_GAME_INFO', 60000, 'END_GAME_INFO (espectador)')
    const concedeDeadline = Date.now() + 45000
    while (!P.endGameInfo && Date.now() < concedeDeadline) {
      await P.call('sendPlayerAction', { gameId: P.gameId, action: 'CONCEDE' }, 5000)
      await sleep(1500)
    }
    check('el jugador recibe END_GAME_INFO (control)', !!P.endGameInfo, P.endGameInfo ? `matchInfo='${P.endGameInfo.data?.matchInfo ?? ''}'` : 'sin END_GAME_INFO')
    try {
      await Promise.race([endS, timeout(45000, 'END_GAME_INFO (espectador)')])
    } catch (e) {
      check('el ESPECTADOR recibe END_GAME_INFO', false, e.message)
      return
    }
    try {
      await Promise.race([endP, timeout(5000, 'cierre del jugador)')])
    } catch {
      /* el jugador ya lo tenía; no bloquea */
    }

    // La aserción clave: GameEndView no nulo en la sesión espectadora.
    const end = S.endGameInfo
    const d = end?.data ?? null
    const players = d?.players ?? []
    check('END_GAME_INFO en el espectador con data no nulo', !!d && typeof d === 'object', d ? `claves=[${Object.keys(d).join(', ')}]` : 'data=null')
    check('GameEndView con los 2 jugadores', Array.isArray(players) && players.length === 2, players.map((p) => p.name).join(', '))
    check('GameEndView con resultado del match', typeof d?.matchInfo === 'string' && d.matchInfo.length > 0, `matchInfo='${d?.matchInfo ?? ''}'`)
    check('el espectador NO es jugador (clientPlayer nulo)', !d?.clientPlayer, `clientPlayer=${d?.clientPlayer ? d.clientPlayer.name : 'null'}`)

    console.log('')
    console.log(`  evidencia: espectador recibió END_GAME_INFO objectId=${String(end?.objectId).slice(0, 8)}…`)
    console.log(`  evidencia: matchInfo='${d?.matchInfo ?? ''}' gameInfo=${JSON.stringify(d?.gameInfo ?? null)}`)
    console.log(`  evidencia: players=[${players.map((p) => `${p.name}(vida ${p.life})`).join(', ')}]`)
    console.log(`  evidencia: eventos del espectador post-watch = [${S.events.map((e) => e.method).filter((m, i, a) => a.indexOf(m) === i).join(', ')}]`)
  } catch (e) {
    check('flujo global', false, e.message)
  } finally {
    if (P?.gameId) {
      try {
        await P.call('quitMatch', { gameId: P.gameId })
      } catch {
        /* noop */
      }
    }
    if (tableId) {
      try {
        await P?.call('removeTable', { tableId })
      } catch {
        /* noop */
      }
    }
    P?.close()
    S?.close()
  }

  console.log('')
  console.log(`[spectator-end] RESULTADO: ${failCount === 0 ? 'TODO PASS' : `${failCount} FALLOS`} (${passCount} pass, ${failCount} fail)`)
  process.exit(failCount === 0 ? 0 : 1)
}

await main()
