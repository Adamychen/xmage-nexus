#!/usr/bin/env node
// Verifica el modo multi-tenant del proxy: varias conexiones WS contra un mismo
// proxy deben ser sesiones XMage independientes (aisladas), salvo que usen la
// MISMA cuenta (host|username), en cuyo caso se adjuntan a la sesión existente.
// Uso: node scripts/multi-tenant-test.mjs

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171

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

function makeClient(username) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    const pending = new Map()
    let connectedEvent = false
    ws.onmessage = (msg) => {
      let m
      try {
        m = JSON.parse(String(msg.data))
      } catch {
        return
      }
      if (m.type === 'connected') connectedEvent = true
      if (m.type === 'result') {
        const list = pending.get(m.action) || []
        const r = list.shift()
        if (r) r(m)
      }
    }
    ws.onopen = () => resolve(client)
    ws.onerror = () => reject(new Error(`ws error para ${username}`))
    const send = (action, args) => {
      ws.send(JSON.stringify({ action, args }))
      return new Promise((res) => {
        const list = pending.get(action) || []
        list.push(res)
        pending.set(action, list)
      })
    }
    const waitConnected = (ms = 10000) =>
      new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('no llegó connected')), ms)
        const i = setInterval(() => {
          if (connectedEvent) {
            clearTimeout(t)
            clearInterval(i)
            res()
          }
        }, 50)
      })
    const getSessionId = async () => {
      const r = await send('getServerInfo', {})
      return r && r.ok ? r.data.sessionId : null
    }
    const close = () => ws.close()
    const client = { ws, send, waitConnected, getSessionId, close, username, get connected() { return connectedEvent } }
  })
}

async function connect(client) {
  const res = await client.send('connect', {
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: client.username,
    password: 'x',
  })
  if (!res.ok) throw new Error(`connect falló para ${client.username}: ${res.error}`)
}

async function main() {
  console.log(`[multi-tenant] contra ${WS_URL} (server ${SERVER_HOST}:${SERVER_PORT})`)

  // --- Aislamiento: dos cuentas distintas => dos sesiones distintas ---
  let seq = 0
  const aName = 'mta' + ++seq
  const bName = 'mtb' + ++seq
  const A = await makeClient(aName)
  const B = await makeClient(bName)
  await connect(A)
  check('A conecta', true)
  await connect(B)
  check('B conecta', true)

  const sa = await A.getSessionId()
  const sb = await B.getSessionId()
  check('A y B tienen sessionId distintos (aislamiento)', !!sa && !!sb && sa !== sb, `${sa} vs ${sb}`)
  // cada uno ve SU sesión vía getServerInfo (no la del otro)
  const sa2 = await A.getSessionId()
  check('A sigue viendo su propia sesión', sa2 === sa)

  A.close()
  B.close()

  // --- Adjunte: misma cuenta => se comparte la sesión ---
  const sameName = 'mts' + ++seq
  const C1 = await makeClient(sameName)
  await connect(C1)
  const sc1 = await C1.getSessionId()
  check('C1 conecta', !!sc1)

  const C2 = await makeClient(sameName) // mismo username
  await connect(C2)
  const sc2 = await C2.getSessionId()
  check('C2 se adjunta a la sesión de C1 (mismo sessionId)', !!sc2 && sc1 === sc2, `${sc1} vs ${sc2}`)

  C1.close()
  C2.close()

  console.log(`\n[multi-tenant] ${passCount} pass, ${failCount} fail`)
  process.exit(failCount === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('[multi-tenant] error:', e.message)
  process.exit(1)
})
