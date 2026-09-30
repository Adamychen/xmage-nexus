#!/usr/bin/env node
// Limpia mesas y partidas huérfanas de un usuario E2E del servidor local
// (los tests de navegador dejan partidas IA corriendo que saturan el servidor,
// maxGameThreads=10). Se conecta como el propio usuario (el servidor exige
// ser el dueño de la mesa para removeTable) y elimina sus mesas.
// Uso: node scripts/clean-tables.mjs <username> [username...]
// Salida: exit 0 siempre que la limpieza se completara sin errores de red.

import { wsConn } from './lib.mjs'

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const users = process.argv.slice(2).filter((u) => u && u !== '--help')

if (users.length === 0) {
  console.error('Uso: node scripts/clean-tables.mjs <username> [username...]')
  process.exit(1)
}

async function cleanUser(username) {
  let conn = null
  let cleaned = 0
  try {
    conn = await wsConn(WS_URL, { name: username })
    let res = await conn.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username, password: 'x' })
    if (!res.ok) {
      console.log(`  [clean-tables] ${username}: connect falló (${res.error ?? ''})`)
      return 0
    }

    res = await conn.call('getTables', {})
    if (!res.ok || !Array.isArray(res.data)) {
      console.log(`  [clean-tables] ${username}: getTables falló (${res.error ?? ''})`)
      return 0
    }

    // controllerName es la lista "dueño, jugador1, jugador2": el dueño es el primero
    const mine = res.data.filter((t) => t && (typeof t.controllerName === 'string' && t.controllerName.split(',')[0].trim() === username || (typeof t.tableName === 'string' && t.tableName.startsWith(`${username}-`))))
    for (const table of mine) {
      const tableId = table.tableId
      if (!tableId) continue
      const games = Array.isArray(table.games) ? table.games : []
      for (const gameId of games) {
        await conn.call('quitMatch', { gameId }, 10000).catch(() => {})
      }
      await conn.call('removeTable', { tableId }, 10000).catch(() => {})
      cleaned++
    }
    if (cleaned > 0) console.log(`  [clean-tables] ${username}: ${cleaned} mesa(s) limpiada(s)`)
    return cleaned
  } catch (e) {
    console.log(`  [clean-tables] ${username}: ${e.message}`)
    return 0
  } finally {
    conn?.close()
  }
}

for (const username of users) {
  await cleanUser(username)
}
