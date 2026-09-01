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
  return undefined
}

function defaultOnChooseAbility(opts) {
  return (opts.find((o) => /mutate/i.test(o.label)) ?? opts[0])?.value
}

function defaultOnChooseChoice(opts) {
  return (opts.find((o) => /top/i.test(o.label)) ?? opts[0])?.value
}

export async function runRecorder(driver) {
  const outFile = driver.outFile || `${driver.name}.json`
  const OUT = `${OUT_DIR}/${outFile}`
  const USER = `selftest-${Date.now() % 100000}`
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
    send,
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
      const ans = driver.onAsk ? driver.onAsk(q, ctx) : defaultOnAsk(q)
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
    if (method === 'GAME_TARGET') {
      const val = driver.onTarget ? driver.onTarget(ctx) : undefined
      if (val) ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: val } }))
      return
    }
    if (method === 'GAME_PLAY_MANA') {
      if (DEBUG) log('PLAY_MANA msg=', JSON.stringify(m.data?.message), 'min=', m.data?.min, 'max=', m.data?.max, 'opt=', JSON.stringify(m.data?.options)?.slice(0, 120))
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
      if (m.objectId && (m.method === 'START_GAME' || m.method?.startsWith('GAME_'))) {
        if (!gameId) gameId = String(m.objectId)
      }
      if (m.data?.gameView) lastGV = m.data.gameView
      if (m.method === 'GAME_UPDATE' || m.method === 'GAME_UPDATE_AND_INFORM') {
        const gv = m.data?.gameView
        if (gv) {
          lastGV = gv
          captureCheck(gv)
        }
      }
      handleEvent(m)
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
      gameType: 'Two Player Duel',
      deckType: driver.gameType || 'Constructed - Pioneer',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'SIM'],
      simDecks: [simDeck],
      skipInitShuffling: true,
      skipStartingPlayerChoice: true,
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
