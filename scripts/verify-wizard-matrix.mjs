// Oráculo real de la matriz del wizard (Fase 3 de la auditoría).
// Recorre las clases VÁLIDAS de tableKind contra el servidor local:
// create + joins propios del submit + removeTable. Las clases `invalid`
// se verifican a nivel unit (tableKind.test.ts), no contra el servidor.
//
// Uso: node scripts/verify-wizard-matrix.mjs

const WS_URL = 'ws://127.0.0.1:8787'
const SERVER_HOST = process.env.E2E_SERVER_HOST || 'localhost'
const SERVER_PORT = Number(process.env.E2E_SERVER_PORT || '17171')
const USER = `wm${Date.now() % 10000}`

const MOUNTAIN_DECK = {
  name: 'Matrix 60 Mountains',
  cards: [{ cardName: 'Mountain', setCode: 'm21', cardNumber: '274', amount: 60 }],
  sideboard: [],
}

const ws = new WebSocket(WS_URL)
const pending = new Map()
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
  }
}
const send = (action, args, ms = 25000) =>
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
    ws.send(JSON.stringify({ action, args }))
  })

let failures = 0
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures++
}
const errOf = (r) => JSON.stringify(r).slice(0, 220)

await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = () => rej(new Error('no proxy'))
})
check(
  'connect',
  (await send('connect', { host: SERVER_HOST, port: SERVER_PORT, username: USER, password: 'x' })).ok,
)

const tables = []
async function cleanup() {
  for (const tableId of tables) {
    try {
      await send('removeTable', { tableId })
    } catch {}
  }
}

// A. match duelo 1v1 HUMAN+SIM (buildCreateMatchArgs)
{
  const c = await send('createTable', {
    name: `matrix-duel-${Date.now()}`,
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Modern',
    winsNeeded: 1,
    playerTypes: ['HUMAN', 'SIM'],
    simDecks: [MOUNTAIN_DECK],
  })
  check('A create match duel', c.ok, c.ok ? '' : errOf(c))
  const tableId = c.ok ? (c.data?.tableId ?? c.data?.table?.tableId) : null
  if (tableId) {
    tables.push(tableId)
    const j = await send('joinTable', {
      tableId,
      playerName: USER,
      playerType: 'HUMAN',
      skill: 1,
      deck: MOUNTAIN_DECK,
      deckType: 'Constructed - Modern',
      gameType: 'Two Player Duel',
    })
    check('A join humano con mazo', j.ok, j.ok ? '' : errOf(j))
  } else failures++
}

// B. torneo construido Swiss + MAD con mazo (joinAi construido)
{
  const c = await send('createTournamentTable', {
    name: `matrix-swiss-${Date.now()}`,
    tournamentType: 'Constructed Swiss',
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Modern',
    limited: false,
    playerTypes: ['HUMAN', 'COMPUTER_MAD'],
    winsNeeded: 2,
  })
  check('B create Constructed Swiss', c.ok, c.ok ? '' : errOf(c))
  const tableId = c.ok ? (c.data?.tableId ?? c.data?.table?.tableId) : null
  if (tableId) {
    tables.push(tableId)
    const bot = await send('joinTournamentTable', {
      tableId,
      playerName: 'Computer',
      playerType: 'COMPUTER_MAD',
      skill: 1,
      deck: MOUNTAIN_DECK,
      deckType: 'Constructed - Modern',
      gameType: 'Two Player Duel',
    })
    check('B join MAD con mazo', bot.ok, bot.ok ? '' : errOf(bot))
    const human = await send('joinTournamentTable', {
      tableId,
      playerName: USER,
      playerType: 'HUMAN',
      skill: 1,
      deck: MOUNTAIN_DECK,
      deckType: 'Constructed - Modern',
      gameType: 'Two Player Duel',
    })
    check('B join humano con mazo', human.ok, human.ok ? '' : errOf(human))
  } else failures++
}

// C. draft Booster Draft Elimination + draftbot deckless (flujo del usuario)
{
  const c = await send('createTournamentTable', {
    name: `matrix-draft-${Date.now()}`,
    tournamentType: 'Booster Draft Elimination',
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
    playerTypes: ['HUMAN', 'COMPUTER_DRAFT_BOT'],
    winsNeeded: 1,
  })
  check('C create Booster Draft Elimination', c.ok, c.ok ? '' : errOf(c))
  const tableId = c.ok ? (c.data?.tableId ?? c.data?.table?.tableId) : null
  if (tableId) {
    tables.push(tableId)
    const bot = await send('joinTournamentTable', {
      tableId,
      playerName: 'Computer',
      playerType: 'COMPUTER_DRAFT_BOT',
      skill: 2,
    })
    check('C join draftbot deckless', bot.ok, bot.ok ? '' : errOf(bot))
    const human = await send('joinTournamentTable', {
      tableId,
      playerName: USER,
      playerType: 'HUMAN',
      skill: 1,
    })
    check('C join humano deckless', human.ok, human.ok ? '' : errOf(human))
  } else failures++
}

// D. sealed (misma ruta limited, sin timing)
{
  const c = await send('createTournamentTable', {
    name: `matrix-sealed-${Date.now()}`,
    tournamentType: 'Sealed Elimination',
    gameType: 'Two Player Duel',
    deckType: 'Limited',
    limited: true,
    limitedOptions: { numberBoosters: 6, constructionTime: 900, setCodes: ['M21', 'M21', 'M21', 'M21', 'M21', 'M21'], sets: ['M21', 'M21', 'M21', 'M21', 'M21', 'M21'] },
    playerTypes: ['HUMAN'],
    winsNeeded: 1,
  })
  check('D create Sealed Elimination', c.ok, c.ok ? '' : errOf(c))
  const tableId = c.ok ? (c.data?.tableId ?? c.data?.table?.tableId) : null
  if (tableId) {
    tables.push(tableId)
    const human = await send('joinTournamentTable', {
      tableId,
      playerName: USER,
      playerType: 'HUMAN',
      skill: 1,
    })
    check('D join humano deckless', human.ok, human.ok ? '' : errOf(human))
  } else failures++
}

await cleanup()
console.log(failures === 0 ? 'MATRIZ OK' : `MATRIZ CON ${failures} FALLOS`)
ws.close()
process.exit(failures ? 1 : 0)
