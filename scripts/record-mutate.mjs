#!/usr/bin/env node
// Grabador de frames reales de la mecánica Mutate contra el servidor real
// (beta.xmage.today) a través del proxy local. Es UNA sola conexión WS que
// actúa como el humano completo (no usa el HumanHelper de los E2E, así que no
// hay carrera de sesión). Juega Elvish Mystic y luego Gemrazer como mutate
// sobre él, y vuelca el GAME_UPDATE que contiene el `mutateView` real a
// web/fixtures/recorded/mutate.json (fixture anti-drift + prueba de forma real).
//
// Requiere el proxy arriba y conectado a beta:
//   node scripts/ctl.mjs restart proxy
// Uso:
//   node scripts/record-mutate.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const OUT = path.join(REPO_ROOT, 'web', 'fixtures', 'recorded', 'mutate.json')

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = process.env.E2E_SERVER_HOST || 'beta.xmage.today'
const SERVER_PORT = Number(process.env.E2E_SERVER_PORT || '17171')
const USER = `selftest-${Date.now() % 100000}`

// Mazo humano: Elvish Mystic (objetivo no-Humano barato) + Gemrazer (mutate
// {1}{G}{G}) encima. ORDENADO para mano inicial determinista [Elvish, Gemrazer,
// 5 Forest] con skipInitShuffling → turno 1 tierra+Elvish, turno 2 muta Gemrazer.
const MUTATE_DECK = {
  name: 'Mage Web mutate',
  cards: [
    { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 1 },
    { cardName: 'Gemrazer', setCode: 'iko', cardNumber: '155', amount: 1 },
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
    { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
    { cardName: 'Gemrazer', setCode: 'iko', cardNumber: '155', amount: 2 },
  ],
  sideboard: [],
}

// Mazo del asiento SIM (oponente): solo tierras básicas (siempre legales).
const SIM_DECK = {
  name: 'Mage Web AI lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 50 },
  ],
  sideboard: [],
}

const GREEN = ['Forest', 'Elvish Mystic', 'Llanowar Elves']

function log(...a) {
  console.log(`[record-mutate] ${Date.now() % 100000} `, ...a)
}

function firstBasicLand(hand) {
  if (!hand) return null
  for (const [id, c] of Object.entries(hand)) {
    if (GREEN.includes(c?.name ?? c?.displayName ?? '')) return id
  }
  return null
}

function getMe(gv) {
  return gv?.players?.find((p) => p?.controlled)
}

function greenSources(gv) {
  const me = getMe(gv)
  if (!me?.battlefield) return 0
  let n = 0
  for (const c of Object.values(me.battlefield)) {
    const tapped = c?.tapped === true
    if (!tapped && GREEN.includes(c?.name ?? '')) n++
  }
  return n
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
    if (!gv?.myHand) return null
    const lower = name.toLowerCase()
    for (const [id, c] of Object.entries(gv.myHand)) {
      const n = String(c?.name ?? c?.displayName ?? '').toLowerCase()
      if (n === lower || n.includes(lower)) return id
    }
    return null
  }

// Extrae [{value,label}] de un mapa de opciones (GAME_CHOOSE_ABILITY/CHOICE).
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

async function main() {
  const ws = new WebSocket(WS_URL)
  const pending = new Map()
  const waiters = []
  let gameId = null
  let lastGV = null
  let initGV = null
  let recorded = null
  let tableId = null
  let lastLandTurn = -1
  let elvishPlayed = false
  let gemrazerPlayed = false
  let done = false

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
      if (m.objectId && (m.method === 'START_GAME' || m.method?.startsWith('GAME_'))) {
        if (!gameId) gameId = String(m.objectId)
      }
      if (m.method === 'GAME_INIT' && m.data?.gameView && !initGV) initGV = m.data.gameView
      // mantener lastGV al día con CUALQUIER evento que traiga un gameView
      // (GAME_INIT/GAME_SELECT/GAME_ASK/GAME_CHOOSE_*/GAME_PLAY_MANA/...), no
      // solo GAME_UPDATE: si no, handleEvent se salta los primeros eventos y
      // la partida se estanca antes del primer GAME_UPDATE.
      if (m.data?.gameView) lastGV = m.data.gameView
      if (m.method === 'GAME_UPDATE' || m.method === 'GAME_UPDATE_AND_INFORM') {
        const gv = m.data?.gameView
        if (gv) {
          if (gv.turn !== lastSeenTurn || gv.phase !== lastSeenPhase) {
            lastSeenTurn = gv.turn ?? -1
            lastSeenPhase = gv.phase ?? ''
          }
          lastGV = gv
        }
        // ¿Hay un permanente mutado con mutateView en el campo de alguien?
        for (const p of gv?.players ?? []) {
          for (const c of Object.values(p?.battlefield ?? {})) {
            if (c?.mutated && c?.mutateView && Object.keys(c.mutateView).length > 0) {
              if (!recorded) {
                recorded = {
                  recordedAt: new Date().toISOString(),
                  gameId: String(m.objectId ?? gameId),
                  gameView: gv,
                }
                log('CAPTURADO mutateView en permanente', c.name, '— volcando y saliendo')
                finish(0)
                return
              }
            }
          }
        }
      }
      handleEvent(m)
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i](m)) waiters.splice(i, 1)
      }
    }
  }

  const opened = new Promise((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('no se pudo conectar al proxy'))
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

  function handleEvent(m) {
    if (!gameId || !lastGV) return
    const gv = m.data?.gameView ?? lastGV
    const method = m.method
    if (method === 'GAME_ASK') {
      const q = String(m.data?.question ?? m.data?.message ?? '')
      log('GAME_ASK:', JSON.stringify(q).slice(0, 120))
      if (/mulligan|keep your hand|keep hand/i.test(q)) {
        // "Mulligan down to N cards?" → true = mulligan de nuevo, false = keep.
        // Con skipInitShuffling la mano inicial es determinista y buena: la mantenemos.
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: false } }))
        log('mulligan: keep (false)')
      } else if (/mutate|put on top|on top/i.test(q)) {
        // orden del mutate: poner la carta nueva encima (top)
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: true } }))
        log('mutate order: top (true)')
      }
      return
    }
    if (method === 'GAME_CHOOSE_ABILITY') {
      const opts = optionList(m.data?.choices)
      const mutate = opts.find((o) => /mutate/i.test(o.label)) ?? opts[0]
      if (mutate) {
        log('GAME_CHOOSE_ABILITY →', mutate.label)
        ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: mutate.value } }))
      }
      return
    }
    if (method === 'GAME_CHOOSE_CHOICE') {
      const opts = optionList(m.data?.choice?.keyChoices ?? m.data?.choice?.choices ?? m.data?.choices)
      const top = opts.find((o) => /top/i.test(o.label)) ?? opts[0]
      if (top) {
        log('GAME_CHOOSE_CHOICE →', top.label)
        ws.send(JSON.stringify({ action: 'sendPlayerString', args: { gameId, value: top.value } }))
      }
      return
    }
    if (method === 'GAME_TARGET') {
      const elvish = findOnBattlefield(gv, 'Elvish Mystic')
      if (elvish) {
        log('GAME_TARGET → Elvish Mystic', elvish)
        ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: elvish } }))
      } else {
        const any = firstBasicLand(gv?.myHand)
        if (any) ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: any } }))
      }
      return
    }
    if (method === 'GAME_PLAY_MANA') {
      const me = getMe(gv)
      // Pago: enviar el UUID de una fuente de maná sin voltear (igual que hace
      // SimPlayer.onPlayMana: session.sendPlayerUUID(gameId, source)). El método
      // alto nivel sendPlayerManaType no resolvía el pago en este flujo.
      if (me?.isActive === true && me?.hasPriority === true) {
        const src = Object.entries(me.battlefield ?? {}).find(
          ([, c]) => !c.tapped && (GREEN.includes(c.name) || GREEN.includes(c.displayName)),
        )
        if (src) {
          ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: src[0] } }))
          log('GAME_PLAY_MANA → pagar con', src[1]?.name)
        } else if (process.env.E2E_DEBUG === '1') {
          log('GAME_PLAY_MANA: sin fuente de maná sin voltear')
        }
      }
      return
    }
    if (method === 'GAME_SELECT') {
      handleSelect(gv)
    }
  }

  let dumpedHand = false
  let lastSeenTurn = -1
  let lastSeenPhase = ''
  function handleSelect(gv) {
    const me = getMe(gv)
    if (!me || !gameId) return
    if (me.hasPriority !== true) {
      log(`SEL(turno) t=${gv.turn} ph=${gv.phase} prio=${me.hasPriority} act=${me.isActive} — sin prioridad, skip`)
      return
    }
    if (!dumpedHand && gv.myHand) {
      dumpedHand = true
      log('MANO:', JSON.stringify(Object.values(gv.myHand).map((c) => c?.name ?? c?.displayName)))
    }
    const tk = `${gv.turn}/${gv.phase}`
    if (gv.turn !== lastSeenTurn || gv.phase !== lastSeenPhase) {
      lastSeenTurn = gv.turn ?? -1
      lastSeenPhase = gv.phase ?? ''
      log(`SEL t=${gv.turn} ph=${gv.phase} act=${me.isActive} prio=${me.hasPriority} verde=${greenSources(gv)} mano=[${Object.values(gv.myHand ?? {}).map((c) => c?.name ?? c?.displayName).join(',')}] bf=[${Object.values(me.battlefield ?? {}).map((c) => c?.name).join(',')}]`)
    }
    const turn = gv.turn ?? 0
    const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
    if (!isMyMain) {
      // turno del rival o fase sin jugables: pasar para avanzar
      ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: false } }))
      return
    }
    // 1. desarrollo: una tierra por turno
    if (turn !== lastLandTurn) {
      const land = firstBasicLand(gv.myHand)
      if (land) {
        lastLandTurn = turn
        log(`turno ${turn}: jugar tierra`)
        ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: land } }))
        return
      }
    }
    // 2. Elvish Mystic (objetivo del mutate) apenas pueda
    if (!elvishPlayed) {
      const elvish = cardInHand(gv, 'Elvish Mystic')
      if (elvish) {
        elvishPlayed = true
        log(`turno ${turn}: jugar Elvish Mystic`)
        ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: elvish } }))
        return
      }
    }
    // 3. Gemrazer como mutate cuando haya maná verde suficiente y Elvish en mesa
    if (!gemrazerPlayed) {
      const gem = cardInHand(gv, 'Gemrazer')
      const elvishOnBoard = findOnBattlefield(gv, 'Elvish Mystic')
      if (gem && elvishOnBoard && greenSources(gv) >= 3) {
        gemrazerPlayed = true
        log(`turno ${turn}: jugar Gemrazer (mutate)`)
        ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId, value: gem } }))
        return
      }
    }
    // nada más que hacer esta ventana: pasar
    ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: false } }))
  }

  let finished = false
  function finish(code) {
    if (finished) return
    finished = true
    try {
      if (recorded) {
        fs.mkdirSync(path.dirname(OUT), { recursive: true })
        fs.writeFileSync(OUT, JSON.stringify(recorded, null, 2))
        log('escrito', OUT)
      } else {
        log('NO se capturó mutateView')
      }
    } catch (e) {
      log('error escribiendo', String(e))
    }
    // higiene: quitar la mesa para no dejar sesiones huérfanas en el server
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

  try {
    await Promise.race([opened, new Promise((_, rej) => setTimeout(() => rej(new Error('open timeout')), 10000))])
    // el handshake proxy↔beta es intermitente (bug conocido de beta: "Can't
    // receive server state before other data"): reintentar el connect varias
    // veces hasta que el login a beta se complete.
    let connected = false
    for (let attempt = 0; attempt < 6 && !connected; attempt++) {
      const r = await send('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER, password: 'x' }, 20000)
      if (r.ok) {
        connected = true
        break
      }
      if (attempt % 5 === 0) log(`connect intento ${attempt + 1} falló: ${JSON.stringify(r).slice(0, 80)} — reintentando…`)
      await new Promise((r) => setTimeout(r, 5000))
    }
    if (!connected) {
      log('connect: agotados los reintentos')
      finish(1)
      return
    }
    log('conectado a', SERVER_HOST)

    let res = await send('createTable', {
      name: `rec-mutate-${Date.now()}`,
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Pioneer',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'SIM'],
      simDecks: [SIM_DECK],
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
      deck: MUTATE_DECK,
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
    log('partida arrancada — jugando mutate…')

    // tope de seguridad: si en 150s no capturamos nada, salir con diagnóstico
    setTimeout(() => {
      if (!finished) {
        log('TIMEOUT:', JSON.stringify({ turn: lastGV?.turn, phase: lastGV?.phase, gemrazerPlayed, elvishPlayed }))
        finish(recorded ? 0 : 1)
      }
    }, 150_000)
  } catch (e) {
    log('error:', String(e))
    finish(1)
  }
}

await main()
