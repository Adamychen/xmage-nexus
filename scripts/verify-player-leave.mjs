#!/usr/bin/env node
// Verifica el abandono a mitad de partida en un FFA real de 4 (2 HUMAN + 2 SIM)
// contra el stack local, sin navegador: A crea la mesa → A y B se unen →
// startMatch → ambos joinGame → la partida corre (los SIM juegan solos) → B
// concede a mitad (sendPlayerAction CONCEDE, el mismo camino que el botón de
// concesión del web) → se asertan en las vistas de A:
//   1) B queda `hasLeft:true` con sus zonas vaciadas (mano/biblioteca/campo 0),
//   2) la partida SIGUE para A (el turno avanza después del abandono).
//
// HALLAZGO (2026-09-17, bisecado contra el servidor local): la concesión
// in-game (`sendPlayerAction CONCEDE` → `game.setConcedingPlayer` →
// `GameImpl.checkConcede` → `Player.leave()`) es la vía que el view proyecta
// como `hasLeft:true` + zonas vaciadas y deja seguir la partida. En cambio
// `quitMatch`/`leaveTable` a mitad de partida (`GameSessionPlayer.quitGame` →
// `player.quit` → `concede`/`lost`) deja la partida CONGELADA para el resto:
// en la sonda no llegó ningún GAME_UPDATE durante 40 s y el turno quedó fijo.
// Por eso el script usa CONCEDE (y NO quitMatch) para el abandono.
//
// El servidor local tiene un flake conocido de callbacks (`SESSION CALLBACK
// EXCEPTION - ... not being connected to server`) que congela la partida; el
// script detecta la congelación (sin vistas >20 s) y reintenta el flujo hasta
// 3 veces, quedándose con el resultado del último intento.
//
// Uso: node scripts/verify-player-leave.mjs
// Requiere: servidor local (testMode) + proxy (node scripts/ctl.mjs status).

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const STAMP = Date.now() % 100000

// Mazos todo-Montaña: los SIM llevan el deck de tierras del rec-lib; los
// humanos solo pasan prioridad (no castean), así que el juego avanza solo.
const SIM_DECK = {
  name: 'Mage Sim leave lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '263', amount: 50 },
  ],
  sideboard: [],
}
const HUMAN_DECK = {
  name: 'Mage Web leave rec',
  cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
  sideboard: [],
}

// Resultados por intento: el veredicto final solo cuenta el ÚLTIMO intento.
let attemptNo = 0
const checks = []

function check(name, ok, detail = '') {
  checks.push({ attempt: attemptNo, name, ok, detail })
  const prefix = attemptNo > 1 ? `  [intento ${attemptNo}] ` : '  '
  console.log(`${prefix}${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Conexión WS con call() (action/args → result del proxy), wait() de eventos y
// auto-respuesta de los prompts del humano (pasar / keep / descartar).
function mkConn(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    const pending = new Map()
    const waiters = []
    const conn = { ws, name, view: null, gameId: null, maxTurn: 0, lastViewAt: 0, events: [] }
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
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout esperando ${label}`)), ms)
        waiters.push((m) => {
          if (pred(m)) {
            clearTimeout(timer)
            resolve(m)
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

    function autoAnswer(m) {
      if (!conn.gameId) return
      const d = m.data ?? {}
      const q = String(d.message ?? d.question ?? '')
      if (m.method === 'GAME_ASK') {
        // mulligan: false = keep; resto de "may": false.
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId: conn.gameId, value: false } }))
        return
      }
      if (m.method === 'GAME_SELECT') {
        // Prioridad: pasar (boolean false). Los humanos no castean.
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId: conn.gameId, value: false } }))
        return
      }
      if (m.method === 'GAME_TARGET') {
        if (/discard/i.test(q)) {
          // El descarte de limpieza NO se puede declinar: primera carta.
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
        return
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
      if (m.objectId && (m.method === 'START_GAME' || m.method?.startsWith('GAME_')) && !conn.gameId) {
        conn.gameId = String(m.objectId)
      }
      if (m.data?.gameView) {
        conn.view = m.data.gameView
        conn.maxTurn = Math.max(conn.maxTurn, Number(conn.view.turn ?? 0))
        conn.lastViewAt = Date.now()
      }
      if (conn.events.length < 400) conn.events.push({ method: m.method, at: Date.now() })
      autoAnswer(m)
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i](m)) waiters.splice(i, 1)
      }
    }
  })
}

function playerOf(conn, predicate) {
  return (conn.view?.players ?? []).find(predicate)
}

async function attempt() {
  const USER_A = `lvA${STAMP}${attemptNo}`.slice(0, 14)
  const USER_B = `lvB${STAMP}${attemptNo}`.slice(0, 14)
  console.log(`[player-leave] intento ${attemptNo}: conectando a ${WS_URL} como ${USER_A} y ${USER_B}…`)
  let A = null
  let B = null
  let tableId = null
  try {
    A = await mkConn(USER_A)
    B = await mkConn(USER_B)
    check('WebSocket al proxy (2 clientes)', true)

    let res = await A.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER_A, password: 'x' })
    if (!check('connect/login A', !!res.ok, res.error ?? '')) return
    res = await B.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER_B, password: 'x' })
    if (!check('connect/login B', !!res.ok, res.error ?? '')) return

    res = await A.call('createTable', {
      name: `leave-${STAMP}-${attemptNo}`,
      gameType: 'Free For All',
      deckType: 'Constructed - Pioneer',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'HUMAN', 'SIM', 'SIM'],
      simDecks: [SIM_DECK, SIM_DECK],
      skipInitShuffling: true,
      skipStartingPlayerChoice: true,
    })
    tableId = res.ok ? (res.data?.tableId ?? res.data?.table?.tableId ?? null) : null
    if (!check('createTable FFA 4 (2 HUMAN + 2 SIM)', !!tableId, res.error ?? '')) return

    res = await A.call('joinTable', { tableId, playerName: USER_A, playerType: 'HUMAN', skill: 1, deck: HUMAN_DECK })
    if (!check('joinTable A', !!res.ok, res.error ?? '')) return
    res = await B.call('joinTable', { tableId, playerName: USER_B, playerType: 'HUMAN', skill: 1, deck: HUMAN_DECK })
    if (!check('joinTable B', !!res.ok, res.error ?? '')) return

    // Los waiters se registran ANTES de startMatch: START_GAME es un evento
    // puntual y puede llegar a B mientras A aún hace joinGame (sin replay).
    const startAP = A.wait((m) => m.method === 'START_GAME', 30000, 'START_GAME (A)')
    const startBP = B.wait((m) => m.method === 'START_GAME', 30000, 'START_GAME (B)')
    res = await A.call('startMatch', { tableId })
    if (!check('startMatch', !!res.ok, res.error ?? '')) return

    // Ambos deben unirse a la partida (joinGame), como el cliente web/MCP.
    const startA = await startAP
    await A.call('joinGame', { gameId: String(startA.objectId) })
    const startB = await startBP
    await B.call('joinGame', { gameId: String(startB.objectId) })
    check('START_GAME + joinGame en ambos', !!A.gameId && !!B.gameId, `gameId=${String(A.gameId).slice(0, 8)}…`)

    // Esperar a que la partida corra (turno >= 2 en la vista de A). Un callback
    // perdido del servidor congela el juego: si no hay vistas en 30 s, es flake.
    const runDeadline = Date.now() + 30000
    while (Date.now() < runDeadline && A.maxTurn < 2) await sleep(500)
    const turnAtLeave = A.maxTurn
    if (!check('la partida llegó a turno >= 2 antes del abandono', turnAtLeave >= 2, `turn=${turnAtLeave}`)) {
      throw new Error('la partida no arrancó (sin vistas)')
    }

    const playerBInA = () => playerOf(A, (p) => String(p?.name) === USER_B)

    // B abandona con CONCEDE (in-game): puede caer mientras no tiene prioridad
    // (GameController.sendMessage exige que el jugador tenga la prioridad), así
    // que se reintenta hasta que A lo vea marcado.
    const leaveAt = Date.now()
    const concedeDeadline = Date.now() + 45000
    while (Date.now() < concedeDeadline) {
      if (playerBInA()?.hasLeft === true) break
      if (Date.now() - A.lastViewAt > 20000) throw new Error('partida congelada antes del CONCEDE (sin vistas)')
      await B.call('sendPlayerAction', { gameId: B.gameId, action: 'CONCEDE' }, 5000)
      await sleep(1500)
    }
    console.log(`  nota: B envió CONCEDE en turno ${turnAtLeave} (reintentos hasta que A lo ve)`)

    // Esperar a que la partida avance de turno en las vistas de A.
    const advanceDeadline = Date.now() + 30000
    while (Date.now() < advanceDeadline && A.maxTurn <= turnAtLeave) {
      if (Date.now() - A.lastViewAt > 20000) throw new Error('partida congelada tras el CONCEDE (sin vistas)')
      await sleep(500)
    }
    await sleep(3000)

    const b = playerBInA()
    const evidence = b
      ? `hasLeft=${b.hasLeft} life=${b.life} handCount=${b.handCount} libraryCount=${b.libraryCount} battlefield=${Object.keys(b.battlefield ?? {}).length}`
      : 'B ya no aparece en players[]'
    check('A ve a B con hasLeft:true tras el abandono', b?.hasLeft === true, evidence)
    check(
      'las zonas de B quedan vaciadas (mano/biblioteca/campo)',
      !!b && Number(b.handCount) === 0 && Number(b.libraryCount) === 0 && Object.keys(b.battlefield ?? {}).length === 0,
      evidence,
    )
    check(
      'la partida SIGUE para A (el turno avanzó tras el abandono)',
      A.maxTurn > turnAtLeave,
      `turn ${turnAtLeave} → ${A.maxTurn}`,
    )
    check('A sigue recibiendo vistas frescas (<10 s)', Date.now() - A.lastViewAt < 10000, `${Math.round((Date.now() - A.lastViewAt) / 1000)} s`)

    console.log(
      `  evidencia: B en la vista de A → hasLeft=${b?.hasLeft} life=${b?.life} hand=${b?.handCount}` +
        ` library=${b?.libraryCount} battlefield=${Object.keys(b?.battlefield ?? {}).length}`,
    )
    console.log(`  evidencia: turno máximo observado por A = ${A.maxTurn} (abandono en ${turnAtLeave})`)
    const since = (c) =>
      c.events
        .filter((e) => e.at >= leaveAt)
        .map((e) => e.method)
        .filter((m, i, arr) => arr.indexOf(m) === i)
        .join(',')
    console.log(`  evidencia: eventos post-abandono A = [${since(A)}]`)
    console.log(`  evidencia: eventos post-abandono B = [${since(B)}]`)
    if (process.env.DEBUG_EVENTS === '1') {
      for (const c of [A, B]) {
        console.log(`  debug: últimos eventos de ${c.name}:`)
        for (const e of c.events.slice(-15)) console.log(`    ${e.at - leaveAt} ms  ${e.method}`)
      }
    }
  } finally {
    // Higiene: cerrar partida y mesa (los SIM se detienen en el proxy al soltar la sesión).
    for (const c of [A, B]) {
      if (!c) continue
      if (c.gameId) {
        try {
          await c.call('quitMatch', { gameId: c.gameId })
        } catch {
          /* noop */
        }
      }
    }
    if (tableId) {
      try {
        await A?.call('removeTable', { tableId })
      } catch {
        /* noop */
      }
    }
    A?.close()
    B?.close()
  }
}

let lastOk = false
for (let n = 1; n <= 3; n++) {
  attemptNo = n
  if (n > 1) {
    console.log(`[player-leave] reintento ${n}/3 (el intento anterior no cerró)…`)
    await sleep(3000)
  }
  try {
    await attempt()
  } catch (e) {
    check('flujo global', false, e.message)
  }
  const thisAttempt = checks.filter((c) => c.attempt === attemptNo)
  lastOk = thisAttempt.length > 0 && thisAttempt.every((c) => c.ok)
  if (lastOk) break
}

const last = checks.filter((c) => c.attempt === attemptNo)
const fails = last.filter((c) => !c.ok).length
console.log('')
console.log(`[player-leave] RESULTADO (intento ${attemptNo}): ${fails === 0 ? 'TODO PASS' : `${fails} FALLOS`} (${last.length - fails} pass, ${fails} fail)`)
process.exit(fails === 0 ? 0 : 1)
