#!/usr/bin/env node
// Driver de medición de la fuga de hilos de jboss-remoting: abre N sesiones
// concurrentes en el proxy (cada una con juego real HUMAN+SIM que genera
// callbacks), las mantiene vivas durante holdSec, y luego cierra todas para que
// quede idle. El conteo de hilos lo hace el orquestador con jcmd.
// Uso: node scripts/leak-measure.mjs [N] [holdSec]
import { wsConn } from './lib.mjs'

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const N = parseInt(process.argv[2] ?? '15', 10)
const HOLD_MS = (parseInt(process.argv[3] ?? '25', 10)) * 1000
const STAMP = Date.now() % 100000

const SIM_DECK = {
  name: 'Mage Sim leak lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '263', amount: 50 },
  ],
  sideboard: [],
}
const HUMAN_DECK = {
  name: 'Mage Web leak lands',
  cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
  sideboard: [],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sendBool = (conn, v) => conn.ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId: conn.gameId, value: v } }))
const sendUuid = (conn, v) => conn.ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId: conn.gameId, value: v } }))

function mkConn(name) {
  return wsConn(WS_URL, {
    name,
    gameIdOn: (m) => !!m.objectId && (m.method === 'START_GAME' || m.method === 'WATCHGAME' || m.method?.startsWith('GAME_')),
    autoAnswer: (conn, m) => {
      if (!conn.gameId) return
      const d = m.data ?? {}
      const q = String(d.message ?? d.question ?? '')
      if (m.method === 'GAME_ASK' || m.method === 'GAME_SELECT') { sendBool(conn, false); return }
      if (m.method === 'GAME_TARGET') {
        if (/discard/i.test(q)) {
          const pt = d.options?.possibleTargets ?? d.targets ?? []
          const id = Array.isArray(pt) ? (typeof pt[0] === 'string' ? pt[0] : pt[0]?.id) : Object.keys(pt)[0]
          if (id) { sendUuid(conn, id); return }
        }
        sendBool(conn, false); return
      }
      if (m.method === 'GAME_PLAY_MANA' || m.method === 'GAME_PLAY_XMANA') sendBool(conn, false)
    },
  })
}

async function main() {
  const conns = []
  const user = (i) => `lp${i}-${STAMP}`.slice(0, 14)
  for (let i = 1; i <= N; i++) {
    const conn = await mkConn(user(i))
    const res = await conn.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: user(i), password: 'x' })
    if (!res.ok) {
      console.error(`sesión ${i}: login falló — ${res.error ?? '?'}`)
      conn.close()
      continue
    }
    const resT = await conn.call('createTable', {
      name: `leak-${i}-${STAMP}`,
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Pioneer',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'SIM'],
      simDecks: [SIM_DECK],
      skipInitShuffling: true,
      skipStartingPlayerChoice: true,
    })
    const tableId = resT.ok ? (resT.data?.tableId ?? resT.data?.table?.tableId ?? null) : null
    if (!tableId) {
      console.error(`sesión ${i}: createTable falló — ${resT.error ?? '?'}`)
      conn.close()
      continue
    }
    await conn.call('joinTable', { tableId, playerName: user(i), playerType: 'HUMAN', skill: 1, deck: HUMAN_DECK })
    const startP = conn.wait((m) => m.method === 'START_GAME', 60000, 'START_GAME')
    const resM = await conn.call('startMatch', { tableId })
    if (!resM.ok) {
      console.error(`sesión ${i}: startMatch falló — ${resM.error ?? '?'}`)
      conn.close()
      continue
    }
    try {
      const start = await startP
      await conn.call('joinGame', { gameId: String(start.objectId) })
      conns.push(conn)
    } catch (e) {
      console.error(`sesión ${i}: ${e.message}`)
      conn.close()
    }
  }
  console.log(`SESIONES_VIVAS=${conns.length}`)
  await sleep(HOLD_MS)
  console.log('CERRANDO_SESIONES')
  for (const c of conns) {
    try { await c.call('disconnect', {}, 5000) } catch { /* noop */ }
    c.close()
  }
  console.log('HECHO')
}

main().catch((e) => { console.error(e); process.exit(1) })
