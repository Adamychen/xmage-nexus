// Biblioteca compartida del grabador de frames reales. Un "driver" describe una
// mecánica: mazo, secuencia de acciones de alto nivel (vía hooks) y un predicado
// de captura. runRecorder conecta al proxy, crea mesa HUMAN+SIM contra el
// servidor real (local por defecto, beta vía E2E_SERVER_HOST/PORT), ejecuta el
// driver y vuelca el primer GAME_UPDATE que cumple captureWhen a
// web/fixtures/recorded/<outFile>.
//
// Ya no hace falta escribir un escenario fake a mano ni pelear con beta: el
// frame real capturado alimenta los tests fake vía replay-recorded.ts.

import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = new URL('..', import.meta.url).pathname
const OUT_DIR = new URL('../web/fixtures/recorded/', import.meta.url).pathname

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = process.env.E2E_SERVER_HOST || 'localhost'
const SERVER_PORT = Number(process.env.E2E_SERVER_PORT || '17171')
const DEBUG = process.env.E2E_DEBUG === '1'

function log(...a) {
  console.log(`[rec-lib] ${Date.now() % 100000} `, ...a)
}

export function getMe(gv) {
  return gv?.players?.find((p) => p?.controlled)
}

function firstBasicLand(hand) {
  if (!hand) return null
  for (const [id, c] of Object.entries(hand)) {
    if ((c?.cardTypes ?? []).includes('LAND') || /Forest|Island|Mountain|Swamp|Plains/i.test(c?.name ?? c?.displayName ?? '')) {
      return id
    }
  }
  return null
}

function findOnBattlefield(gv, name) {
  const me = getMe(gv)
  if (!me?.battlefield) return null
  for (const [id, c] of Object.entries(me.battlefield)) {
    if ((c?.name ?? '') === name) return id
  }
  return null
}

function cardInHand(gv, name) {
  const hand = gv?.myHand ?? gv?.hand
  if (!hand) return null
  const lower = name.toLowerCase()
  for (const [id, c] of Object.entries(hand)) {
    const n = String(c?.name ?? c?.displayName ?? '').toLowerCase()
    if (n === lower || n.includes(lower)) return id
  }
  return null
}

function untappedLand(gv) {
  const me = getMe(gv)
  if (!me?.battlefield) return null
  for (const [id, c] of Object.entries(me.battlefield)) {
    if (!c.tapped && (c.cardTypes ?? []).includes('LAND')) return id
  }
  return null
}

// Fuentes de maná conocidas (tierras + criaturas con habilidad de maná). El
// pago de costes de varios colores a menudo necesita una criatura (p.ej. Elvish
// Mystic aporta {G}), no solo tierras.
const MANA_CREATURES = ['Elvish Mystic', 'Llanowar Elves', 'Birds of Paradise', 'Wood Elves', 'Fyndhorn Elves', 'Glistener Elf']

function untappedManaSource(gv) {
  const me = getMe(gv)
  if (!me?.battlefield) return null
  let land = null
  for (const [id, c] of Object.entries(me.battlefield)) {
    if (c.tapped) continue
    if ((c.cardTypes ?? []).includes('LAND')) {
      if (!land) land = id
    } else if (MANA_CREATURES.includes(c.name ?? c.displayName ?? '')) {
      return id // prioriza criatura de maná si hay, para no agotar tierras
    }
  }
  return land
}

// Nº de fuentes de maná sin voltear (tierras + criaturas de maná conocidas).
// Sirve para no intentar lanzar un hechizo que no podemos pagar (lo que
// provocaría un bucle GAME_PLAY_MANA sin fin).
function untappedManaCount(gv) {
  const me = getMe(gv)
  if (!me?.battlefield) return 0
  let n = 0
  for (const c of Object.values(me.battlefield)) {
    if (c.tapped) continue
    if ((c.cardTypes ?? []).includes('LAND') || MANA_CREATURES.includes(c.name ?? c.displayName ?? '')) n++
  }
  return n
}

function optionList(choices) {
  if (!choices) return []
  if (Array.isArray(choices)) {
    return choices.map((c) => ({ value: String(c?.id ?? c?.value ?? ''), label: String(c?.label ?? c?.name ?? '') }))
  }
  if (typeof choices === 'object') {
    return Object.entries(choices).map(([k, v]) => {
      const label = typeof v === 'string' ? v : String(v?.name ?? v?.label ?? v?.description ?? JSON.stringify(v))
      return { value: String(k), label }
    })
  }
  return []
}

const DEFAULT_SIM_DECK = {
  name: 'Mage Web AI lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 50 },
  ],
  sideboard: [],
}

function defaultOnAsk(q) {
  if (/mulligan|keep your hand|keep hand/i.test(q)) return false // keep
  if (/mutate|put on top|on top/i.test(q)) return true // mutation on top
  if (/pass anyway/i.test(q)) return true // maná flotante: seguir (visto con Thoughtseize 2026-09-16)
  return undefined
}

function defaultOnChooseAbility(opts) {
  return (opts.find((o) => /mutate/i.test(o.label)) ?? opts[0])?.value
}

function defaultOnChooseChoice(opts) {
  return (opts.find((o) => /top/i.test(o.label)) ?? opts[0])?.value
}

// ---------------------------------------------------------------------------
// Torneos (sellado): un "tournament driver" crea un Sealed 2xHUMAN, captura el
// CONSTRUCT (pool) y/o juega hasta el torneo Finished (concesión) volcando:
//   - { poolOutFile }: { recordedAt, tournamentId, tableId, construct }
//     (payload TableClientMessage del evento CONSTRUCT: deck + time + mesa)
//   - { endOutFile }: { recordedAt, tournamentId, tableId, tournament }
//     (TournamentView de getTournament con tournamentState 'Finished')
//
// Flujo probado contra el servidor local (plan2 D.20): createTournamentTable →
// joinTournamentTable x2 → startTournament → joinTournament x2 (sin esto el
// torneo no arranca) → CONSTRUCT → auto-submit al expirar constructionTime →
// START_GAME → joinGame x2 → keeps → starter (self-pick: el que elige se elige
// a sí mismo) → concesión en el primer SELECT con turn>=1 → GAME_OVER →
// getTournament hasta 'Finished'. Nombres ≤14 caracteres (límite del servidor).
// ---------------------------------------------------------------------------

function tconn(username, onEvent) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    let rid = 0
    const pending = new Map()
    const events = []
    const api = { ws, name: username, events, view: null }
    api.call = (action, args) =>
      new Promise((res) => {
        const id = `${username}-${++rid}`
        pending.set(id, res)
        try {
          ws.send(JSON.stringify({ requestId: id, action, args }))
        } catch {
          res({ ok: false, error: 'send-fail' })
        }
      })
    ws.onopen = async () => {
      const r = await api.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username, password: 'x' })
      log('tconn', username, 'connect:', JSON.stringify(r).slice(0, 100))
      resolve(api)
    }
    ws.onmessage = (raw) => {
      let msg
      try {
        msg = JSON.parse(String(raw.data ?? raw))
      } catch {
        return
      }
      if (msg.requestId && pending.has(msg.requestId)) {
        pending.get(msg.requestId)(msg)
        pending.delete(msg.requestId)
        return
      }
      if (msg.requestId || msg.type === 'lobby') return
      if (msg.data?.gameView) api.view = msg.data.gameView
      // Eventos adelgazados: los gameViews completos (~180KB en sellado)
      // revienta la memoria si se acumulan.
      const slim = { method: msg.method, objectId: msg.objectId }
      if (['CONSTRUCT', 'START_GAME', 'GAME_OVER', 'END_GAME_INFO', 'TOURNAMENT_OVER', 'TOURNAMENT_INIT', 'GAME_TARGET'].includes(msg.method)) {
        slim.data = msg.data?.gameView ? { gameView: true } : msg.data
        if (msg.method === 'GAME_TARGET') slim.q = String(msg.data?.message ?? '').slice(0, 80)
      }
      events.push(slim)
      if (events.length > 400) events.splice(0, events.length - 400)
      if (msg.method === 'CONSTRUCT' || msg.method === 'START_GAME') api._full = msg
      try {
        onEvent(api, msg)
      } catch (e) {
        log('tconn handle THREW:', String(e))
      }
    }
    ws.onerror = () => reject(new Error('no se pudo conectar al proxy'))
  })
}

export async function runTournamentRecorder(driver) {
  const stamp = String(Date.now() % 100000)
  const UA = `nexus-A-${stamp}`.slice(0, 14)
  const UB = `nexus-B-${stamp}`.slice(0, 14)
  const t = driver.tournament || {}
  const constructionTime = t.constructionTime || 60
  const tableName = `rec-${driver.name}-${stamp}`.slice(0, 30)
  const joinDeck = driver.joinDeck || {
    name: 'rec-join',
    cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '265', amount: 30 }],
  }
  let tableId = null
  let tournamentId = null
  let gameId = null
  let finished = false
  let conceded = false
  let starterDone = false
  let A = null

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  function finish(code) {
    if (finished) return
    finished = true
    for (const api of [A, B]) {
      try {
        if (tableId) api?.ws.send(JSON.stringify({ action: 'removeTable', args: { tableId } }))
      } catch {}
      try {
        api?.ws.close()
      } catch {}
    }
    process.exit(code)
  }
  async function waitFor(conns, pred, secs, label) {
    for (let i = 0; i < secs * 2; i++) {
      if (finished) throw new Error('finished')
      for (const c of conns) for (const e of c.events) {
        if (pred(e)) return e
      }
      await sleep(500)
    }
    throw new Error('timeout esperando ' + label)
  }

  async function handle(api, msg) {
    const m = msg.method
    if (!m || !gameId) return
    if (['GAME_UPDATE', 'GAME_UPDATE_AND_INFORM', 'GAME_INFORM', 'GAME_INFO', 'GAME_INIT'].includes(m)) return
    if (m === 'GAME_OVER' || m === 'END_GAME_INFO' || m === 'TOURNAMENT_OVER') return
    if (!m.startsWith('GAME_')) return
    const d = msg.data ?? {}
    const q = String(d.message ?? d.question ?? '')
    const gv = api.view ?? {}
    const U = (v) => api.ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: v } }))
    const Bl = (v) => api.ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: v } }))
    if (m === 'GAME_ASK') {
      Bl(false)
      return
    }
    if (m === 'GAME_TARGET' && /starting player/i.test(q) && !starterDone) {
      let aid = gv.myPlayerId ?? (gv.players ?? []).find((p) => p.controlled)?.playerId
      for (let i = 0; i < 20 && !aid; i++) {
        await sleep(500)
        const v = api.view ?? {}
        aid = v.myPlayerId ?? (v.players ?? []).find((p) => p.controlled)?.playerId
      }
      if (!aid) return
      starterDone = true
      U(aid)
      return
    }
    if (m === 'GAME_SELECT') {
      if ((gv.turn ?? 0) >= 1 && !conceded && driver.playToEnd) {
        conceded = true
        api.call('sendPlayerAction', { gameId, action: 'CONCEDE' })
        return
      }
      const land = firstBasicLand(gv.myHand ?? gv.hand)
      if (land) U(land)
      else Bl(false)
      return
    }
    if (m === 'GAME_PLAY_MANA' || m === 'GAME_PLAY_XMANA') {
      const src = untappedManaSource(gv)
      if (src) U(src)
      else Bl(false)
      return
    }
    if (m === 'GAME_GET_AMOUNT' || m === 'GAME_TARGET_AMOUNT') {
      api.ws.send(JSON.stringify({ action: 'sendPlayerInteger', args: { gameId, value: 1 } }))
      return
    }
    if (m === 'GAME_CHOOSE_ABILITY') {
      const opts = optionList(msg.data?.choices)
      const val = driver.onChooseAbility ? driver.onChooseAbility(opts, null) : (opts[0]?.value)
      if (val) U(val)
      return
    }
    if (m === 'GAME_CHOOSE_CHOICE') {
      const opts = optionList(msg.data?.choice?.keyChoices ?? msg.data?.choice?.choices ?? msg.data?.choices)
      if (opts[0]?.value) api.ws.send(JSON.stringify({ action: 'sendPlayerString', args: { gameId, value: opts[0].value } }))
      return
    }
    if (m === 'GAME_TARGET') Bl(false)
  }

  let B = null
  try {
    A = await tconn(UA, handle)
    B = await tconn(UB, handle)

    const created = await A.call('createTournamentTable', {
      name: tableName,
      tournamentType: t.tournamentType || 'Sealed Elimination',
      matchType: t.matchType || 'Two Player Duel',
      playerTypes: ['HUMAN', 'HUMAN'],
      limitedOptions: {
        setCodes: t.setCodes || ['M20', 'M20', 'M20', 'M20', 'M20', 'M20'],
        numberBoosters: t.numberBoosters || 6,
        constructionTime,
      },
    })
    tableId = created?.data?.tableId
    if (!tableId) {
      log('createTournamentTable falló:', JSON.stringify(created).slice(0, 200))
      finish(1)
      return
    }
    log('mesa torneo creada', String(tableId).slice(0, 8))

    for (const api of [A, B]) {
      const r = await api.call('joinTournamentTable', { tableId, playerName: api.name, playerType: 'HUMAN', deck: joinDeck })
      if (!r.ok) {
        log('joinTournamentTable falló:', JSON.stringify(r).slice(0, 160))
        finish(1)
        return
      }
    }
    await A.call('startTournament', { tableId })
    const st = await waitFor([A, B], (e) => e.method === 'START_TOURNAMENT' && e.objectId, 30, 'START_TOURNAMENT')
    tournamentId = st.objectId
    log('tournamentId', String(tournamentId).slice(0, 8))
    await A.call('joinTournament', { tournamentId })
    await B.call('joinTournament', { tournamentId })
    await waitFor([A, B], (e) => e.method === 'CONSTRUCT', 90, 'CONSTRUCT')
    log('CONSTRUCT visto')

    if (driver.capturePool) {
      const full = A._full?.method === 'CONSTRUCT' ? A._full : B._full
      const OUT = `${OUT_DIR}/${driver.poolOutFile || 'sealed-pool.json'}`
      fs.mkdirSync(path.dirname(OUT), { recursive: true })
      fs.writeFileSync(OUT, JSON.stringify({ recordedAt: new Date().toISOString(), tournamentId, tableId, construct: full?.data ?? null }, null, 2))
      log('escrito', OUT)
      finish(0)
      return
    }

    log(`esperando START_GAME (auto-submit en ${constructionTime}s)…`)
    const sg = await waitFor([A, B], (e) => e.method === 'START_GAME' && e.objectId, constructionTime + 120, 'START_GAME')
    gameId = sg.objectId
    log('gameId', String(gameId).slice(0, 8))
    await A.call('joinGame', { gameId })
    await B.call('joinGame', { gameId })
    await waitFor([A, B], (e) => e.method === 'GAME_OVER', 150, 'GAME_OVER')
    log('GAME_OVER visto')
    let finalT = null
    for (let i = 0; i < 40; i++) {
      const r = await A.call('getTournament', { tournamentId })
      finalT = r?.data
      if (finalT?.tournamentState === 'Finished') break
      await sleep(3000)
    }
    if (finalT?.tournamentState !== 'Finished') {
      log('torneo no llegó a Finished:', finalT?.tournamentState)
      finish(1)
      return
    }
    const OUT = `${OUT_DIR}/${driver.endOutFile || 'tournament-end.json'}`
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify({ recordedAt: new Date().toISOString(), tournamentId, tableId, tournament: finalT }, null, 2))
    log('escrito', OUT)
    finish(0)
  } catch (e) {
    log('error:', String(e))
    finish(1)
  }
  setTimeout(() => {
    if (!finished) {
      log('TIMEOUT', driver.name)
      finish(1)
    }
  }, driver.maxMs || 480_000)
}

export async function runRecorder(driver) {
  const outFile = driver.outFile || `${driver.name}.json`
  const OUT = `${OUT_DIR}/${outFile}`
  // P4 (2026-09-15): el servidor limita el nombre a 14 caracteres (ver
  // TournamentRecorder: "Nombres ≤14"). Sufijo pid+tiempo en base36 para poder
  // lanzar varios recorders en paralelo sin colisión (mismo nombre = attach a
  // la misma sesión multi-tenant y caos cruzado).
  const USER = (`u${driver.name.replace(/[^a-z]/gi, '').slice(0, 5)}${process.pid.toString(36)}${(Date.now() % 46656).toString(36)}`).slice(0, 14)
  const host = driver.serverHost || SERVER_HOST
  const port = driver.serverPort || SERVER_PORT
  const simDeck = driver.simDeck || DEFAULT_SIM_DECK

  const ws = new WebSocket(WS_URL)
  const pending = new Map()
  const waiters = []
  let gameId = null
  let lastGV = null
  let recorded = null
  let tableId = null
  let finished = false
  // P4 (2026-09-16): watchdog anti-congelamiento del cheat. El cheatSetup
  // tiene una carrera intermitente: con ok:true pero sin más eventos el hilo
  // de juego queda muerto (pasa en ~1 de cada 3-4 cheats, tanto en T1 como en
  // T2). Si tras un cheat ok no llega ningún evento de juego en 60 s, se
  // aborta la run (finish 1) para que el bucle shell reintente barato en vez
  // de quemar los 300 s de maxMs.
  let lastGameEventAt = 0
  let cheatArmedAt = 0
  // Chat de partida: sin joinChat el proxy NO reenvía los INFO del motor
  // (p. ej. "<carta> has been fizzled."), que viajan como CHATMESSAGE GAME.
  // Unirse permite capturarlos con REC_DUMP_EVENTS=1 como evidencia real.
  let chatJoined = false
  // P4 (2026-09-16): generación de SELECTs para el auto-pass post-cheat.
  let selectGen = 0
  let lastSelectOurs = false
  const stallTimer = setInterval(() => {
    if (finished || !cheatArmedAt || recorded) return
    if (Date.now() - Math.max(lastGameEventAt, cheatArmedAt) > 60_000) {
      log('STALL post-cheat (60s sin eventos): aborto para reintento')
      finish(1)
    }
  }, 5_000)

  const waitEvent = (pred, ms = 20000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms)
      waiters.push((m) => {
        if (pred(m)) {
          clearTimeout(timer)
          resolve(m)
          return true
        }
        return false
      })
    })

  const send = (action, args, ms = 15000) =>
    new Promise((resolve) => {
      let done = false
      const finish = (v) => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(v)
      }
      const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), ms)
      const list = pending.get(action) ?? []
      list.push(finish)
      pending.set(action, list)
      try {
        ws.send(JSON.stringify({ action, args }))
      } catch {
        finish({ ok: false, error: 'send-fail' })
      }
    })

  const opened = new Promise((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('no se pudo conectar al proxy'))
  })

  function pass() {
    ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: false } }))
  }

  const ctx = {
    get me() {
      return getMe(lastGV)
    },
    get gv() {
      return lastGV
    },
    get gameId() {
      return gameId
    },
    sendAction(action, args) {
      ws.send(JSON.stringify({ action, args }))
    },
    dumpEvent(m) {
      if (process.env.REC_DUMP_EVENTS !== '1') return
      try {
        const d = m.data ?? {}
        const slim = { t: new Date().toISOString(), method: m.method }
        if (d.message !== undefined) slim.message = d.message
        if (d.question !== undefined) slim.question = d.question
        const ch = d.choices ?? d.choice?.keyChoices ?? d.choice?.choices
        if (ch !== undefined) slim.choices = optionList(ch).map((o) => o.label)
        const pt = d.options?.possibleTargets ?? d.targets
        if (pt !== undefined) slim.possibleTargets = Array.isArray(pt) ? pt.length : Object.keys(pt ?? {}).length
        fs.appendFileSync(`${OUT_DIR}/${driver.name}.events.jsonl`, JSON.stringify(slim) + '\n')
      } catch {}
    },
    send,
    // P1: coloca cartas nombradas en zonas (solo testMode; el proxy responde
    // ok:false fuera de testMode o con carta/zona/jugador desconocidos).
    // REGLA (bisecada en vivo 2026-09-15): llamar cuando la partida ya haya
    // procesado ≥1 acción normal (p.ej. tras jugar la primera tierra); en la
    // primera prioridad de la partida el cheat corre fuera del hilo de juego
    // aún arrancando y congela el loop (ok:true pero sin más GAME_UPDATEs).
    // Llamar una sola vez (el driver guarda el flag); el envío es async.
    async cheatSetup(zones, playerIdOverride) {
      const playerId = playerIdOverride ?? lastGV?.myPlayerId ?? getMe(lastGV)?.playerId
      // Generación del SELECT pendiente: si al completarse el cheat el
      // servidor no ha re-preguntado, el hilo de juego sigue aparcado
      // esperando NUESTRA respuesta al select que disparó el cheat (el cheat
      // corre en el hilo CALL, no responde al prompt). Sin este pass la
      // partida se queda muda hasta el idle-timeout (visto en vivo 2026-09-16:
      // "ok:true y silencio"). Si llegó un SELECT nuevo, el driver lo lleva.
      const gen = selectGen
      const ours = lastSelectOurs
      // Aviso P1 (2026-09-16): cheatear con prioridad en turno AJENO congela
      // el loop de forma determinista (solo turno propio tras ≥1 acción).
      if (DEBUG) {
        const me = getMe(lastGV)
        if (me && me.isActive !== true) log('cheatSetup AVISO: turno ajeno (isActive=false), probable congelamiento')
      }
      const r = await send('cheatSetup', { gameId, playerId, zones })
      if (DEBUG) log('cheatSetup →', JSON.stringify(r).slice(0, 160))
      if (r?.ok) {
        cheatArmedAt = Date.now()
        if (ours && gen === selectGen) {
          if (DEBUG) log('cheatSetup: sin re-prompt, paso el pendiente')
          pass()
        }
      }
      return r
    },
    playLand() {
      const land = firstBasicLand(lastGV?.myHand ?? lastGV?.hand)
      if (land) ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: land } }))
      return land
    },
    playCardByName(name) {
      const id = cardInHand(lastGV, name)
      if (id) ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: id } }))
      return id
    },
    // P4 (2026-09-15): carta en el propio cementerio (flashback/escape). El
    // UUID se juega directo igual que desde la mano (el servidor valida).
    cardInGraveyard(name) {
      const gy = getMe(lastGV)?.graveyard
      if (!gy) return null
      const lower = name.toLowerCase()
      for (const [id, c] of Object.entries(gy)) {
        const n = String(c?.name ?? c?.displayName ?? '').toLowerCase()
        if (n === lower || n.includes(lower)) return id
      }
      return null
    },
    // P4 (2026-09-16): activar habilidad (Birds, equipar, planeswalker) =
    // hacer CLIC en el objeto (enviar SU uuid); el servidor responde
    // GAME_CHOOSE_ABILITY cuando hay varias habilidades jugables y el driver
    // elige por texto en onChooseAbility. Enviar el UUID de la habilidad
    // directo NO activa nada: HumanPlayer resuelve el UUID con
    // game.getObject() y una habilidad no es un objeto de juego (la activación
    // se ignora en silencio; visto en vivo con el +1 de Teferi 2026-09-16).
    // kinds/match localizan el objeto con la habilidad buscada.
    playAbility(name, kinds, match) {
      const gv = lastGV
      const ids = []
      const lower = String(name ?? '').toLowerCase()
      for (const [id, c] of Object.entries(gv?.myHand ?? {})) {
        const n = String(c?.name ?? c?.displayName ?? '').toLowerCase()
        if (n === lower || n.includes(lower)) ids.push(id)
      }
      for (const [id, c] of Object.entries(getMe(gv)?.battlefield ?? {})) {
        const n = String(c?.name ?? c?.displayName ?? '').toLowerCase()
        if (n === lower || n.includes(lower)) ids.push(id)
      }
      // P4 (2026-09-16): también en la pila (la acción especial de delve
      // cuelga del hechizo en el stack).
      for (const [id, c] of Object.entries(gv?.stack ?? {})) {
        const n = String(c?.name ?? c?.displayName ?? '').toLowerCase()
        if (n === lower || n.includes(lower)) ids.push(id)
      }
      const objs = gv?.canPlayObjects?.objects ?? {}
      const order = kinds ?? ['basicPlayAbilities', 'other', 'basicCastAbilities', 'basicManaAbilities']
      for (const id of ids) {
        const stats = objs[id]
        if (DEBUG && stats) log('playAbility cands', name, JSON.stringify(Object.fromEntries(Object.entries(stats).map(([k, arr]) => [k, (arr ?? []).map((r) => String(r?.value ?? '').slice(0, 60))]))).slice(0, 400))
        if (!stats) continue
        for (const k of order) {
          const recs = stats[k] ?? []
          const rec = match ? recs.find((r) => match.test(String(r?.value ?? ''))) : recs[0]
          if (rec?.id) {
            ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: id } }))
            if (DEBUG) log('playAbility → click', name, k, 'habilidad=', String(rec.value ?? '').slice(0, 60))
            return id
          }
        }
      }
      return null
    },
    pass,
    findOnBattlefield: (name) => findOnBattlefield(lastGV, name),
    cardInHand: (name) => cardInHand(lastGV, name),
    untappedMana: () => untappedManaCount(lastGV),
    log: (...a) => { if (DEBUG) log('DRIVER', ...a) },
  }

  function handleEvent(m) {
    if (!gameId || !lastGV) return
    const gv = m.data?.gameView ?? lastGV
    const method = m.method
    if (method === 'GAME_ASK') {
      const q = String(m.data?.question ?? m.data?.message ?? '')
      if (DEBUG) log('GAME_ASK:', JSON.stringify(q).slice(0, 120))
      // P4 (2026-09-15): si el driver define onAsk pero devuelve undefined
      // para una pregunta que no le compete (p.ej. mulligan), se aplica el
      // default en vez de callar (callar en el mulligan deja la partida sin
      // arrancar).
      let ans = driver.onAsk ? driver.onAsk(q, ctx) : undefined
      if (ans === undefined) ans = defaultOnAsk(q)
      if (ans !== undefined) {
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: ans } }))
        if (DEBUG) log('ASK →', ans)
      }
      return
    }
    if (method === 'GAME_CHOOSE_ABILITY') {
      const val = driver.onChooseAbility
        ? driver.onChooseAbility(optionList(m.data?.choices), ctx)
        : defaultOnChooseAbility(optionList(m.data?.choices))
      if (val) ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: val } }))
      return
    }
    if (method === 'GAME_CHOOSE_CHOICE') {
      const opts = optionList(m.data?.choice?.keyChoices ?? m.data?.choice?.choices ?? m.data?.choices)
      const val = driver.onChooseChoice ? driver.onChooseChoice(opts, ctx) : defaultOnChooseChoice(opts)
      if (val) ws.send(JSON.stringify({ action: 'sendPlayerString', args: { gameId, value: val } }))
      return
    }
    // P4 (2026-09-16): elección de pila (Fact or Fiction, "separate into two
    // piles"): el cliente web responde con un booleano (pile1=true,
    // pile2=false). El driver puede elegir con onChoosePile(data, ctx);
    // por defecto pile 1.
    if (method === 'GAME_CHOOSE_PILE') {
      const val = driver.onChoosePile ? driver.onChoosePile(m.data ?? {}, ctx) : true
      ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: val } }))
      if (DEBUG) log('CHOOSE_PILE →', val)
      return
    }
    if (method === 'GAME_TARGET') {
      if (process.env.REC_DUMP_EVENTS === '1') {
        try {
          const slim = { keys: Object.keys(m.data ?? {}) }
          for (const [k, v] of Object.entries(m.data ?? {})) {
            if (k === 'gameView') continue
            slim[k] = JSON.stringify(v).slice(0, 1500)
          }
          log('TARGET slim:', JSON.stringify(slim).slice(0, 3000))
        } catch {}
      }
      // P4 (2026-09-15): el descarte de limpieza también llega como
      // GAME_TARGET ("Select a card to discard") — se pasa el texto para que
      // el driver discrimine (un onTarget ciego que devuelve un permanente del
      // campo ante un descarte = rechazo en bucle).
      const q = String(m.data?.message ?? m.data?.question ?? '')
      const val = driver.onTarget ? driver.onTarget(ctx, q, m.data ?? {}) : undefined
      // P4 (2026-09-16): devolver false declina el objetivo opcional
      // ("hasta una", fallar la búsqueda del tutor) con sendPlayerBoolean.
      if (val === false) {
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: false } }))
        if (DEBUG) log('TARGET → declino (false)')
      } else if (val) ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: val } }))
      return
    }
    if (method === 'GAME_TARGET_AMOUNT' || method === 'GAME_GET_AMOUNT') {
      const val = driver.onTargetAmount ? driver.onTargetAmount(m.data, ctx) : (m.data?.min ?? 1)
      ws.send(JSON.stringify({ action: 'sendPlayerInteger', args: { gameId, value: val } }))
      return
    }
    // P4 (2026-09-16): asignación de daño de combate (trample con uno o más
    // bloqueadores) llega como GAME_GET_MULTI_AMOUNT — un ítem por mensaje del
    // servidor (bloqueador o exceso al jugador), cada uno con su propio
    // min/max/defaultValue. Se responde con sendPlayerString de los valores en
    // el mismo orden, separados por espacio (igual que confirmMultiAmount en
    // el cliente web). El defaultValue del servidor ya respeta deathtouch (el
    // mínimo letal baja a 1), así que el default de la librería basta salvo
    // que el driver quiera un reparto distinto.
    if (method === 'GAME_GET_MULTI_AMOUNT') {
      const items = Array.isArray(m.data?.messages) ? m.data.messages : []
      const vals = driver.onMultiAmount
        ? driver.onMultiAmount(items, ctx, m.data)
        : items.map((it) => Number(it?.defaultValue ?? it?.min ?? 0))
      const str = vals.map((v) => String(v)).join(' ')
      if (DEBUG) log('MULTI_AMOUNT items=', JSON.stringify(items).slice(0, 300), '→', str)
      ws.send(JSON.stringify({ action: 'sendPlayerString', args: { gameId, value: str } }))
      return
    }
    if (method === 'GAME_PLAY_MANA') {
      if (DEBUG) log('PLAY_MANA msg=', JSON.stringify(m.data?.message), 'min=', m.data?.min, 'max=', m.data?.max, 'opt=', (process.env.REC_DUMP_EVENTS === '1' ? JSON.stringify(m.data?.options) : JSON.stringify(m.data?.options)?.slice(0, 120)))
      if (process.env.REC_DUMP_EVENTS === '1') {
        const objs = gv?.canPlayObjects?.objects ?? {}
        try {
          const slim = {}
          for (const [k, v] of Object.entries(objs)) {
            slim[k.slice(0, 8)] = Object.fromEntries(Object.entries(v ?? {}).map(([bk, arr]) => [bk, (arr ?? []).map((r) => String(r?.value ?? r?.id ?? '').slice(0, 80))]))
          }
          log('PLAY_MANA canPlay:', JSON.stringify(slim).slice(0, 1500), 'special=', gv?.special)
        } catch {}
      }
      // Hook P4: el driver puede pagar en turnos ajenos (p.ej. Counterspell en
      // respuesta), donde isActive=false y el comportamiento por defecto (que
      // exige turno propio, igual que SimPlayer.onPlayMana) se quedaría quieto.
      if (driver.onPlayMana) {
        try {
          driver.onPlayMana(ctx, m)
        } catch (e) {
          log('onPlayMana THREW:', String(e))
        }
        return
      }
      const me = getMe(gv)
      if (DEBUG) log('PLAY_MANA check: isActive=', me?.isActive, 'hasPriority=', me?.hasPriority, 'src=', untappedManaSource(gv))
      // Pagar enviando el UUID de una fuente sin voltear (igual que
      // SimPlayer.onPlayMana). El alto nivel sendPlayerManaType no resolvía.
      if (me?.isActive === true && me?.hasPriority === true) {
        const src = untappedManaSource(gv)
        if (src) {
          ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: src } }))
          if (DEBUG) log('PLAY_MANA →', src)
        }
      }
      return
    }
    if (method === 'GAME_SELECT') {
      const me = getMe(gv)
      selectGen += 1
      lastSelectOurs = me?.hasPriority === true
      if (DEBUG) {
        log('GAME_SELECT t=', gv.turn, 'ph=', gv.phase, 'act=', me?.isActive, 'prio=', me?.hasPriority,
          'hand=', Object.values(gv.myHand ?? gv.hand ?? {}).map((c) => c?.name ?? c?.displayName).join(','),
          'bf=', Object.values(me?.battlefield ?? {}).map((c) => `${c?.name}${c?.tapped ? '*' : ''}`).join(','))
      }
      if (me?.hasPriority !== true) {
        if (DEBUG) log('GAME_SELECT: sin prioridad, NO paso (espero)')
        return
      }
      if (DEBUG) log('GAME_SELECT → llamo onSelect (ctx.me.prio=', ctx.me?.hasPriority, 'ctx.gv.turn=', ctx.gv?.turn, ')')
      try {
        if (driver.onSelect) driver.onSelect(ctx)
        else pass()
      } catch (e) {
        log('onSelect THREW:', String(e))
      }
    }
  }

  function finish(code) {
    if (finished) return
    finished = true
    clearInterval(stallTimer)
    try {
      if (recorded) {
        fs.mkdirSync(path.dirname(OUT), { recursive: true })
        fs.writeFileSync(OUT, JSON.stringify(recorded, null, 2))
        log('escrito', OUT)
      } else {
        log('NO se capturó nada para', driver.name)
      }
    } catch (e) {
      log('error escribiendo', String(e))
    }
    if (tableId) {
      try {
        ws.send(JSON.stringify({ action: 'removeTable', args: { tableId } }))
      } catch {}
    }
    try {
      ws.close()
    } catch {}
    process.exit(code)
  }

  function captureCheck(gv) {
    if (!gv) return
    if (recorded) return
    if (DEBUG) {
      const meDbg = (gv.players ?? []).find((p) => p?.controlled)
      log('captureCheck turn=', gv.turn, 'active=', meDbg?.isActive, 'hand=', meDbg?.handCount)
    }
    if (driver.captureWhen(gv)) {
      recorded = { recordedAt: new Date().toISOString(), gameId: String(gameId), gameView: gv }
      log('CAPTURADO', driver.name, '— volcando y saliendo')
      finish(0)
    }
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
      return
    }
    if (m.type === 'event') {
      if (DEBUG) log('EVENT', m.method, 'prio/active=', getMe(m.data?.gameView)?.hasPriority, getMe(m.data?.gameView)?.isActive)
      if (DEBUG && m.method === 'GAME_ERROR') {
        const d = { ...(m.data ?? {}) }
        delete d.gameView
        log('GAME_ERROR data=', JSON.stringify(d).slice(0, 2000))
      }
      ctx.dumpEvent(m)
      if (m.method?.startsWith('GAME_')) lastGameEventAt = Date.now()
      if (m.objectId && (m.method === 'START_GAME' || m.method?.startsWith('GAME_'))) {
        if (!gameId) {
          gameId = String(m.objectId)
          // P4 (2026-09-17): unirse a la partida como el cliente web/MCP
          // (`joinGame`). Sin esto, en mesas de 5+ asientos el servidor solo
          // arranca tras el force-join a los 10 s y las acciones del humano
          // (tierra) caen al vacío sin error (visto en ffa-six: ok:true del
          // proxy y battlefield vacío). En 1v1/4p funcionaba por el force-join,
          // pero el flujo correcto es explícito.
          void send('joinGame', { gameId }, 15000).then((r) => {
            if (DEBUG) log('joinGame', String(gameId).slice(0, 8), r?.ok)
          })
        }
      }
      if (gameId && !chatJoined && driver.joinChat !== false) {
        chatJoined = true
        void send('getGameChatId', { gameId }).then((r) => {
          const cid = r?.ok ? r.data : null
          if (!cid) return
          void send('joinChat', { chatId: String(cid) }).then((j) => {
            if (DEBUG) log('joinChat', String(cid).slice(0, 8), j?.ok)
          })
        })
      }
      if (m.data?.gameView) lastGV = m.data.gameView
      handleEvent(m)
      // P4 (2026-09-17): la captura se evalúa DESPUÉS de handleEvent y sobre
      // cualquier evento con gameView (no solo GAME_UPDATE): hay estados que
      // solo viajan en GAME_SELECT/GAME_TARGET (p. ej. el turno 1 del jugador
      // activo justo tras el mulligan) y, si el ASK viene en el mismo mensaje,
      // el driver necesita haberlo visto antes de decidir su captureWhen.
      const captureGv =
        m.data?.gameView ??
        ((m.method === 'GAME_UPDATE' || m.method === 'GAME_UPDATE_AND_INFORM') && Array.isArray(m.data?.players)
          ? m.data
          : undefined)
      if (captureGv) {
        lastGV = captureGv
        captureCheck(captureGv)
      }
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i](m)) waiters.splice(i, 1)
      }
    }
  }

  try {
    await Promise.race([opened, new Promise((_, rej) => setTimeout(() => rej(new Error('open timeout')), 10000))])
    let connected = false
    for (let attempt = 0; attempt < 6 && !connected; attempt++) {
      const r = await send('connect', { host, port, username: USER, password: 'x' }, 20000)
      if (r.ok) {
        connected = true
        break
      }
      if (DEBUG || attempt % 5 === 0) log(`connect intento ${attempt + 1} falló: ${JSON.stringify(r).slice(0, 80)} — reintentando…`)
      await new Promise((r) => setTimeout(r, 5000))
    }
    if (!connected) {
      log('connect: agotados los reintentos')
      finish(1)
      return
    }
    log('conectado a', host)

    let res = await send('createTable', {
      name: `rec-${driver.name}-${Date.now()}`,
      gameType: driver.tableGameType || 'Two Player Duel',
      deckType: driver.gameType || 'Constructed - Pioneer',
      winsNeeded: 1,
      playerTypes: driver.playerTypes || ['HUMAN', 'SIM'],
      simDecks: driver.simDecks || [simDeck],
      skipInitShuffling: true,
      skipStartingPlayerChoice: driver.skipStartingPlayerChoice !== false,
      ...(driver.freeMulligans ? { freeMulligans: driver.freeMulligans } : {}),
      // P4 (2026-09-17): opciones multijugador del motor. El default de
      // MatchOptions es attackOption=LEFT (solo el vecino de la izquierda es
      // defensor legal: en FFA `Combat.getAttackablePlayers` devuelve 1 y
      // HumanPlayer.selectDefender NO pregunta defensor), por eso el combate
      // en pod con varios defensores necesita attackOption=MULTIPLE. `range`
      // (ONE/TWO/ALL) limita los oponentes atacables/objetivo.
      ...(driver.attackOption ? { attackOption: driver.attackOption } : {}),
      ...(driver.range ? { range: driver.range } : {}),
    })
    tableId = res.ok ? res.data?.tableId ?? res.data?.table?.tableId : null
    if (!tableId) {
      log('createTable falló:', res.error)
      finish(1)
      return
    }
    log('mesa creada', String(tableId).slice(0, 8))

    res = await send('joinTable', {
      tableId,
      playerName: USER,
      playerType: 'HUMAN',
      skill: 1,
      deck: driver.deck,
    })
    if (!res.ok) {
      log('joinTable falló:', res.error)
      finish(1)
      return
    }
    log('unido como humano')

    res = await send('startMatch', { tableId })
    if (!res.ok) {
      log('startMatch falló:', res.error)
      finish(1)
      return
    }
    log('partida arrancada —', driver.name)

    setTimeout(() => {
      if (!finished) {
        log('TIMEOUT', driver.name, JSON.stringify({ turn: lastGV?.turn, phase: lastGV?.phase }))
        finish(recorded ? 0 : 1)
      }
    }, driver.maxMs || 240_000)
  } catch (e) {
    log('error:', String(e))
    finish(1)
  }
}
