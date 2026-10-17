#!/usr/bin/env node
// Verifica qué devuelve el servidor real al recargar durante la construcción de
// un draft de dos humanos, sin navegador:
// host+guest login -> torneo Booster Draft (3 boosters M21, 2 HUMAN) -> join guest ->
// startTournament -> joinDraft x2 -> picks hasta CONSTRUCT en ambos ->
// el host "recarga" (cierra el socket) y vuelve a conectar de dos formas:
//   A) con el resume token del último frame (lo que hace la web al recargar)
//   B) sin resume (si el token se ha perdido)
// Imprime qué eventos llegan tras cada reconexión y si CONSTRUCT vuelve (info).
// PASS/FAIL cubre solo el protocolo (draft completo, login y reconexiones).
// Uso: node scripts/verify-draft-reload.mjs
// RECONNECTS=none|A|AB|ABC|LEAVE (default ABC) elige los pasos de reconexión; MATCH_WAIT_MS acota E.
// LEAVE: como A, pero antes de cerrar el socket envía `leaving` (lo que hace la web en
// pagehide), espera RELOAD_PAUSE_MS (default 60000) y luego reconecta con el resume token.
// Requiere: servidor local (testMode) + proxy + vite (node scripts/ctl.mjs status).

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = 'localhost'
const SERVER_PORT = 17171
const TAG = String(Date.now()).slice(-6)
const HOST_USER = `dh${TAG}`
const GUEST_USER = `dg${TAG}`
const PICK_LIMIT = 60
const RECONNECTS = (process.env.RECONNECTS ?? 'ABC').toUpperCase()
const RELOAD_PAUSE_MS = Number(process.env.RELOAD_PAUSE_MS ?? 60000)
if (!['NONE', 'A', 'AB', 'ABC', 'LEAVE'].includes(RECONNECTS)) {
  console.error(`RECONNECTS must be one of none|A|AB|ABC|LEAVE (got '${process.env.RECONNECTS}')`)
  process.exit(2)
}

let passCount = 0
let failCount = 0
const log = (msg) => console.log(msg)
function check(name, ok, detail = '') {
  if (ok) passCount++
  else failCount++
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${label} (${ms}ms)`)), ms))])

/** Cliente WS con buffer de eventos: cada evento se guarda, así ninguno se pierde
 *  entre dos esperas. `send` resuelve con el `result` de la misma acción. */
function makeClient(label) {
  const client = { label, ws: null, events: [], frames: [], pending: new Map(), lastSeq: null, streamId: null }
  client.open = () => new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    client.ws = ws
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error(`${label}: no se pudo conectar al proxy`))
    ws.onclose = () => {}
    ws.onmessage = (msg) => {
      let m
      try { m = JSON.parse(String(msg.data)) } catch { return }
      if (m.seq !== undefined) client.lastSeq = m.seq
      if (m.streamId) client.streamId = m.streamId
      if (m.type === 'result') {
        const list = client.pending.get(m.action) ?? []
        const res = list.shift()
        if (res) res(m)
        return
      }
      if (m.type === 'error') {
        log(`  nota [${label}]: error del proxy: ${m.message}`)
        return
      }
      client.frames.push(m)
      client.events.push(m)
    }
  })
  client.send = (action, args = {}) => {
    client.ws.send(JSON.stringify({ action, args }))
    return new Promise((resolve) => {
      const list = client.pending.get(action) ?? []
      list.push(resolve)
      client.pending.set(action, list)
    })
  }
  /** Espera el primer evento (ya recibido o futuro) que cumpla `pred`, sin consumirlo. */
  client.waitEvent = async (pred, ms, label2) => {
    const deadline = Date.now() + ms
    while (Date.now() < deadline) {
      const hit = client.events.find(pred)
      if (hit) return hit
      await sleep(100)
    }
    throw new Error(`${client.label}: timeout esperando ${label2}`)
  }
  client.close = () => { try { client.ws?.close() } catch { /* noop */ } }
  return client
}

async function connectAs(client, username, resume = null) {
  await client.open()
  const args = { host: SERVER_HOST, port: SERVER_PORT, username, password: 'x' }
  if (resume) args.resume = resume
  const res = await withTimeout(client.send('connect', args), 20000, `connect ${username}`)
  if (res.ok) {
    client.streamId = res.data?.streamId ?? client.streamId
    client.attached = res.data?.attached
    client.resumed = res.data?.resumed
    log(`  info [${client.label}]: connect attached=${client.attached} resumed=${client.resumed ?? '-'} streamId=${String(client.streamId).slice(0, 8)}…`)
  }
  return res
}

const DRAFT_TYPES = new Set(['DRAFT_INIT', 'DRAFT_PICK', 'DRAFT_UPDATE'])
const hasBooster = (m) => Object.keys(m.data?.draftPickView?.booster ?? {}).length > 0

/** Pick loop de un humano: elige la primera carta de cada pack hasta CONSTRUCT. */
async function pickUntilConstruct(client, draftId) {
  const consumed = new Set()
  let picks = 0
  while (picks < PICK_LIMIT) {
    const next = await client.waitEvent(
      (m) => (m.method === 'CONSTRUCT') || (DRAFT_TYPES.has(m.method) && hasBooster(m) && !consumed.has(m)),
      60000,
      'pick o CONSTRUCT',
    )
    if (next.method === 'CONSTRUCT') return { picks, construct: next }
    consumed.add(next)
    const cardId = Object.keys(next.data.draftPickView.booster)[0]
    const res = await client.send('sendCardPick', { draftId, cardId, hiddenCards: [] })
    if (!res.ok) log(`  nota [${client.label}]: sendCardPick: ${res.error ?? ''}`)
    picks++
  }
  throw new Error(`${client.label}: sin CONSTRUCT tras ${PICK_LIMIT} picks`)
}

/** Deck de `size` copias tomadas en orden del pool del CONSTRUCT. */
function buildDeck(pool, size) {
  const cards = []
  let total = 0
  for (const card of Object.values(pool)) {
    if (total >= size) break
    const amount = Math.min(Number(card.amount ?? 1), size - total)
    if (amount <= 0) continue
    const setCode = card.setCode ?? card.expansionSetCode
    const cardName = card.cardName ?? card.name ?? `${setCode} ${card.cardNumber}`
    cards.push({ cardName, setCode, cardNumber: card.cardNumber, amount })
    total += amount
  }
  return { deck: { name: 'verify-draft-reload', cards, sideboard: [] }, total }
}

async function main() {
  log(`[draft-reload] host=${HOST_USER} guest=${GUEST_USER}`)
  const host = makeClient('host')
  const guest = makeClient('guest')
  let tableId = null
  let reloaded = null
  const matchClients = []
  try {
    let res = await connectAs(host, HOST_USER)
    if (!check('login host', !!res.ok, `lastError='${res.error ?? ''}'`)) return

    res = await withTimeout(host.send('createTournamentTable', {
      name: `draft-rl-${TAG}`,
      tournamentType: 'Booster Draft Elimination (Random)',
      gameType: 'Two Player Duel',
      deckType: 'Limited',
      limited: true,
      limitedOptions: {
        numberBoosters: 3,
        constructionTime: 600,
        setCodes: ['M21', 'M21', 'M21'],
        sets: ['M21', 'M21', 'M21'],
        timing: 'REGULAR',
      },
      playerTypes: ['HUMAN', 'HUMAN'],
      password: '',
      watchingAllowed: true,
      spectatorsAllowed: true,
      winsNeeded: 1,
      quitRatio: 100,
    }), 20000, 'createTournamentTable')
    tableId = res.ok ? (res.data?.tableId ?? null) : null
    if (!check('createTournamentTable (draft, 2 HUMAN)', !!tableId, res.ok ? `tableId=${String(tableId).slice(0, 8)}…` : (res.error ?? ''))) return

    res = await withTimeout(host.send('joinTournamentTable', { tableId, playerName: HOST_USER, playerType: 'HUMAN', skill: 1 }), 20000, 'joinTournamentTable host')
    if (!check('host ocupa plaza 1 (HUMAN)', !!res.ok, res.error ?? '')) return

    await connectAs(guest, GUEST_USER)
    res = await withTimeout(guest.send('joinTournamentTable', { tableId, playerName: GUEST_USER, playerType: 'HUMAN', skill: 1 }), 20000, 'joinTournamentTable guest')
    if (!check('guest ocupa plaza 2 (HUMAN)', !!res.ok, res.error ?? '')) return

    res = await withTimeout(host.send('startTournament', { tableId }), 20000, 'startTournament')
    if (!check('startTournament', !!res.ok, res.error ?? '')) return

    const showP = host.waitEvent((m) => m.method === 'SHOW_TOURNAMENT', 20000, 'SHOW_TOURNAMENT').catch((e) => e)
    res = await withTimeout(host.send('watchTournamentTable', { tableId }), 15000, 'watchTournamentTable')
    const tournamentId = (await showP)?.objectId ?? null
    if (!check('SHOW_TOURNAMENT (tournamentId)', !!tournamentId, tournamentId ? String(tournamentId).slice(0, 8) + '…' : '')) return

    for (const c of [host, guest]) {
      res = await withTimeout(c.send('joinTournament', { tournamentId }), 20000, `joinTournament ${c.label}`)
      if (!check(`joinTournament ${c.label}`, !!res.ok, res.error ?? '')) return
    }

    const startH = await host.waitEvent((m) => m.method === 'START_DRAFT', 60000, 'START_DRAFT (host)').catch((e) => e)
    const startG = await guest.waitEvent((m) => m.method === 'START_DRAFT', 60000, 'START_DRAFT (guest)').catch((e) => e)
    if (!check('START_DRAFT a ambos', startH?.objectId && startG?.objectId, `draftId=${String(startH?.objectId ?? '').slice(0, 8)}…`)) return
    const draftId = startH.objectId

    for (const c of [host, guest]) {
      res = await withTimeout(c.send('joinDraft', { draftId }), 15000, `joinDraft ${c.label}`)
      if (!res.ok) log(`  nota [${c.label}]: joinDraft: ${res.error ?? ''}`)
    }

    const [pickH, pickG] = await Promise.all([pickUntilConstruct(host, draftId), pickUntilConstruct(guest, draftId)])
    check('host recibe CONSTRUCT', !!pickH.construct, `${pickH.picks} picks`)
    check('guest recibe CONSTRUCT', !!pickG.construct, `${pickG.picks} picks`)
    if (!pickH.construct) return

    const constructBefore = pickH.construct
    const lastSeqBefore = host.lastSeq
    const streamBefore = host.streamId
    log(`  info: último seq antes del reload=${lastSeqBefore}, streamId=${streamBefore ? String(streamBefore).slice(0, 8) + '…' : 'ninguno'}`)
    log(`  info: CONSTRUCT data keys=${Object.keys(constructBefore.data ?? {}).join(',')}`)

    // RECONNECTS=none|A|AB|ABC (cumulative). `c` is the client that carries on to D/E.
    let c = host
    if (RECONNECTS !== 'NONE') {
      // Reload: cierre abrupto del socket (code 1001), sin `disconnect`.
      let pauseMs = 2000
      if (RECONNECTS === 'LEAVE') {
        // La web envía `leaving` en pagehide (fire-and-forget, sin `result`).
        host.ws.send(JSON.stringify({ action: 'leaving', args: {} }))
        pauseMs = RELOAD_PAUSE_MS
        log(`  info: LEAVE enviado; pausa de recarga ${pauseMs} ms`)
      }
      host.close()
      await sleep(pauseMs)

      // A) Reload con resume token del último frame (lo que hace la web).
      const a = makeClient('host-A')
      const resumeArg = streamBefore && lastSeqBefore !== null ? { streamId: streamBefore, seq: lastSeqBefore } : null
      res = await connectAs(a, HOST_USER, resumeArg)
      check('reconexión A (resume) login', !!res.ok, res.error ?? '')
      await sleep(15000)
      const aConstruct = a.events.find((m) => m.method === 'CONSTRUCT')
      const aMethods = [...new Set(a.events.map((m) => m.method ?? m.type))]
      log(`  info: A recibió ${a.events.length} eventos: ${aMethods.join(', ') || '(ninguno)'}`)
      log(`  info: A CONSTRUCT tras recargar con resume: ${aConstruct ? 'llegó' : 'NO llegó'}`)
      c = a
    }

    if (RECONNECTS === 'AB' || RECONNECTS === 'ABC') {
      // B) Reload sin resume (el token se ha perdido).
      c.close()
      await sleep(2000)
      const b = makeClient('host-B')
      res = await connectAs(b, HOST_USER, null)
      check('reconexión B (sin resume) login', !!res.ok, res.error ?? '')
      await sleep(15000)
      const bConstruct = b.events.find((m) => m.method === 'CONSTRUCT')
      const bMethods = [...new Set(b.events.map((m) => m.method ?? m.type))]
      log(`  info: B recibió ${b.events.length} eventos: ${bMethods.join(', ') || '(ninguno)'}`)
      log(`  info: B CONSTRUCT tras recargar sin resume: ${bConstruct ? 'llegó' : 'NO llegó'}`)
      c = b
    }

    if (RECONNECTS === 'ABC') {
      // C) La sesión expira sin `disconnect` (el socket se cae y el proxy espera el
      // periodo de gracia de 180 s) y luego login nuevo. Un `disconnect` explícito
      // NO sirve aquí: el servidor retira al jugador del torneo y la mesa termina.
      c.close()
      await sleep(200000)
      const cc = makeClient('host-C')
      res = await connectAs(cc, HOST_USER, null)
      check('reconexión C (sesión nueva) login', !!res.ok, res.error ?? '')
      await sleep(15000)
      const cConstruct = cc.events.find((m) => m.method === 'CONSTRUCT')
      log(`  info: C recibió ${cc.events.length} eventos: ${[...new Set(cc.events.map((m) => m.method ?? m.type))].join(', ') || '(ninguno)'}`)
      log(`  info: C CONSTRUCT tras login nuevo: ${cConstruct ? 'llegó' : 'NO llegó'}`)
      c = cc
    }
    reloaded = RECONNECTS === 'NONE' ? null : c

    // D) submitDeck tras reconectar: el host (sesión C) y el invitado (control, nunca recargó).
    const pool = { ...(constructBefore.data?.deck?.sideboard ?? {}), ...(constructBefore.data?.deck?.cards ?? {}) }
    const poolCards = Object.values(pool)
    log(`  info: pool=${poolCards.length} entradas; primera=${JSON.stringify(poolCards[0]).slice(0, 300)}`)
    const { deck, total } = buildDeck(pool, 40)
    log(`  info: deck construido con ${total} cartas (${deck.cards.length} entradas distintas), sideboard=[]`)
    const val = await withTimeout(c.send('validateDeck', { deck }), 15000, 'validateDeck').catch((e) => ({ ok: false, error: e.message }))
    log(`  info: validateDeck ok=${val.ok} data=${JSON.stringify(val.data ?? val.error ?? '').slice(0, 300)}`)
    const mark = { host: c.events.length, guest: guest.events.length }
    const submitAt = Date.now()
    log(`  info: lobby del host justo antes de submit: tablas=${c.events.filter((m) => m.type === 'lobby').slice(-1)[0]?.tables?.length ?? '-'}; mesa en lobby=${c.events.filter((m) => m.type === 'lobby').slice(-1)[0]?.tables?.some((t) => t.tableId === tableId) ?? '-'}`)
    const [subH, subG] = await Promise.all([
      withTimeout(c.send('submitDeck', { tableId, deck }), 20000, 'submitDeck host').catch((e) => ({ ok: false, error: e.message })),
      withTimeout(guest.send('submitDeck', { tableId, deck }), 20000, 'submitDeck guest').catch((e) => ({ ok: false, error: e.message })),
    ])
    log(`  info: submitDeck host: ok=${subH.ok} error='${subH.error ?? ''}' errorCode=${subH.errorCode ?? '-'}`)
    log(`  info: submitDeck guest: ok=${subG.ok} error='${subG.error ?? ''}' errorCode=${subG.errorCode ?? '-'}`)
    await sleep(20000)
    for (const [label, cl, from] of [['host', c, mark.host], ['guest', guest, mark.guest]]) {
      const after = cl.events.slice(from)
      log(`  info: ${label} tras submitDeck recibió ${after.length} eventos: ${[...new Set(after.map((m) => m.method ?? m.type))].join(', ') || '(ninguno)'}`)
    }
    check('submitDeck host (after reload)', !!subH.ok, subH.ok ? `${total} cartas` : `${subH.error ?? ''} (errorCode=${subH.errorCode ?? '-'})`)
    check('submitDeck guest (control)', !!subG.ok, subG.ok ? `${total} cartas` : `${subG.error ?? ''} (errorCode=${subG.errorCode ?? '-'})`)

    // E) ¿Arranca el match tras submitDeck? Sondeo hasta MATCH_WAIT_MS (5 min por defecto)
    // desde el submit, registrando el primer evento de cada método por cliente.
    const WAIT_MS = Number(process.env.MATCH_WAIT_MS ?? 300000)
    const who = { host: c, guest }
    const cursor = { host: mark.host, guest: mark.guest }
    const seen = { host: new Map(), guest: new Map() }
    const started = { host: null, guest: null }
    const elapsed = () => `+${Math.round((Date.now() - submitAt) / 1000)}s`
    const scanNew = (label) => {
      const cl = who[label]
      for (const m of cl.events.slice(cursor[label])) {
        const key = m.method ?? m.type
        if (!seen[label].has(key)) {
          seen[label].set(key, elapsed())
          const extra = m.errorCode ? ` errorCode=${m.errorCode}` : ''
          const msg = m.message ?? m.data?.message ?? ''
          log(`  info [${label}] ${elapsed()}: primer ${key}${extra}${msg ? ` msg='${String(msg).slice(0, 200)}'` : ''}`)
        }
        if (!started[label] && m.method === 'START_GAME') {
          started[label] = { gameId: m.data?.gameId ?? m.objectId, tableName: m.data?.tableName ?? '' }
          log(`  info [${label}] ${elapsed()}: START_GAME gameId=${String(started[label].gameId).slice(0, 8)}… table='${started[label].tableName}'`)
        }
      }
      cursor[label] = cl.events.length
    }
    const lobbyState = () => {
      const lobbies = c.events.filter((m) => m.type === 'lobby')
      const last = lobbies[lobbies.length - 1]
      const row = last?.tables?.find((t) => t.tableId === tableId)
      if (row) return `${row.tableState}${row.tableStateText ? ` (${row.tableStateText})` : ''}`
      if (!last) return 'sin lobby'
      if (!Array.isArray(last.tables)) return `lobby sin array tables (keys=${Object.keys(last).join(',')}) ${JSON.stringify(last).slice(0, 400)}`
      const ids = (last.tables ?? []).map((t) => `${String(t.tableId).slice(0, 8)}:${t.tableState}`).join(', ')
      return `mesa ausente en lobby (${last.tables?.length ?? 0} mesas: ${ids.slice(0, 300)})`
    }
    let prevLobby = null
    const deadline = submitAt + WAIT_MS
    while (Date.now() < deadline && !(started.host && started.guest)) {
      await sleep(2000)
      scanNew('host')
      scanNew('guest')
      const state = lobbyState()
      if (state !== prevLobby) {
        log(`  info ${elapsed()}: lobby tableState=${state}`)
        prevLobby = state
      }
    }
    scanNew('host')
    scanNew('guest')
    log(`  info: métodos host tras submit: ${[...seen.host.keys()].join(', ') || '(ninguno)'}`)
    log(`  info: métodos guest tras submit: ${[...seen.guest.keys()].join(', ') || '(ninguno)'}`)
    log(`  info: lobby final: ${lobbyState()}`)
    const noMatch = (label) => `sin START_GAME en ${WAIT_MS / 1000}s; métodos=[${[...seen[label].keys()].join(', ')}]; lobby=${lobbyState()}`
    check('match starts after submit (host)', !!started.host, started.host ? `gameId=${String(started.host.gameId).slice(0, 8)}…` : noMatch('host'))
    check('match starts after submit (guest)', !!started.guest, started.guest ? `gameId=${String(started.guest.gameId).slice(0, 8)}…` : noMatch('guest'))
    for (const label of ['host', 'guest']) {
      if (started[label]) matchClients.push(who[label])
    }

    // F) Solo si el match arrancó sin GAME_INIT: un único joinGame por cliente (check aparte).
    for (const label of ['host', 'guest']) {
      if (!started[label]) continue
      const gameInit = () => who[label].events.some((m) => m.method === 'GAME_INIT')
      await sleep(10000)
      scanNew(label)
      if (gameInit()) {
        log(`  info [${label}]: GAME_INIT llegó sin joinGame`)
        continue
      }
      res = await withTimeout(who[label].send('joinGame', { gameId: started[label].gameId }), 15000, `joinGame ${label}`).catch((e) => ({ ok: false, error: e.message }))
      log(`  info [${label}]: joinGame ok=${res.ok} error='${res.error ?? ''}' errorCode=${res.errorCode ?? '-'}`)
      await sleep(15000)
      scanNew(label)
      check(`GAME_INIT after joinGame (${label})`, gameInit(), gameInit() ? '' : `joinGame ok=${res.ok}; métodos=[${[...seen[label].keys()].join(', ')}]`)
    }
  } catch (e) {
    check('flujo global', false, e.message)
  } finally {
    for (const mc of matchClients) {
      try { await withTimeout(mc.send('quitMatch', { tableId }), 10000, 'quitMatch') } catch { /* noop */ }
    }
    const cleanup = reloaded ?? host
    if (tableId) {
      try { await withTimeout(cleanup.send('removeTable', { tableId }), 10000, 'removeTable') } catch { /* noop */ }
    }
    for (const c of [reloaded, host, guest]) {
      try { await withTimeout(c?.send('disconnect', {}), 5000, 'disconnect') } catch { /* noop */ }
      c?.close()
    }
  }

  log('')
  log(`[draft-reload] RESULTADO: ${failCount === 0 ? 'TODO PASS' : `${failCount} FALLOS`} (${passCount} pass, ${failCount} fail)`)
  process.exit(failCount === 0 ? 0 : 1)
}

await main()
