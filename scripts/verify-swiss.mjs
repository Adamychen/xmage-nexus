#!/usr/bin/env node
// Verifica un torneo Constructed Swiss headless contra el stack local (sin
// navegador): login -> createTournamentTable (4 COMPUTER_MAD, numberRounds=2) ->
// joinTournamentTable x4 -> startTournament (owner) -> watch de la tabla ->
// SHOW_TOURNAMENT -> poll de getTournament hasta que los bots juegan solos y el
// torneo termina. Asertá:
//   1) tournamentState avanza (Dueling en juego -> Finished al cierre),
//   2) aparecen rondas con emparejamientos (rounds[].games con players/result),
//   3) standings coherentes al final (4 jugadores, 2 rondas cada uno, puntos
//      3/1/0 por match, orden desc, ganador marcado).
// Los COMPUTER_MAD juegan solos: no hace falta responder prompts ni joinGame.
// Higiene: elimina la mesa al final (los SIM se detienen en el proxy).
//
// Uso: node scripts/verify-swiss.mjs
// Requiere: servidor local (testMode) + proxy (node scripts/ctl.mjs status).
//
// Evidencia de plan4.md §3.11 "Suizo | 4+ jugadores | Emparejamientos,
// standings" (2026-09-17).

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const STAMP = Date.now() % 100000
const USER = `swiss-${STAMP}`
const NUM_ROUNDS = 2
const NUM_BOTS = 4
// Tope de espera del torneo completo: 4 matches Bo1 IA vs IA en serie. La
// partida es rápida (mazo de Bolt), pero el servidor local puede ir lento.
const TOURNAMENT_TIMEOUT_MS = 600_000

// Mazo con win-con (mismo que verify-tournament-watch/self-test): la IA cierra
// en pocos turnos y el torrente de GAME_UPDATEs es corto.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const timeout = (ms, label) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout esperando ${label} (${ms}ms)`)), ms))

async function main() {
  console.log(`[swiss] conectando a ${WS_URL} como ${USER}…`)

  const ws = new WebSocket(WS_URL)
  const pending = new Map()
  const waiters = []
  let rid = 0

  const call = (action, args, ms = 15000) =>
    new Promise((res) => {
      const id = `swiss-${++rid}`
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

  const waitEvent = (pred, label, ms = 20000) =>
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

  const opened = new Promise((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('no se pudo conectar al proxy'))
  })

  ws.onmessage = (msg) => {
    let m
    try {
      m = JSON.parse(String(msg.data))
    } catch {
      return
    }
    if (m.requestId && pending.has(m.requestId)) {
      pending.get(m.requestId)(m)
      pending.delete(m.requestId)
      return
    }
    if (m.requestId) return
    if (m.type === 'error') {
      console.log(`  nota: error del proxy: ${m.message}`)
      return
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i](m)) waiters.splice(i, 1)
    }
  }

  let tableId = null
  try {
    await Promise.race([opened, timeout(10000, 'apertura del WebSocket')])
    check('WebSocket al proxy', true)

    let res = await call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER, password: 'x' }, 15000)
    if (!check('connect/login', !!res.ok, `lastError='${res.error ?? ''}'`)) return

    // Constructed Swiss de 4 COMPUTER_MAD con numberRounds explícito (>=2). El
    // tipo existe en el config del servidor (`config.xml`): Constructed Swiss.
    res = await call(
      'createTournamentTable',
      {
        name: `swiss-${STAMP}`,
        tournamentType: 'Constructed Swiss',
        matchType: 'Two Player Duel',
        gameType: 'Two Player Duel',
        deckType: 'Constructed - Modern',
        winsNeeded: 1,
        numberRounds: NUM_ROUNDS,
        password: '',
        playerTypes: Array(NUM_BOTS).fill('COMPUTER_MAD'),
        watchingAllowed: true,
        spectatorsAllowed: true,
        quitRatio: 100,
      },
      15000,
    )
    tableId = res.ok ? (res.data?.tableId ?? null) : null
    if (!check('createTournamentTable Constructed Swiss (4 bots, 2 rondas)', !!tableId, res.ok ? `tableId=${String(tableId).slice(0, 8)}…` : (res.error ?? ''))) return

    for (let i = 0; i < NUM_BOTS; i++) {
      res = await call(
        'joinTournamentTable',
        {
          tableId,
          playerName: `Computer ${i + 1}`,
          playerType: 'COMPUTER_MAD',
          skill: 1,
          deck: AI_DECK,
        },
        15000,
      )
      if (!check(`joinTournamentTable IA ${i + 1}/${NUM_BOTS}`, !!res.ok, res.error ?? '')) return
    }

    // Watch antes de arrancar: SHOW_TOURNAMENT llega como callback puntual.
    const showEvP = waitEvent((m) => m.method === 'SHOW_TOURNAMENT', 'SHOW_TOURNAMENT', 20000)
    res = await call('watchTournamentTable', { tableId }, 15000)
    if (!check('watchTournamentTable (tabla torneo)', !!res.ok, res.error ?? '')) return
    let tournamentId = null
    try {
      const showEv = await Promise.race([showEvP, timeout(20000, 'SHOW_TOURNAMENT')])
      tournamentId = showEv.objectId ?? null
    } catch {
      /* tournamentId vacío -> FAIL abajo */
    }
    if (!check('evento SHOW_TOURNAMENT recibido', !!tournamentId, tournamentId ? `tournamentId=${String(tournamentId).slice(0, 8)}…` : '')) return

    res = await call('startTournament', { tableId }, 20000)
    if (!check('startTournament (owner)', !!res.ok, res.error ?? '')) return

    // Poll de getTournament: los 4 bots juegan las 2 rondas solos.
    const statesSeen = new Set()
    let finalView = null
    let dueled = false
    const deadline = Date.now() + TOURNAMENT_TIMEOUT_MS
    let lastLog = 0
    while (Date.now() < deadline) {
      res = await call('getTournament', { tournamentId }, 10000)
      const view = res.ok ? res.data : null
      if (view?.tournamentState) statesSeen.add(view.tournamentState)
      const rounds = view?.rounds ?? []
      if (!dueled && rounds.some((r) => (r.games ?? []).some((g) => String(g.state ?? '').startsWith('Dueling')))) {
        dueled = true
      }
      if (Date.now() - lastLog > 20000) {
        lastLog = Date.now()
        const st = view?.tournamentState ?? '∅'
        const roundInfo = rounds.map((r) => `${(r.games ?? []).filter((g) => String(g.state).startsWith('Finished')).length}/${(r.games ?? []).length}`).join(', ')
        console.log(`  … estado='${st}' rondas=${rounds.length} [finalizadas/total: ${roundInfo || '—'}]`)
      }
      if (view?.tournamentState === 'Finished' && rounds.length >= NUM_ROUNDS) {
        finalView = view
        break
      }
      await sleep(1000)
    }
    if (!check('el torneo llegó a Finished', !!finalView, `estados vistos=[${[...statesSeen].join(', ')}]`)) return

    // 1) tournamentState avanza (en juego -> Finished).
    check(
      'tournamentState avanza (Dueling en juego -> Finished)',
      statesSeen.has('Dueling') && statesSeen.has('Finished'),
      `estados vistos=[${[...statesSeen].join(', ')}] (dueled=${dueled})`,
    )

    // 2) Rondas con emparejamientos.
    const rounds = finalView.rounds ?? []
    check('hay 2 rondas', rounds.length === NUM_ROUNDS, `rounds=${rounds.length}`)
    const gamesPerRound = rounds.map((r) => r.games ?? [])
    check(
      'cada ronda tiene 2 emparejamientos (4 bots)',
      gamesPerRound.length === NUM_ROUNDS && gamesPerRound.every((g) => g.length === 2),
      gamesPerRound.map((g, i) => `R${i + 1}:${g.length}`).join(' '),
    )
    const allGames = gamesPerRound.flat()
    check(
      'todos los emparejamientos tienen players y result',
      allGames.length === NUM_ROUNDS * 2 &&
        allGames.every((g) => typeof g.players === 'string' && g.players.includes(' - ') && typeof g.result === 'string' && g.result.length > 0),
      allGames.map((g) => `R${g.roundNum} "${g.players}" → ${g.result}`).join(' | '),
    )

    // 3) Standings/puntos coherentes.
    const players = finalView.players ?? []
    check('4 jugadores en standings', players.length === NUM_BOTS, players.map((p) => `${p.name}:${p.points}`).join(', '))
    const allRoundsPlayed = players.every((p) => /R1 /.test(p.results ?? '') && new RegExp(`R${NUM_ROUNDS} `).test(p.results ?? ''))
    check('cada jugador tiene resultado de las 2 rondas', allRoundsPlayed, players.map((p) => `${p.name} [${(p.results ?? '').trim()}]`).join(' | '))
    const pts = players.map((p) => Number(p.points))
    const sorted = pts.every((v, i) => i === 0 || pts[i - 1] >= v)
    check('standings ordenados por puntos desc', sorted, pts.join(' >= '))
    const games = allGames.length
    // Cada match reparte 3 (decisivo) o 1+1 (empate); el total agregado queda en [2*m, 3*m].
    const total = pts.reduce((a, b) => a + b, 0)
    check(
      'puntos agregados coherentes (3 o 1+1 por match)',
      total >= 2 * games && total <= 3 * games,
      `total=${total} con ${games} matches (rango ${2 * games}-${3 * games})`,
    )
    check('max puntos >= 3 y algún Winner marcado', Math.max(...pts) >= 3 && players.some((p) => /Winner/.test(p.state ?? '')), players.map((p) => `${p.name}:${p.points} (${p.state})`).join(' | '))

    // Evidencia.
    console.log('')
    console.log('  evidencia: rondas/emparejamientos')
    for (const g of allGames) {
      console.log(`    R${g.roundNum}  ${g.players}  | ${g.state} | ${g.result}`)
    }
    console.log('  evidencia: standings final')
    for (const p of players) {
      console.log(`    ${p.points} pts  ${p.name}  ${p.state}  [${(p.results ?? '').trim()}]`)
    }
    console.log(`  evidencia: tournamentType='${finalView.tournamentType}' state='${finalView.tournamentState}'`)
  } catch (e) {
    check('flujo global', false, e.message)
  } finally {
    // Higiene: la mesa huérfana deja IAs jugando y degrada el servidor local.
    if (tableId) {
      try {
        await call('removeTable', { tableId }, 10000)
      } catch {
        /* noop */
      }
    }
    try {
      ws.close()
    } catch {
      /* noop */
    }
  }

  console.log('')
  console.log(`[swiss] RESULTADO: ${failCount === 0 ? 'TODO PASS' : `${failCount} FALLOS`} (${passCount} pass, ${failCount} fail)`)
  process.exit(failCount === 0 ? 0 : 1)
}

await main()
