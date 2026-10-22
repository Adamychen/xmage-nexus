#!/usr/bin/env node
// Cleans up orphan tables and matches of an E2E user on the local server
// (browser tests leave AI games running and saturate the server, maxGameThreads=10).
// Connects as the user itself (the server requires the table owner for removeTable)
// and removes their tables.
// Usage: node scripts/clean-tables.mjs <username> [username...]
// Exit code: 0 only if every user was cleaned; 1 if any failed.

import { disconnectConn, isTableOwnedBy, wsConn } from './lib.mjs'

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const users = process.argv.slice(2).filter((u) => u && u !== '--help')

if (users.length === 0) {
  console.error('usage: node scripts/clean-tables.mjs <username> [username...]')
  process.exit(1)
}

/** Cleans the user's tables. Throws if the connection or a query fails. */
async function cleanUser(username) {
  const conn = await wsConn(WS_URL, { name: username })
  try {
    let res = await conn.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username, password: 'x' })
    if (!res.ok) throw new Error(`connect failed (${res.error ?? ''})`)

    res = await conn.call('getTables', {})
    if (!res.ok || !Array.isArray(res.data)) throw new Error(`getTables failed (${res.error ?? ''})`)

    let cleaned = 0
    for (const table of res.data.filter((t) => isTableOwnedBy(t, username))) {
      const tableId = table.tableId
      if (!tableId) continue
      const games = Array.isArray(table.games) ? table.games : []
      for (const gameId of games) {
        await conn.call('quitMatch', { gameId }, 10000).catch(() => {})
      }
      await conn.call('removeTable', { tableId }, 10000).catch(() => {})
      cleaned++
    }
    if (cleaned > 0) console.log(`  [clean-tables] ${username}: ${cleaned} table(s) cleaned`)
    return cleaned
  } finally {
    await disconnectConn(conn)
  }
}

let failures = 0
for (const username of users) {
  try {
    await cleanUser(username)
  } catch (e) {
    failures++
    console.log(`  [clean-tables] ${username}: ${e.message}`)
  }
}
process.exitCode = failures ? 1 : 0
