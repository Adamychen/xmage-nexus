import type { FakeConn, Scenario } from '../fake'
import { makeTable } from '../fake'
import type { DraftClientMessage, SimpleCardView, SimpleCardsView } from '../../src/net/types'

const DRAFT_ID = 'draft-test-1'
const TABLE_ID = 'table-draft-1'
const GAME_ID = 'game-draft-1'

function makeCard(id: string, set: string, num: string, name: string): SimpleCardView {
  return { id, expansionSetCode: set, cardNumber: num, name }
}

function mapFromCards(cards: SimpleCardView[]): SimpleCardsView {
  const m: SimpleCardsView = {}
  for (const c of cards) m[c.id] = c
  return m
}

function makeBooster(startIdx: number, size = 14): SimpleCardView[] {
  const sets = ['M21', 'MH3', 'BLB', 'DSK', 'OTJ']
  const out: SimpleCardView[] = []
  for (let i = 0; i < size; i++) {
    const idx = startIdx + i
    const set = sets[idx % sets.length]
    const num = String((idx % 270) + 1)
    out.push(makeCard(`c-${idx}`, set, num, `Card ${idx}`))
  }
  return out
}

function draftView(boosterNum: number, cardNum: number): DraftClientMessage['draftView'] {
  return {
    setNames: ['Core Set 2021'],
    setCodes: ['M21'],
    boosterNum,
    cardNum,
    players: ['alice', 'bob', 'charlie', 'dave', 'eve', 'frank', 'grace', 'heidi'],
  }
}

export interface DraftScenarioOptions {
  boosterSize?: number
  timeout?: number
  totalPicksBeforeOver?: number
}

export function makeDraftScenario(opts: DraftScenarioOptions = {}): Scenario {
  const boosterSize = opts.boosterSize ?? 14
  const timeout = opts.timeout ?? 60
  const totalPicksBeforeOver = opts.totalPicksBeforeOver ?? 3

  let boosterNum = 1
  let cardNum = 1
  let boosterCards: SimpleCardView[] = makeBooster(1, boosterSize)
  let pickCards: SimpleCardView[] = []
  let picking = true
  let pickCount = 0
  let draftOver = false
  let constructSent = false
  let activeConn: FakeConn | null = null

  const draftTable = makeTable({
    tableId: TABLE_ID,
    tableName: 'draft-test',
    gameId: GAME_ID,
    gameType: 'Booster Draft',
    deckType: 'Limited',
  })
  draftTable.isTournament = true
  draftTable.limited = true
  draftTable.tableState = 'DRAFTING'
  draftTable.tableStateText = 'Drafting'

  function currentDraftMessage(): DraftClientMessage {
    return {
      draftView: draftView(boosterNum, cardNum),
      draftPickView: {
        booster: mapFromCards(boosterCards),
        picks: mapFromCards(pickCards),
        picking,
        timeout,
      },
    }
  }

  function broadcastDraft(method: string, msg: DraftClientMessage) {
    if (activeConn) activeConn.broadcast(method, msg, DRAFT_ID)
  }

  function broadcastConstruct() {
    if (!activeConn) return
    const pool: Record<string, SimpleCardView> = {}
    const allPicks = pickCards.length > 0 ? pickCards : boosterCards.slice(0, 5)
    const extra: SimpleCardView[] = []
    for (let i = 100; i < 130; i++) {
      extra.push(makeCard(`pool-${i}`, 'M21', String((i % 270) + 1), `Pool Card ${i}`))
    }
    const poolCards = [...allPicks, ...extra]
    for (const c of poolCards) {
      pool[c.id] = c
    }
    const deck: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(pool)) deck[k] = v
    activeConn.broadcast('CONSTRUCT', {
      deck: { name: 'Draft Pool', cards: deck, sideboard: {} },
      currentTableId: TABLE_ID,
      parentTableId: null,
      time: 600,
    }, TABLE_ID)
  }

  return {
    onConnect(conn) {
      activeConn = conn
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
      conn.lobby([draftTable])
      setTimeout(() => {
        if (!draftOver) {
          conn.broadcast('START_DRAFT', { currentTableId: TABLE_ID }, TABLE_ID)
          conn.broadcast('DRAFT_INIT', currentDraftMessage(), DRAFT_ID)
          setTimeout(() => {
            if (!picking) return
            conn.broadcast('DRAFT_PICK', currentDraftMessage(), DRAFT_ID)
          }, 100)
        }
      }, 150)
    },
    onAction(conn, action, args, requestId) {
      activeConn = conn
      const argStr = (k: string) => String((args as Record<string, unknown>)[k] ?? '')
      switch (action) {
        case 'connect':
          conn.ok(requestId, action, {})
          conn.lobby([draftTable])
          return
        case 'createTable':
        case 'createTournamentTable':
          conn.ok(requestId, action, { tableId: TABLE_ID })
          conn.lobby([draftTable])
          setTimeout(() => {
            conn.broadcast('DRAFT_INIT', currentDraftMessage(), DRAFT_ID)
            setTimeout(() => conn.broadcast('DRAFT_PICK', currentDraftMessage(), DRAFT_ID), 100)
          }, 100)
          return
        case 'joinTable':
        case 'joinTournamentTable':
          conn.ok(requestId, action, {})
          return
        case 'getGameTypes':
          conn.ok(requestId, action, [
            { name: 'Booster Draft', minPlayers: 2, maxPlayers: 8 },
            { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
            { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
          ])
          return
        case 'getDeckTypes':
          conn.ok(requestId, action, ['Limited', 'Constructed - Modern'])
          return
        case 'sendCardPick': {
          const cardId = argStr('cardId')
          conn.ok(requestId, action, {})
          const picked = boosterCards.find((c) => c.id === cardId) ?? boosterCards[0]
          if (!picked) {
            conn.broadcast('DRAFT_UPDATE', currentDraftMessage(), DRAFT_ID)
            return
          }
          pickCards.push(picked)
          boosterCards = boosterCards.filter((c) => c.id !== picked.id)
          pickCount++
          cardNum++
          if (pickCount >= totalPicksBeforeOver) {
            draftOver = true
            conn.broadcast('DRAFT_UPDATE', currentDraftMessage(), DRAFT_ID)
            setTimeout(() => {
              conn.broadcast('DRAFT_OVER', {}, DRAFT_ID)
              setTimeout(() => {
                if (!constructSent) {
                  constructSent = true
                  broadcastConstruct()
                }
              }, 150)
            }, 150)
          } else {
            if (boosterCards.length === 0) {
              boosterNum++
              cardNum = 1
              boosterCards = makeBooster(pickCount * 100, boosterSize - (pickCount % 3))
            }
            picking = true
            conn.broadcast('DRAFT_UPDATE', currentDraftMessage(), DRAFT_ID)
            setTimeout(() => conn.broadcast('DRAFT_PICK', currentDraftMessage(), DRAFT_ID), 80)
          }
          return
        }
        case 'sendCardMark': {
          conn.ok(requestId, action, {})
          return
        }
        case 'setBoosterLoaded': {
          conn.ok(requestId, action, true)
          return
        }
        case 'submitDeck': {
          conn.ok(requestId, action, {})
          setTimeout(() => {
            conn.broadcast('CONSTRUCT', { deck: { name: 'Submitted', cards: {}, sideboard: {} }, currentTableId: TABLE_ID, time: 0 }, TABLE_ID)
          }, 50)
          return
        }
        case 'quitDraft': {
          conn.ok(requestId, action, true)
          return
        }
        default:
          conn.ok(requestId, action, {})
          return
      }
    },
  }
}

export function draftScenario(): Scenario {
  return makeDraftScenario()
}
