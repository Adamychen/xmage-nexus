#!/usr/bin/env node
// Verifica rango de influencia y "atacar izquierda/derecha" (opciones de mesa
// multijugador reales) contra el stack local, sin navegador:
//   Fase A — FFA de 4 con `range: 'ONE'` + `attackOption: 'MULTIPLE'`: al
//     declarar un atacante con varios defensores legales, el GAME_TARGET
//     "Select a player, planeswalker, or battle to attack" solo ofrece a los
//     jugadores EN RANGO (los 2 vecinos del anillo de turnos); el jugador a
//     distancia 2 (el opuesto) NO aparece.
//   Fase B — FFA de 4 con `range: 'ALL'` + `attackOption: 'LEFT'`: solo hay un
//     defensor legal (el vecino de la izquierda), así que NO hay GAME_TARGET y
//     el ataque se asigna directo a ese vecino.
//   Fase C — igual con `attackOption: 'RIGHT'`: el defensor elegido es el OTRO
//     vecino — prueba diferencial de que la opción de ataque mueve el anillo.
//
// Nota de montaje: con 3 jugadores FFA no hay ningún opuesto fuera de rango
// (ambos rivales distan 1), así que el filtro de rango NO es observable; por
// eso las 3 fases usan FFA de 4. El motor lee `range`/`attackOption` de
// MatchOptions (MatchOptionsParser del proxy): `range` espera ONE/TWO/ALL
// (¡no 'RANGE_1'!) y `attackOption` MULTIPLE/LEFT/RIGHT.
//
// Los humanos solo juegan tierra + un Grizzly cheateado (testMode local) y
// atacan en su primer turno; el resto de prompts se auto-responden.
//
// Uso: node scripts/verify-range-attack.mjs
// Requiere: servidor local (testMode) + proxy (node scripts/ctl.mjs status).

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const STAMP = Date.now() % 100000
const DEBUG = process.env.RANGE_DEBUG === '1'
const ONLY_PHASE = process.env.ONLY_PHASE || ''

const SIM_DECK = {
  name: 'Mage Sim range lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '263', amount: 50 },
  ],
  sideboard: [],
}
const HUMAN_DECK = {
  name: 'Mage Web range rec',
  cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
  sideboard: [],
}

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Conexión WS + auto-respuesta de prompts. El estado de la fase
// (tierra/cheat/ataque/defensor) vive en `conn.st`.
function mkConn(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    const pending = new Map()
    const waiters = []
    const conn = {
      ws,
      name,
      view: null,
      gameId: null,
      st: {
        landPlayed: false,
        cheatSent: false,
        attackSent: false,
        targetSeen: false,
        candidates: [],
        defenderId: null,
        targetMsg: '',
        selectGen: 0,
      },
    }
    let rid = 0

    conn.call = (action, args, ms = 15000) =>
      new Promise((res) => {
        const id = `${name}-${++rid}`
        const timer = setTimeout(() => {
          pending.delete(id)
          res({ ok: false, error: 'timeout' })
        }, ms)
        pending.set(id, (m) => {
          clearTimeout(timer)
          res(m)
        })
        try {
          ws.send(JSON.stringify({ requestId: id, action, args }))
        } catch {
          clearTimeout(timer)
          pending.delete(id)
          res({ ok: false, error: 'send-fail' })
        }
      })

    conn.wait = (pred, ms, label) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout esperando ${label}`)), ms)
        waiters.push((m) => {
          if (pred(m)) {
            clearTimeout(timer)
            resolve(m)
            return true
          }
          return false
        })
      })

    conn.close = () => {
      try {
        ws.close()
      } catch {
        /* noop */
      }
    }

    const sendBool = (v) => ws.send(JSON.stringify({ action: 'sendPlayerBoolean', args: { gameId: conn.gameId, value: v } }))
    const sendUuid = (v) => ws.send(JSON.stringify({ action: 'sendPlayerUUID', args: { gameId: conn.gameId, value: v } }))

    function autoAnswer(m) {
      if (!conn.gameId) return
      const d = m.data ?? {}
      const q = String(d.message ?? d.question ?? '')
      const gv = m.data?.gameView ?? conn.view
      const me = (gv?.players ?? []).find((p) => p?.controlled)
      if (DEBUG) {
        const bf = Object.values(me?.battlefield ?? {}).map((c) => c?.name).join(',')
        console.log(
          `  debug ${m.method} t=${gv?.turn} ph=${gv?.phase} step=${gv?.step} act=${me?.isActive} prio=${me?.hasPriority}` +
            ` bf=[${bf}] land=${conn.st.landPlayed} cheat=${conn.st.cheatSent} atk=${conn.st.attackSent} q=${q.slice(0, 40)}`,
        )
      }
      if (m.method === 'GAME_ASK') {
        sendBool(false)
        return
      }
      if (m.method === 'GAME_TARGET') {
        const pt = d.options?.possibleTargets ?? d.targets ?? []
        const ids = Array.isArray(pt) ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean) : Object.keys(pt ?? {})
        if (/attack/i.test(q)) {
          // Defensor del ataque: registrar los candidatos reales y elegir el primero.
          conn.st.targetSeen = true
          conn.st.targetMsg = q
          conn.st.candidates = ids.slice()
          if (ids[0]) sendUuid(ids[0])
          return
        }
        if (/discard/i.test(q) && ids[0]) {
          sendUuid(ids[0])
          return
        }
        sendBool(false)
        return
      }
      if (m.method === 'GAME_SELECT') {
        const step = String(gv?.step ?? '')
        const phase = String(gv?.phase ?? '')
        const isMain = me?.isActive === true && /MAIN/.test(phase)
        conn.st.selectGen += 1
        if (isMain && !conn.st.landPlayed) {
          const land = Object.entries(gv?.myHand ?? gv?.hand ?? {}).find(([, c]) =>
            (c?.cardTypes ?? []).includes('LAND'),
          )
          if (land) {
            conn.st.landPlayed = true
            sendUuid(land[0])
            return
          }
        }
        if (isMain && conn.st.landPlayed && !conn.st.cheatSent && me?.playerId) {
          conn.st.cheatSent = true
          // P1 (rec-lib): el cheat corre fuera del hilo de juego y NO responde
          // al SELECT que lo disparó; si al terminar no ha llegado un SELECT
          // nuevo, hay que pasar el pendiente o la partida queda muda.
          const gen = conn.st.selectGen
          void conn
            .call(
              'cheatSetup',
              { gameId: conn.gameId, playerId: me.playerId, zones: { battlefield: ['Grizzly Bears'] } },
              15000,
            )
            .then((r) => {
              if (DEBUG) console.log(`  debug cheatSetup → ${JSON.stringify(r).slice(0, 120)}`)
              if (r?.ok && conn.st.selectGen === gen) sendBool(false)
            })
          return
        }
        const grizzly = Object.entries(me?.battlefield ?? {}).find(([, c]) => /grizzly bears/i.test(c?.name ?? ''))
        if (step === 'DECLARE_ATTACKERS' && me?.isActive === true && grizzly && !conn.st.attackSent) {
          conn.st.attackSent = true
          sendUuid(grizzly[0])
          return
        }
        sendBool(false)
        return
      }
      if (m.method === 'GAME_PLAY_MANA' || m.method === 'GAME_PLAY_XMANA') {
        sendBool(false)
        return
      }
    }

    ws.onopen = () => resolve(conn)
    ws.onerror = () => reject(new Error('no se pudo conectar al proxy'))
    ws.onmessage = (raw) => {
      let m
      try {
        m = JSON.parse(String(raw.data ?? raw))
      } catch {
        return
      }
      if (m.requestId && pending.has(m.requestId)) {
        pending.get(m.requestId)(m)
        pending.delete(m.requestId)
        return
      }
      if (m.requestId || m.type === 'lobby' || m.type === 'error') return
      if (m.objectId && (m.method === 'START_GAME' || m.method?.startsWith('GAME_')) && !conn.gameId) {
        conn.gameId = String(m.objectId)
      }
      if (m.data?.gameView) conn.view = m.data.gameView
      // Defensor declarado: grupo de combate con nuestro Grizzly atacando.
      const grizzlyId = Object.entries(
        ((conn.view?.players ?? []).find((p) => p?.controlled)?.battlefield ?? {}),
      ).find(([, c]) => /grizzly bears/i.test(c?.name ?? ''))?.[0]
      if (grizzlyId) {
        const group = (conn.view?.combat ?? []).find((g) =>
          Object.keys(g?.attackers ?? {}).includes(grizzlyId),
        )
        if (group?.defenderId) conn.st.defenderId = String(group.defenderId)
      }
      autoAnswer(m)
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i](m)) waiters.splice(i, 1)
      }
    }
  })
}

// Una fase = una mesa FFA de 4 con las opciones dadas + un ataque del humano.
async function runPhase({ label, range, attackOption }) {
  const USER = `rng${STAMP}${label}`.slice(0, 14)
  console.log(`[range-attack] fase ${label}: ${USER} — range=${range} attackOption=${attackOption}`)
  let conn = null
  let tableId = null
  const out = { ok: false, targetSeen: false, candidates: [], defenderId: null, players: [], meId: null }
  try {
    conn = await mkConn(USER)
    let res = await conn.call('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER, password: 'x' })
    if (!res.ok) {
      check(`[${label}] connect/login`, false, res.error ?? '')
      return out
    }

    res = await conn.call('createTable', {
      name: `range-${label}-${STAMP}`,
      gameType: 'Free For All',
      deckType: 'Constructed - Pioneer',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'SIM', 'SIM', 'SIM'],
      simDecks: [SIM_DECK, SIM_DECK, SIM_DECK],
      skipInitShuffling: true,
      skipStartingPlayerChoice: true,
      range,
      attackOption,
    })
    tableId = res.ok ? (res.data?.tableId ?? res.data?.table?.tableId ?? null) : null
    if (!check(`[${label}] createTable FFA 4 (range=${range}, attack=${attackOption})`, !!tableId, res.error ?? '')) {
      return out
    }

    res = await conn.call('joinTable', { tableId, playerName: USER, playerType: 'HUMAN', skill: 1, deck: HUMAN_DECK })
    if (!check(`[${label}] joinTable`, !!res.ok, res.error ?? '')) return out

    const startP = conn.wait((m) => m.method === 'START_GAME', 30000, 'START_GAME')
    res = await conn.call('startMatch', { tableId })
    if (!check(`[${label}] startMatch`, !!res.ok, res.error ?? '')) return out
    const start = await startP
    await conn.call('joinGame', { gameId: String(start.objectId) })

    // Esperar a que el ataque quede declarado y (si aplica) el defensor elegido.
    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      if (conn.st.targetSeen && conn.st.defenderId) break
      if (!conn.st.targetSeen && conn.st.defenderId && conn.st.attackSent) break
      if (conn.st.targetSeen && conn.st.candidates.length > 0 && conn.st.defenderId) break
      await sleep(500)
    }
    // Margen para que llegue el frame del combate resuelto.
    await sleep(1500)

    out.targetSeen = conn.st.targetSeen
    out.candidates = conn.st.candidates.slice()
    out.defenderId = conn.st.defenderId
    const players = conn.view?.players ?? []
    out.players = players.map((p) => ({ playerId: p.playerId, name: p.name, controlled: !!p.controlled }))
    out.meId = players.find((p) => p?.controlled)?.playerId ?? null
    out.ok = true
    console.log(
      `  nota [${label}]: ataque=${conn.st.attackSent ? 'sí' : 'no'} target=${conn.st.targetSeen ? `sí (${conn.st.candidates.length} candidatos)` : 'no'} defensor=${out.defenderId ? String(out.defenderId).slice(0, 8) : '—'}`,
    )
  } catch (e) {
    check(`[${label}] flujo`, false, e.message)
    out.ok = false
  } finally {
    if (conn) {
      if (conn.gameId) {
        try {
          await conn.call('quitMatch', { gameId: conn.gameId })
        } catch {
          /* noop */
        }
      }
      if (tableId) {
        try {
          await conn.call('removeTable', { tableId })
        } catch {
          /* noop */
        }
      }
      conn.close()
    }
  }
  return out
}

async function main() {
  // Fase A: rango ONE + MULTIPLE → el GAME_TARGET solo ofrece a los 2 vecinos.
  const A = ONLY_PHASE && ONLY_PHASE !== 'A' ? null : await runPhase({ label: 'A', range: 'ONE', attackOption: 'MULTIPLE' })
  if (!A) {
    console.log('[range-attack] fase A omitida (ONLY_PHASE)')
  } else if (A.ok && A.players.length === 4) {
    const idx = A.players.findIndex((p) => p.playerId === A.meId)
    const oppositeId = A.players[(idx + 2) % 4]?.playerId
    const neighborIds = A.players.filter((_, i) => i !== idx && i !== (idx + 2) % 4).map((p) => p.playerId)
    check(
      `[A range ONE] el GAME_TARGET del defensor ofrece exactamente 2 jugadores (no 3)`,
      A.targetSeen && A.candidates.length === 2,
      `candidatos=${A.candidates.length}`,
    )
    check(
      `[A range ONE] el opuesto (distancia 2) queda FUERA del rango`,
      !!oppositeId && !A.candidates.includes(oppositeId),
      `opuesto=${String(oppositeId).slice(0, 8)} candidatos=[${A.candidates.map((c) => String(c).slice(0, 8)).join(',')}]`,
    )
    check(
      `[A range ONE] los 2 vecinos SÍ están en el rango`,
      neighborIds.length === 2 && neighborIds.every((id) => A.candidates.includes(id)),
      `vecinos=[${neighborIds.map((c) => String(c).slice(0, 8)).join(',')}]`,
    )
    check(
      `[A range ONE] el ataque se declara contra un defensor en rango`,
      !!A.defenderId && A.candidates.includes(A.defenderId),
      `defensor=${String(A.defenderId).slice(0, 8)}`,
    )
  } else {
    check('[A range ONE] mesa y ataque completos', false, `ok=${A.ok} players=${A.players.length}`)
  }

  // Fase B: attackOption LEFT + range ALL → 1 defensor, sin GAME_TARGET.
  const B = ONLY_PHASE && ONLY_PHASE !== 'B' ? null : await runPhase({ label: 'B', range: 'ALL', attackOption: 'LEFT' })
  if (B) {
    check(
      `[B LEFT] sin GAME_TARGET (un único defensor legal)`,
      B.ok && B.targetSeen === false && !!B.defenderId,
      `target=${B.targetSeen} defensor=${String(B.defenderId).slice(0, 8)}`,
    )
  }

  // Fase C: attackOption RIGHT + range ALL → el OTRO vecino (diferencial).
  const C = ONLY_PHASE && ONLY_PHASE !== 'C' ? null : await runPhase({ label: 'C', range: 'ALL', attackOption: 'RIGHT' })
  if (C) {
    check(
      `[C RIGHT] sin GAME_TARGET y defensor distinto al de LEFT`,
      C.ok && C.targetSeen === false && !!C.defenderId && !!B && C.defenderId !== B.defenderId,
      `LEFT=${String(B?.defenderId).slice(0, 8)} RIGHT=${String(C.defenderId).slice(0, 8)}`,
    )
  }

  // Defensa extra: ambos vecinos y no el opuesto (si hay 4 jugadores en cada fase).
  for (const [tag, P] of [
    ['B LEFT', B],
    ['C RIGHT', C],
  ]) {
    if (!P || !P.ok || P.players.length !== 4 || !P.meId) continue
    const idx = P.players.findIndex((p) => p.playerId === P.meId)
    const neighborIds = P.players.filter((_, i) => i !== idx && i !== (idx + 2) % 4).map((p) => p.playerId)
    check(`[${tag}] el defensor es un vecino (no el opuesto)`, neighborIds.includes(P.defenderId), `defensor=${String(P.defenderId).slice(0, 8)}`)
  }

  console.log('')
  console.log(
    `[range-attack] evidencia: LEFT=${String(B?.defenderId).slice(0, 8)} RIGHT=${String(C?.defenderId).slice(0, 8)} rangeONE=[${(A?.candidates ?? []).map((c) => String(c).slice(0, 8)).join(',')}]`,
  )
  console.log(`[range-attack] RESULTADO: ${failCount === 0 ? 'TODO PASS' : `${failCount} FALLOS`} (${passCount} pass, ${failCount} fail)`)
  process.exit(failCount === 0 ? 0 : 1)
}

await main()
