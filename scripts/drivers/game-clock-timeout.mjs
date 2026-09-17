// P4 §3.5 "Timeout de reloj de partida" (chess clock por partida). NO usa
// runRecorder de rec-lib.mjs: ese harness compartido crea la mesa con un
// createTable hardcodeado (name/gameType/deckType/winsNeeded/playerTypes/
// simDecks/skipInitShuffling/skipStartingPlayerChoice, scripts/rec-lib.mjs
// líneas ~871-880) SIN forma de colar `timeLimit`/`bufferTime` — y esos campos
// sí llegan hasta el motor (ver hallazgo en el informe: MatchOptionsParser.java
// los parsea, MatchImpl.initGame los aplica a game.priorityTime/player.
// priorityTimeLeft, GameController arma un PriorityTimer real por jugador que
// se resume/pausa en cada HumanPlayer.priority()). Para probar el timeout real
// sin tocar rec-lib.mjs (prohibido por el encargo), este driver reimplementa
// el mínimo protocolo WS necesario (connect/createTable/joinTable/startMatch +
// despacho de eventos) en vez de reusar runRecorder.
//
// Estrategia: mesa con el timeLimit legal más corto que expone el enum del
// motor (MatchTimeLimit.MIN___5 = 300s; el enum tiene incluso una opción más
// corta que el propio wizard web, que arranca en 15 min — ver
// web/src/lobby/CreateTable/constants.ts TIME_LIMIT_OPTIONS vs
// Mage/src/main/java/mage/constants/MatchTimeLimit.java) y bufferTime NONE.
// Se responde el mulligan (mantener mano) para arrancar la partida, y a partir
// de ahí NO se responde a NINGÚN prompt (ni GAME_SELECT/prioridad, ni
// GAME_TARGET, ni nada): HumanPlayer.priority() hace
// game.resumeTimer(...)/response.wait() y el reloj del jugador humano corre
// sin pausar hasta agotar los 300s, momento en que GameController dispara
// game.timerTimeout(playerId) → PlayerImpl.timerTimeout() (quit=true,
// timerTimeout=true, concede()) → GameEndView.additionalInfo = "You run out
// of time." (distinto del texto de un concede/quit normal). Ese texto es la
// prueba de que la derrota fue POR RELOJ, no por vida/concesión, y solo viaje
// en el payload GAME_OVER (GameEndView), no en el GameView normal (PlayerView
// no expone hasTimerTimeout()/hasIdleTimeout() al cliente, solo hasLeft()).

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT_DIR = new URL('../../web/fixtures/recorded/', import.meta.url).pathname
const OUT = `${OUT_DIR}/game-clock-timeout.json`
const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = process.env.E2E_SERVER_HOST || 'localhost'
const SERVER_PORT = Number(process.env.E2E_SERVER_PORT || '17171')
const DEBUG = process.env.E2E_DEBUG === '1'
const MAX_MS = 340_000 // 300s de reloj + margen

function log(...a) {
  console.log(`[game-clock-timeout] ${Date.now() % 100000} `, ...a)
}

// Mismo mazo mono-tierra usado por otros drivers reales (reanimate.mjs) — no
// nos importa jugar nada, solo necesitamos un deck válido para joinTable.
const DECK = {
  name: 'Mage Web clock-timeout rec',
  cards: [{ cardName: 'Swamp', setCode: 'LEA', cardNumber: '286', amount: 60 }],
  sideboard: [],
}
const SIM_DECK = {
  name: 'Mage Web AI lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 50 },
  ],
  sideboard: [],
}

async function main() {
  const USER = (`uclk${process.pid.toString(36)}${(Date.now() % 46656).toString(36)}`).slice(0, 14)
  const ws = new WebSocket(WS_URL)
  const pending = new Map()
  let gameId = null
  let tableId = null
  let lastGV = null
  let finished = false

  const send = (action, args, ms = 15000) =>
    new Promise((resolve) => {
      let done = false
      const finishOne = (v) => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(v)
      }
      const timer = setTimeout(() => finishOne({ ok: false, error: 'timeout' }), ms)
      const list = pending.get(action) ?? []
      list.push(finishOne)
      pending.set(action, list)
      try {
        ws.send(JSON.stringify({ action, args }))
      } catch {
        finishOne({ ok: false, error: 'send-fail' })
      }
    })

  const opened = new Promise((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('no se pudo conectar al proxy'))
  })

  let result = null // { additionalInfo, gameInfo, matchInfo, ... } del GAME_OVER

  function finish(code) {
    if (finished) return
    finished = true
    try {
      if (result) {
        const recorded = {
          recordedAt: new Date().toISOString(),
          gameId: String(gameId),
          gameView: lastGV,
          gameEndView: result,
        }
        fs.mkdirSync(path.dirname(OUT), { recursive: true })
        fs.writeFileSync(OUT, JSON.stringify(recorded, null, 2))
        log('escrito', OUT)
      } else {
        log('NO se capturó GAME_OVER')
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
    if (m.type !== 'event') return
    if (DEBUG) log('EVENT', m.method)
    if (m.method === 'GAME_INIT' || m.method === 'GAME_UPDATE' || m.method === 'GAME_UPDATE_AND_INFORM') {
      if (m.data?.gameView) lastGV = m.data.gameView
      if (!gameId && m.objectId) gameId = String(m.objectId)
      return
    }
    if (m.method === 'GAME_ASK') {
      const q = String(m.data?.question ?? m.data?.message ?? '')
      if (/mulligan|keep your hand|keep hand/i.test(q)) {
        log('GAME_ASK mulligan → mantengo mano')
        ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId, value: false } }))
      } else {
        log('GAME_ASK ignorada (no respondo):', q.slice(0, 80))
      }
      return
    }
    if (m.method === 'GAME_OVER') {
      log('GAME_OVER — additionalInfo:', JSON.stringify(m.data?.additionalInfo))
      result = m.data ?? {}
      if (m.data?.gameView) lastGV = m.data.gameView
      finish(0)
      return
    }
    // GAME_SELECT / GAME_TARGET / GAME_PLAY_MANA / etc: deliberadamente NO se
    // responde — es el punto del driver (dejar correr el reloj de prioridad).
    if (['GAME_SELECT', 'GAME_TARGET', 'GAME_PLAY_MANA', 'GAME_CHOOSE_ABILITY', 'GAME_CHOOSE_CHOICE'].includes(m.method)) {
      log(m.method, '— NO respondo a propósito (dejo correr el reloj)')
    }
  }

  setTimeout(() => {
    if (!finished) {
      log('TIMEOUT global sin GAME_OVER — abortando')
      finish(1)
    }
  }, MAX_MS)

  await Promise.race([opened, new Promise((_, rej) => setTimeout(() => rej(new Error('open timeout')), 10000))])

  let res = await send('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER, password: 'x' }, 20000)
  if (!res.ok) {
    log('connect falló:', JSON.stringify(res))
    finish(1)
    return
  }
  log('conectado a', SERVER_HOST)

  res = await send('createTable', {
    name: `rec-clock-${Date.now()}`,
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Pioneer',
    winsNeeded: 1,
    playerTypes: ['HUMAN', 'SIM'],
    simDecks: [SIM_DECK],
    skipInitShuffling: true,
    skipStartingPlayerChoice: true,
    // Los campos que rec-lib.mjs/runRecorder NUNCA manda (ver cabecera): el
    // límite legal más corto del motor (300s) y sin buffer extra.
    timeLimit: 'MIN___5',
    bufferTime: 'NONE',
  })
  tableId = res.ok ? res.data?.tableId ?? res.data?.table?.tableId : null
  if (!tableId) {
    log('createTable falló:', JSON.stringify(res.error))
    finish(1)
    return
  }
  log('mesa creada', String(tableId).slice(0, 8))

  res = await send('joinTable', { tableId, playerName: USER, playerType: 'HUMAN', skill: 1, deck: DECK })
  if (!res.ok) {
    log('joinTable falló:', JSON.stringify(res.error))
    finish(1)
    return
  }
  log('unido como humano')

  res = await send('startMatch', { tableId })
  if (!res.ok) {
    log('startMatch falló:', JSON.stringify(res.error))
    finish(1)
    return
  }
  log('partida arrancada — esperando a que el reloj (300s) agote la prioridad del humano…')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    log('error fatal:', String(e))
    process.exit(1)
  })
}
