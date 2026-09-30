#!/usr/bin/env node
// Calentamiento del stack: espera a que el proxy termine de cargar su BD de
// cartas (ERR_WARMING_UP en cada connect mientras CardScanner corre en
// background; el escaneo frío en CI tarda minutos) y luego crea una partida
// IA vs IA descartable para "tripar" el canal de callbacks del servidor tras
// un arranque en frío (la PRIMERA partida puede perder el socket de retorno:
// "SESSION CALLBACK EXCEPTION - Unable to create socket" en server.out.log).
// Si el fallo del juego ocurre, se reintenta una vez.
// Uso: node scripts/warmup.mjs

import { wsConn } from './lib.mjs'

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
// CI escanea la BD de cartas del proxy en frío (ruta relativa ./db, fuera del
// caché del servidor): hasta READY todo connect responde ERR_WARMING_UP.
const READY_TIMEOUT_MS = Number(process.env.NEXUS_PROXY_WARMUP_MS ?? 600_000)
const READY_POLL_MS = 5000
// transient failures right after `dev.mjs start` (proxy socket not listening
// yet, server still booting) are retried for this long before giving up
const TRANSIENT_WINDOW_MS = Number(process.env.NEXUS_WARMUP_TRANSIENT_MS ?? 180_000)
// el servidor limita el nombre de usuario a 14 caracteres (config.xml maxUserNameLength)
const USER = `warmup-${String(Date.now()).slice(-6)}`

// con Bolt las partidas IA vs IA terminan rápido (2-3 turnos): un mazo sin
// win-con correría 60+ turnos y su torrente de GAME_UPDATEs inundaría la cola
// de callbacks de la siguiente sesión (WATCHGAME perdido silenciosamente).
// El mazo está ORDENADO (con skipInitShuffling) para que sea determinista.
const DEFAULT_DECK = {
  name: 'Mage Web starter',
  cards: [
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 4 },
    { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
    { cardName: 'Island', setCode: 'LEA', cardNumber: '288', amount: 20 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 12 },
  ],
  sideboard: [],
}

async function cleanup(tableId, gameId) {
  if (!tableId && !gameId) return
  const c = await wsConn(WS_URL).catch(() => null)
  if (!c) return
  try {
    const res = await c.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER, password: 'x' })
    if (!res.ok) return
    if (gameId) {
      await c.call('quitMatch', { gameId }, 10000).catch(() => {})
    }
    if (tableId) {
      await c.call('removeTable', { tableId }, 10000).catch(() => {})
    }
  } catch {
    /* la limpieza nunca debe romper el warmup */
  } finally {
    c.close()
  }
}

/** Waits (polling connect) until the proxy has loaded its card DB.
 *  ERR_WARMING_UP is retried up to READY_TIMEOUT_MS. Any other failure (socket
 *  not open yet, timeout, connect error while the server finishes booting) is
 *  retried only within TRANSIENT_WINDOW_MS, so a real stack problem still fails
 *  fast instead of spinning for the whole cold-scan budget. */
async function waitProxyReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS
  const transientDeadline = Date.now() + TRANSIENT_WINDOW_MS
  for (;;) {
    let c = null
    let reason
    try {
      c = await wsConn(WS_URL)
      const res = await c.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER, password: 'x' })
      if (res.ok) return
      if (/still loading card data/i.test(res.error ?? '')) {
        reason = 'warming'
      } else {
        reason = `connect falló: ${res.error ?? res.errorCode ?? ''}`
      }
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e)
    } finally {
      c?.close()
    }
    if (Date.now() > deadline) {
      throw new Error(`el proxy no terminó de cargar la BD de cartas en ${READY_TIMEOUT_MS / 1000}s`)
    }
    if (reason === 'warming') {
      console.log(`  [warmup] proxy cargando BD de cartas (ERR_WARMING_UP) — reintento en ${READY_POLL_MS / 1000}s`)
    } else {
      if (Date.now() > transientDeadline) throw new Error(reason)
      console.log(`  [warmup] stack aún no listo (${reason}) — reintento en ${READY_POLL_MS / 1000}s`)
    }
    await new Promise((r) => setTimeout(r, READY_POLL_MS))
  }
}

async function runOnce() {
  const c = await wsConn(WS_URL)
  let tableId = null
  let gameId = null
  try {
    let res = await c.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER, password: 'x' })
    if (!res.ok) throw new Error(`connect falló: ${res.error ?? ''}`)

    res = await c.call('createTable', {
      name: `Warmup ${USER}`,
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Modern',
      winsNeeded: 1,
      playerTypes: ['COMPUTER_MAD', 'COMPUTER_MAD'],
      skipInitShuffling: true,
      skipStartingPlayerChoice: true,
    })
    tableId = res.ok ? res.data?.tableId ?? res.data?.table?.tableId : null
    if (!tableId) throw new Error(`createTable falló: ${res.error ?? ''}`)

    for (let i = 0; i < 2; i++) {
      res = await c.call('joinTable', {
        tableId,
        playerName: i === 0 ? 'Warmup CPU' : `Warmup CPU ${i + 1}`,
        playerType: 'COMPUTER_MAD',
        skill: 1,
        deck: DEFAULT_DECK,
      })
      if (!res.ok) throw new Error(`joinTable IA ${i + 1} falló: ${res.error ?? ''}`)
    }

    res = await c.call('startMatch', { tableId }, 20000)
    if (!res.ok) throw new Error(`startMatch falló: ${res.error ?? ''}`)

    res = await c.call('watchTable', { tableId })
    if (!res.ok) throw new Error(`watchTable falló: ${res.error ?? ''}`)

    // watchTable before the table is DUELING is dropped by the server (and the
    // XMage client still reports true): re-send it until WATCHGAME arrives
    let watch = null
    const watched = c.wait((m) => m.method === 'WATCHGAME', 30000, 'WATCHGAME')
    watched.then((e) => { watch = e }, () => {})
    const watchDeadline = Date.now() + 30000
    while (!watch && Date.now() < watchDeadline) {
      await new Promise((r) => setTimeout(r, 500))
      if (watch) break
      await c.call('watchTable', { tableId }).catch(() => {})
    }
    watch = await watched
    gameId = watch.objectId

    res = await c.call('watchGame', { gameId })
    if (!res.ok) throw new Error(`watchGame falló: ${res.error ?? ''}`)

    await c.wait((m) => m.method === 'GAME_INIT' && m.objectId === gameId, 30000, 'GAME_INIT')

    await c.call('quitMatch', { gameId }, 10000).catch(() => {})
    await c.call('removeTable', { tableId }, 10000).catch(() => {})
    return { ok: true, gameId }
  } catch (e) {
    c.close()
    await cleanup(tableId, gameId)
    throw e
  }
}

async function main() {
  try {
    await waitProxyReady()
  } catch (e) {
    console.log(`[warmup] FALLÓ esperando al proxy: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { gameId } = await runOnce()
      console.log(`[warmup] OK (intento ${attempt}): canal de callbacks operativo (GAME_INIT de ${String(gameId).slice(0, 8)}…)`)
      process.exit(0)
    } catch (e) {
      if (attempt === 1) console.log(`  [warmup] intento ${attempt} falló (${e.message}) — reintentando…`)
      else {
        console.log(`[warmup] FALLÓ: ${e.message}`)
        process.exit(1)
      }
    }
  }
}

await main().catch((e) => {
  console.log(`[warmup] FALLÓ: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
