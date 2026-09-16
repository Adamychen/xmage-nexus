#!/usr/bin/env node
// P6 (plan4.md): fuzzing/self-play con mazos aleatorios reales + detector de
// bloqueos. Dos sesiones independientes conectan al proxy como si fueran 2
// cuentas: un asiento HUMAN manejado por una política genérica ingenua (jugar
// tierra/hechizo al azar cuando hay prioridad, si no pasar; nunca ataca ni
// bloquea a propósito) y un asiento SIM (el bot real `SimPlayer.java`, ya
// probado en P4). Ambos con mazos reales elegidos al azar del pool de
// sample-decks del fork (1172 .dck reales, no mazos de tierras). Se repite
// para N partidas seguidas, vigilando: bloqueo (sin eventos de juego durante
// --stallMs), callback desconocido (fuera del enum real ClientCallbackMethod,
// misma fuente que web/src/state/callbackCoverage.test.ts) y error fatal del
// proxy o cierre inesperado del WebSocket. No sustituye P2 (discrepancia
// servidor-vs-DOM): eso necesita un navegador real, este fuzzer es solo
// protocolo/proxy/servidor.
//
// Uso:
//   node scripts/fuzz.mjs [--games=20] [--concurrency=6] [--maxTurns=60] [--stallMs=45000] [--maxGameMs=480000]
//   node scripts/fuzz.mjs --games=5 --humanDeck="Life for Death" [--simDeck="..."]  (repro dirigida)
//
// Requiere el proxy (ws://127.0.0.1:8787) y un servidor XMage de test
// arrancados (scripts/start-local.mjs o equivalente) y el checkout del fork
// (NEXUS_FORK_DIR o ../xmage-fork) para el pool de mazos reales.

import fs from 'node:fs'
import path from 'node:path'
import { forkPath, repoRoot } from './lib.mjs'

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = process.env.E2E_SERVER_HOST || 'localhost'
const SERVER_PORT = Number(process.env.E2E_SERVER_PORT || '17171')

function argNum(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : def
}
function argStr(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : def
}
// Repro dirigida: fija un mazo concreto (subcadena case-insensitive del
// nombre/ruta del .dck) en vez de sortear del pool, para aislar un hallazgo
// del fuzzing masivo (p.ej. --humanDeck="Life for Death").
const HUMAN_DECK_FILTER = argStr('humanDeck', null)
const SIM_DECK_FILTER = argStr('simDeck', null)
const GAMES = argNum('games', 20)
const MAX_TURNS = argNum('maxTurns', 60)
const STALL_MS = argNum('stallMs', 45_000)
const MAX_GAME_MS = argNum('maxGameMs', 8 * 60_000)
// El proxy ya soporta varias sesiones reales concurrentes (una por username
// distinto — es lo mismo que hacían en paralelo los grabadores de P4).
// Cada partida es su propia mesa/sesión independiente, así que correrlas en
// paralelo multiplica el rendimiento sin acelerar el "pensar" de cada IA.
// Techo por debajo de maxGameThreads del servidor de test (20 en
// local-server/config/config.xml) dejando margen para otro uso concurrente.
const CONCURRENCY = argNum('concurrency', 6)

const REPORT_DIR = path.join(repoRoot, '.run')
const REPORT_PATH = path.join(REPORT_DIR, `fuzz-report-${Date.now()}.json`)

function log(...a) {
  console.log(`[fuzz] ${new Date().toISOString().slice(11, 19)}`, ...a)
}

// ---------------------------------------------------------------------------
// Callbacks conocidos (misma fuente/fallback que web/src/state/callbackCoverage.test.ts)
// ---------------------------------------------------------------------------
const FALLBACK_CALLBACKS = [
  'CHATMESSAGE', 'SHOW_USERMESSAGE', 'SERVER_MESSAGE', 'JOINED_TABLE',
  'START_TOURNAMENT', 'TOURNAMENT_INIT', 'TOURNAMENT_UPDATE', 'TOURNAMENT_OVER',
  'START_DRAFT', 'SIDEBOARD', 'CONSTRUCT', 'DRAFT_OVER', 'DRAFT_INIT', 'DRAFT_PICK', 'DRAFT_UPDATE',
  'SHOW_TOURNAMENT', 'WATCHGAME', 'VIEW_LIMITED_DECK', 'VIEW_SIDEBOARD', 'USER_REQUEST_DIALOG', 'GAME_REDRAW_GUI',
  'START_GAME', 'GAME_INIT', 'GAME_UPDATE_AND_INFORM', 'GAME_INFORM_PERSONAL', 'GAME_ERROR', 'GAME_UPDATE',
  'GAME_TARGET', 'GAME_CHOOSE_ABILITY', 'GAME_CHOOSE_PILE', 'GAME_CHOOSE_CHOICE', 'GAME_ASK', 'GAME_SELECT',
  'GAME_PLAY_MANA', 'GAME_PLAY_XMANA', 'GAME_GET_AMOUNT', 'GAME_GET_MULTI_AMOUNT', 'GAME_OVER', 'END_GAME_INFO',
  'REPLAY_GAME', 'REPLAY_INIT', 'REPLAY_UPDATE', 'REPLAY_DONE',
]
function loadKnownMethods() {
  try {
    const src = fs.readFileSync(forkPath('Mage.Common/src/main/java/mage/interfaces/callback/ClientCallbackMethod.java'), 'utf8')
    const names = new Set()
    const re = /^\s*([A-Z][A-Z0-9_]*)\s*\(/gm
    let m
    while ((m = re.exec(src))) names.add(m[1])
    names.delete('CLIENTCALLBACKMETHOD')
    if (names.size >= 30) return names
  } catch {}
  return new Set(FALLBACK_CALLBACKS)
}
const KNOWN_METHODS = loadKnownMethods()

// ---------------------------------------------------------------------------
// Pool de mazos reales (.dck del fork, no generados)
// ---------------------------------------------------------------------------
function collectDckFiles(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) collectDckFiles(p, out)
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.dck')) out.push(p)
  }
  return out
}

function parseDck(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const cards = []
  const sideboard = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || /^NAME\s*:/i.test(line)) continue
    const m = line.match(/^(SB:\s*)?(\d+)\s*\[([^:\]]+):([^\]]+)\]\s+(.+)$/)
    if (!m) continue
    const [, sb, amountStr, setCode, cardNumber, cardName] = m
    const entry = { cardName: cardName.trim(), setCode: setCode.trim(), cardNumber: cardNumber.trim(), amount: Number(amountStr) }
    ;(sb ? sideboard : cards).push(entry)
  }
  return { name: path.basename(filePath, '.dck'), cards, sideboard }
}

let deckPool = null
function ensureDeckPool() {
  if (!deckPool) {
    deckPool = collectDckFiles(forkPath('Mage.Client/release/sample-decks'))
    if (deckPool.length === 0) {
      throw new Error(`no hay .dck en ${forkPath('Mage.Client/release/sample-decks')} — ¿fork clonado? (NEXUS_FORK_DIR o ../xmage-fork)`)
    }
    log(`pool de mazos reales: ${deckPool.length} archivos .dck`)
  }
  return deckPool
}
/** Repro dirigida: primer .dck del pool cuya ruta contiene `filter` (sin
 *  distinguir mayúsculas). Lanza si no hay ninguno, para no fallar en
 *  silencio con un typo. */
function pickFixedDeck(filter) {
  const pool = ensureDeckPool()
  const needle = filter.toLowerCase()
  const file = pool.find((f) => f.toLowerCase().includes(needle))
  if (!file) throw new Error(`ningún .dck del pool coincide con "${filter}"`)
  return { ...parseDck(file), file: path.relative(forkPath('.'), file) }
}
function pickRandomDeck() {
  const pool = ensureDeckPool()
  for (let tries = 0; tries < 10; tries++) {
    const file = pool[Math.floor(Math.random() * pool.length)]
    const deck = parseDck(file)
    const total = deck.cards.reduce((s, c) => s + c.amount, 0)
    if (total >= 40 && total <= 300 && deck.cards.length > 0) {
      return { ...deck, file: path.relative(forkPath('.'), file) }
    }
  }
  throw new Error('no encontré un mazo válido tras 10 intentos (pool corrupto?)')
}

// ---------------------------------------------------------------------------
// Conexión WS genérica (mismo patrón que scripts/rec-lib.mjs)
// ---------------------------------------------------------------------------
function optionList(choices) {
  if (!choices) return []
  if (Array.isArray(choices)) {
    // "Modo texto" de GAME_CHOOSE_CHOICE (Cavern of Souls/Pithing Needle,
    // ver plan4.md §3.7): choice.choices puede ser un array de STRINGS
    // planos, no de {id,value}. Confirmado en vivo (2026-09-16): con
    // c?.id ?? c?.value sobre un string da '' (falsy) → sendPlayerString
    // nunca se envía y el bot se queda mudo hasta el idle-timeout del
    // servidor (visto como "stall" con [NPH] Life for Death.dck, que era
    // en realidad este bug del fuzzer, no del producto).
    return choices.map((c) =>
      typeof c === 'string'
        ? { value: c, label: c }
        : { value: String(c?.id ?? c?.value ?? ''), label: String(c?.label ?? c?.name ?? '') },
    )
  }
  if (typeof choices === 'object') return Object.entries(choices).map(([k, v]) => ({ value: String(k), label: typeof v === 'string' ? v : String(v?.name ?? v?.label ?? '') }))
  return []
}
function getMe(gv) {
  return gv?.players?.find((p) => p?.controlled)
}
const MANA_CREATURES = ['Elvish Mystic', 'Llanowar Elves', 'Birds of Paradise', 'Wood Elves', 'Fyndhorn Elves']
function untappedManaSource(gv) {
  const me = getMe(gv)
  if (!me?.battlefield) return null
  let land = null
  for (const [id, c] of Object.entries(me.battlefield)) {
    if (c.tapped) continue
    if ((c.cardTypes ?? []).includes('LAND')) { if (!land) land = id }
    else if (MANA_CREATURES.includes(c.name ?? c.displayName ?? '')) return id
  }
  return land
}
function firstBasicLand(hand) {
  if (!hand) return null
  for (const [id, c] of Object.entries(hand)) {
    if ((c?.cardTypes ?? []).includes('LAND') || /Forest|Island|Mountain|Swamp|Plains/i.test(c?.name ?? c?.displayName ?? '')) return id
  }
  return null
}
/** Cualquier objeto jugable ahora mismo (mano o campo), según canPlayObjects. */
function randomPlayableObjectId(gv) {
  const objs = gv?.canPlayObjects?.objects
  if (!objs) return null
  const ids = Object.keys(objs).filter((id) => {
    const stats = objs[id]
    return ['basicCastAbilities', 'basicPlayAbilities', 'basicManaAbilities', 'other'].some((k) => (stats?.[k] ?? []).length > 0)
  })
  if (ids.length === 0) return null
  return ids[Math.floor(Math.random() * ids.length)]
}

function connectPlayer(username) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    let rid = 0
    const pending = new Map()
    const api = {
      ws, name: username, view: null, gameId: null,
      lastEventAt: Date.now(), anomalies: [], turn: 0, over: false, closedExpectedly: false,
    }
    api.call = (action, args) =>
      new Promise((res) => {
        const id = `${username}-${++rid}`
        pending.set(id, res)
        try { ws.send(JSON.stringify({ requestId: id, action, args })) } catch { res({ ok: false, error: 'send-fail' }) }
      })
    // Anti-flood defensivo: el Gateway cierra la conexión (código 1008) por
    // encima de maxMessagesPerSecond (100 por defecto, ventana deslizante de
    // 1s). Una ráfaga legítima (varios prompts distintos seguidos al
    // arrancar la partida) puede acercarse a ese límite. En vez de
    // descartar respuestas (visto en vivo: un descarte ingenuo deja prompts
    // sin contestar — p.ej. el mulligan solo se pregunta una vez — y el
    // fuzzer confunde su propio silencio con un bloqueo real del servidor),
    // se encola y se drena a un ritmo seguro muy por debajo del límite: toda
    // respuesta llega, solo se espacía.
    const SAFE_SENDS_PER_SEC = 40
    const sendQueue = []
    let draining = false
    function drainQueue() {
      if (draining) return
      draining = true
      const tick = () => {
        const next = sendQueue.shift()
        if (!next) { draining = false; return }
        try { ws.send(JSON.stringify(next)) } catch {}
        setTimeout(tick, 1000 / SAFE_SENDS_PER_SEC)
      }
      tick()
    }
    api.sendCount = 0
    api.send = (action, args) => {
      if (!api.gameId) return
      api.sendCount++
      sendQueue.push({ action, args: { gameId: api.gameId, ...args } })
      drainQueue()
    }
    ws.onopen = async () => {
      const r = await api.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username, password: 'x' })
      if (!r.ok) { reject(new Error(`connect falló para ${username}: ${JSON.stringify(r).slice(0, 160)}`)); return }
      resolve(api)
    }
    ws.onmessage = (raw) => {
      let msg
      try { msg = JSON.parse(String(raw.data ?? raw)) } catch { return }
      if (msg.requestId && pending.has(msg.requestId)) { pending.get(msg.requestId)(msg); pending.delete(msg.requestId); return }
      if (msg.type === 'error') {
        api.anomalies.push({ kind: 'proxyError', at: Date.now(), message: msg.message, fatal: !!msg.fatal })
        return
      }
      if (msg.type !== 'event') return
      api.lastEventAt = Date.now()
      const method = msg.method
      if (method && !KNOWN_METHODS.has(method)) {
        api.anomalies.push({ kind: 'unknownCallback', at: Date.now(), method })
      }
      if (msg.data?.gameView) { api.view = msg.data.gameView; api.turn = msg.data.gameView.turn ?? api.turn }
      else if (Array.isArray(msg.data?.players)) { api.view = msg.data; api.turn = msg.data.turn ?? api.turn }
      if (msg.objectId && (method === 'START_GAME' || String(method).startsWith('GAME_')) && !api.gameId) {
        api.gameId = String(msg.objectId)
      }
      if (method === 'GAME_OVER' || method === 'END_GAME_INFO') api.over = true
      const RESPONSE_REQUIRED = new Set([
        'GAME_ASK', 'GAME_CHOOSE_ABILITY', 'GAME_CHOOSE_CHOICE', 'GAME_CHOOSE_PILE', 'GAME_TARGET',
        'GAME_GET_AMOUNT', 'GAME_TARGET_AMOUNT', 'GAME_GET_MULTI_AMOUNT', 'GAME_PLAY_MANA', 'GAME_PLAY_XMANA',
      ])
      const before = api.sendCount
      respond(api, msg)
      // Diagnóstico (2026-09-16): dump de cualquier prompt que exige
      // respuesta y se quedó sin ella — así se ve la forma real del dato
      // (p.ej. GAME_CHOOSE_CHOICE con una forma no contemplada) en vez de
      // reconstruirla a ciegas. GAME_SELECT no cuenta: la política puede
      // pasar a propósito.
      if (RESPONSE_REQUIRED.has(method) && api.sendCount === before) {
        try {
          const slim = { ...msg.data }
          delete slim.gameView
          fs.appendFileSync(
            path.join(REPORT_DIR, 'fuzz-unanswered.jsonl'),
            JSON.stringify({ at: Date.now(), player: username, gameId: api.gameId, method, data: slim }) + '\n',
          )
        } catch {}
      }
    }
    ws.onerror = (e) => {
      api.anomalies.push({ kind: 'wsError', at: Date.now(), message: String(e?.message ?? e) })
    }
    ws.onclose = (e) => {
      if (!api.closedExpectedly) {
        api.anomalies.push({ kind: 'wsClosedUnexpectedly', at: Date.now(), code: e?.code, reason: e?.reason })
      }
    }
  })
}

/** Política genérica ingenua: nunca ataca/bloquea, paga maná con la primera
 *  fuente sin voltear, declina objetivos opcionales, y juega tierra/hechizo
 *  al azar con probabilidad moderada cuando tiene prioridad. Suficiente para
 *  un fuzzer de estabilidad (no de "jugar bien"). */
function respond(api, m) {
  if (!api.gameId) return
  const gv = m.data?.gameView ?? api.view
  const method = m.method
  switch (method) {
    case 'GAME_ASK': {
      const q = String(m.data?.question ?? m.data?.message ?? '')
      const ans = /mulligan|keep your hand|keep hand/i.test(q) ? false : /pass anyway/i.test(q)
      api.send('sendPlayerBoolean', { value: ans })
      return
    }
    case 'GAME_CHOOSE_ABILITY': {
      const opts = optionList(m.data?.choices)
      // opts[0]?.value truthy-check: un value '' (string vacío, legítimo en
      // "modo texto") sería falsy y dejaría el prompt sin respuesta — usar
      // longitud, no veracidad del valor.
      if (opts.length > 0) api.send('sendPlayerUUID', { value: opts[0].value })
      return
    }
    case 'GAME_CHOOSE_CHOICE': {
      // Confirmado en vivo (2026-09-16, gameId f80a728d…): keyChoices llega
      // como {} (objeto vacío) en "modo texto" — NO null/undefined — así que
      // un `keyChoices ?? choices` con `??` nunca cae al fallback (jamás
      // pasa de {} a choices) y optionList({}) da []. Hay que comprobar
      // longitud explícitamente antes de preferir keyChoices sobre choices.
      const keyChoices = m.data?.choice?.keyChoices
      const source = keyChoices && Object.keys(keyChoices).length > 0 ? keyChoices : (m.data?.choice?.choices ?? m.data?.choices)
      const opts = optionList(source)
      if (opts.length > 0) api.send('sendPlayerString', { value: opts[0].value })
      return
    }
    case 'GAME_CHOOSE_PILE':
      api.send('sendPlayerBoolean', { value: true })
      return
    case 'GAME_TARGET': {
      const q = String(m.data?.message ?? m.data?.question ?? '')
      if (/starting player/i.test(q)) {
        const myId = gv?.myPlayerId ?? getMe(gv)?.playerId
        if (myId) { api.send('sendPlayerUUID', { value: myId }); return }
      }
      const possible = m.data?.options?.possibleTargets ?? m.data?.targets
      const ids = Array.isArray(possible) ? possible : Object.keys(possible ?? {})
      if (m.data?.flag === false && ids.length === 0) { api.send('sendPlayerBoolean', { value: false }); return }
      if (ids.length) { api.send('sendPlayerUUID', { value: ids[0] }); return }
      api.send('sendPlayerBoolean', { value: false })
      return
    }
    case 'GAME_GET_AMOUNT':
    case 'GAME_TARGET_AMOUNT':
      api.send('sendPlayerInteger', { value: m.data?.min ?? 0 })
      return
    case 'GAME_GET_MULTI_AMOUNT': {
      const items = Array.isArray(m.data?.messages) ? m.data.messages : []
      const vals = items.map((it) => Number(it?.defaultValue ?? it?.min ?? 0))
      api.send('sendPlayerString', { value: vals.map(String).join(' ') })
      return
    }
    case 'GAME_PLAY_MANA':
    case 'GAME_PLAY_XMANA': {
      const me = getMe(gv)
      if (me?.isActive === true && me?.hasPriority === true) {
        const src = untappedManaSource(gv)
        if (src) { api.send('sendPlayerUUID', { value: src }); return }
      }
      api.send('sendPlayerBoolean', { value: false })
      return
    }
    case 'GAME_SELECT': {
      const me = getMe(gv)
      if (me?.hasPriority !== true) return
      const roll = Math.random()
      if (roll < 0.35) {
        const land = firstBasicLand(gv?.myHand ?? gv?.hand)
        if (land) { api.send('sendPlayerUUID', { value: land }); return }
      }
      if (roll < 0.6) {
        const obj = randomPlayableObjectId(gv)
        if (obj) { api.send('sendPlayerUUID', { value: obj }); return }
      }
      api.send('sendPlayerBoolean', { value: false })
      return
    }
    default:
      return
  }
}

// ---------------------------------------------------------------------------
// Una partida
// ---------------------------------------------------------------------------
async function playOneGame(gameNum) {
  const stamp = `${Date.now().toString(36)}${gameNum}`
  const humanUser = `fz-h-${stamp}`.slice(0, 14)
  const humanDeck = HUMAN_DECK_FILTER ? pickFixedDeck(HUMAN_DECK_FILTER) : pickRandomDeck()
  const simDeck = SIM_DECK_FILTER ? pickFixedDeck(SIM_DECK_FILTER) : pickRandomDeck()

  const result = { gameNum, humanUser, humanDeck: humanDeck.file, simDeck: simDeck.file, anomalies: [], turnsPlayed: 0, outcome: 'unknown', durationMs: 0 }
  const startedAt = Date.now()

  const human = await connectPlayer(humanUser)

  let tableId = null
  try {
    const created = await human.call('createTable', {
      name: `fuzz-${stamp}`,
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Vintage',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'SIM'],
      simDecks: [{ name: simDeck.name, cards: simDeck.cards, sideboard: simDeck.sideboard }],
    })
    tableId = created?.ok ? created.data?.tableId ?? created.data?.table?.tableId : null
    if (!tableId) {
      result.outcome = 'createTable-failed'
      result.anomalies.push({ kind: 'setupFailed', step: 'createTable', detail: JSON.stringify(created).slice(0, 300) })
      return result
    }

    const joined = await human.call('joinTable', {
      tableId, playerName: humanUser, playerType: 'HUMAN', skill: 1,
      deck: { name: humanDeck.name, cards: humanDeck.cards, sideboard: humanDeck.sideboard },
    })
    if (!joined.ok) {
      result.outcome = 'joinTable-failed'
      result.anomalies.push({ kind: 'setupFailed', step: 'joinTable', detail: JSON.stringify(joined).slice(0, 300) })
      return result
    }

    const started = await human.call('startMatch', { tableId })
    if (!started.ok) {
      result.outcome = 'startMatch-failed'
      result.anomalies.push({ kind: 'setupFailed', step: 'startMatch', detail: JSON.stringify(started).slice(0, 300) })
      return result
    }

    // Bucle de vigilancia: hasta GAME_OVER, timeout de partida, tope de
    // turnos (fuerza CONCEDE) o bloqueo (sin eventos de juego en STALL_MS).
    const deadline = startedAt + MAX_GAME_MS
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000))
      if (human.over) { result.outcome = 'game-over'; break }
      if (human.gameId && Date.now() - human.lastEventAt > STALL_MS) {
        result.outcome = 'stalled'
        result.anomalies.push({
          kind: 'stall', at: Date.now(), sinceLastEventMs: Date.now() - human.lastEventAt,
          turn: human.turn, gameId: human.gameId,
        })
        break
      }
      if (human.gameId && human.turn > MAX_TURNS) {
        result.outcome = 'turn-cap-conceded'
        await human.call('sendPlayerAction', { gameId: human.gameId, action: 'CONCEDE' })
        await new Promise((r) => setTimeout(r, 3000))
        break
      }
    }
    if (result.outcome === 'unknown') {
      result.outcome = 'timeout'
      result.anomalies.push({ kind: 'gameTimeout', at: Date.now(), turn: human.turn })
    }
  } catch (e) {
    result.outcome = 'exception'
    result.anomalies.push({ kind: 'scriptException', message: String(e?.stack ?? e) })
  } finally {
    result.turnsPlayed = human.turn
    result.anomalies.push(...human.anomalies)
    human.closedExpectedly = true
    try { if (tableId) human.ws.send(JSON.stringify({ action: 'removeTable', args: { tableId } })) } catch {}
    await new Promise((r) => setTimeout(r, 300))
    try { human.ws.close() } catch {}
    result.durationMs = Date.now() - startedAt
  }
  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log(`arrancando fuzzer P6: ${GAMES} partidas, concurrency=${CONCURRENCY}, maxTurns=${MAX_TURNS}, stallMs=${STALL_MS}, maxGameMs=${MAX_GAME_MS}`)
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const results = []
  let nextGame = 1
  let finished = 0
  async function worker() {
    while (nextGame <= GAMES) {
      const i = nextGame++
      log(`partida ${i}/${GAMES} arrancando…`)
      let r
      try {
        r = await playOneGame(i)
      } catch (e) {
        r = { gameNum: i, outcome: 'exception', anomalies: [{ kind: 'scriptException', message: String(e?.stack ?? e) }], turnsPlayed: 0, durationMs: 0 }
      }
      results.push(r)
      finished++
      const flag = r.anomalies.length > 0 ? ` ⚠️  ${r.anomalies.length} anomalía(s)` : ''
      log(`  → [${finished}/${GAMES}] partida ${i}: ${r.outcome} (turno ${r.turnsPlayed}, ${(r.durationMs / 1000).toFixed(1)}s)${flag}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, GAMES) }, () => worker()))
  // orden estable en el informe aunque hayan terminado desordenadas
  results.sort((a, b) => a.gameNum - b.gameNum)

  const summary = {
    generatedAt: new Date().toISOString(),
    games: GAMES,
    config: { concurrency: CONCURRENCY, maxTurns: MAX_TURNS, stallMs: STALL_MS, maxGameMs: MAX_GAME_MS },
    outcomeCounts: results.reduce((acc, r) => { acc[r.outcome] = (acc[r.outcome] ?? 0) + 1; return acc }, {}),
    totalAnomalies: results.reduce((s, r) => s + r.anomalies.length, 0),
    results,
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2))
  log('resumen:', JSON.stringify(summary.outcomeCounts))
  log(`anomalías totales: ${summary.totalAnomalies}`)
  log(`informe: ${REPORT_PATH}`)
  process.exit(summary.totalAnomalies > 0 && results.some((r) => r.anomalies.some((a) => a.kind === 'stall' || a.kind === 'scriptException' || a.kind === 'unknownCallback')) ? 1 : 0)
}

main().catch((e) => {
  console.error('[fuzz] FATAL', e)
  process.exit(1)
})
