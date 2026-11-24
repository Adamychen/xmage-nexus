import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import type { Scenario } from '../fake'
import type { FakeConn } from '../fake'
import type { CardView, GameView, PlayerView } from '../../src/net/types'
import { makeCard } from '../../src/__fixtures__/gameViews'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

export type ArenaSurveilVariant = 'surveil' | 'scry' | 'foreign'

export const SURVEIL_PICK = 'Select card(s) to PUT into your GRAVEYARD (Surveil)'
export const SCRY_PICK = 'Select up to 4 cards to PUT on the BOTTOM of your library (Scry)'
export const TOP_ORDER = 'Select a card ORDER to put on the TOP of your library (last one chosen will be topmost)'
export const BOTTOM_ORDER = 'Select a card ORDER to put on the BOTTOM of your library (last one chosen will be bottommost)'
export const FOREIGN_TARGET = 'Select a card to exile'

export const ARENA_CARDS = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Llanowar Elves' },
  { id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'Lightning Bolt' },
  { id: 'aaaaaaaa-0000-0000-0000-000000000003', name: 'Counterspell' },
  { id: 'aaaaaaaa-0000-0000-0000-000000000004', name: 'Dark Ritual' },
] as const

export const FOREIGN_CARD = { id: 'bbbbbbbb-0000-0000-0000-000000000001', name: 'Grizzly Bears' } as const

export const ARENA_SURVEIL_ANSWERS: (string | boolean)[] = []
export const ARENA_SURVEIL_ANSWERED: string[] = []
export const ARENA_SURVEIL_SENT: string[] = []

type Stage =
  | { kind: 'pick'; chosen: string[] }
  | { kind: 'order'; message: string; offered: string[] }
  | { kind: 'foreign' }
  | { kind: 'done' }

function cardsView(ids: string[]): Record<string, CardView> {
  const byId = new Map<string, string>([...ARENA_CARDS, FOREIGN_CARD].map((c) => [c.id, c.name]))
  return Object.fromEntries(ids.map((id) => [id, makeCard({ id, name: byId.get(id) ?? id, cardTypes: ['Instant'] as CardView['cardTypes'] })]))
}

export function arenaSurveilScenario(variant: ArenaSurveilVariant): Scenario {
  const gameId = GAME_ID
  const tableId = TABLE_ID
  const scry = variant === 'scry'
  const cards = ARENA_CARDS.slice(0, scry ? 4 : 3).map((c) => c.id as string)
  const pickMessage = scry ? SCRY_PICK : SURVEIL_PICK
  let activeConn: FakeConn | null = null
  let stage: Stage = { kind: 'pick', chosen: [] }
  let queue: { message: string; ids: string[] }[] = []

  const human: PlayerView = {
    playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, life: 20, controlled: true,
    isHuman: true, hasPriority: true, isActive: true, handCount: 0, libraryCount: 40, battlefield: {},
  } as unknown as PlayerView
  const sim: PlayerView = {
    playerId: SIM_PLAYER_ID, name: SIM_NAME, life: 20, controlled: false,
    isHuman: false, hasPriority: false, isActive: false, handCount: 0, libraryCount: 40, battlefield: {},
  } as unknown as PlayerView
  const getGameView = (): GameView => ({
    turn: 1, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID, priorityPlayerId: HUMAN_PLAYER_ID,
    players: [human, sim], myHand: {}, canPlayObjects: { objects: {} },
  } as unknown as GameView)

  const emitTarget = (message: string, ids: string[], chosen: string[], max: number) => {
    ARENA_SURVEIL_SENT.push(message)
    activeConn?.broadcast('GAME_TARGET', {
      message,
      targets: ids,
      cardsView1: cardsView(ids),
      flag: false,
      min: 0,
      max,
      options: { possibleTargets: ids, chosenTargets: chosen },
      gameView: getGameView(),
    }, gameId)
  }

  const emitStage = () => {
    if (stage.kind === 'pick') emitTarget(pickMessage, cards, stage.chosen, cards.length)
    else if (stage.kind === 'order') emitTarget(stage.message, stage.offered, [], 1)
    else if (stage.kind === 'foreign') emitTarget(FOREIGN_TARGET, [FOREIGN_CARD.id], [], 1)
  }

  const finish = () => {
    stage = { kind: 'done' }
    activeConn?.broadcast('GAME_UPDATE', { gameView: getGameView() }, gameId)
    activeConn?.broadcast('GAME_SELECT', { message: 'Priority', gameView: getGameView() }, gameId)
  }

  const advance = () => {
    const next = queue.shift()
    if (next) {
      stage = { kind: 'order', message: next.message, offered: next.ids }
      setTimeout(emitStage, 60)
    } else {
      finish()
    }
  }

  const afterPick = (chosen: string[]) => {
    const rest = cards.filter((id) => !chosen.includes(id))
    if (variant === 'foreign') {
      stage = { kind: 'foreign' }
      setTimeout(emitStage, 60)
      return
    }
    queue = []
    if (scry && chosen.length > 1) queue.push({ message: BOTTOM_ORDER, ids: chosen })
    if (rest.length > 1) queue.push({ message: TOP_ORDER, ids: rest })
    advance()
  }

  const track = (conn: FakeConn) => { activeConn = conn }

  const record = (value: string | boolean) => {
    ARENA_SURVEIL_ANSWERS.push(value)
    ARENA_SURVEIL_ANSWERED.push(ARENA_SURVEIL_SENT[ARENA_SURVEIL_SENT.length - 1] ?? '')
  }

  return makeBaseScenario({
    tableId,
    tableName: TABLE.arenaSurveil,
    gameId,
    getGameView,
    onConnect: track,
    onStartMatch: (conn) => {
      track(conn)
      ARENA_SURVEIL_ANSWERS.length = 0
      ARENA_SURVEIL_ANSWERED.length = 0
      ARENA_SURVEIL_SENT.length = 0
      stage = { kind: 'pick', chosen: [] }
      setTimeout(emitStage, 60)
    },
    onSendPlayerUUID: (conn, uuid) => {
      track(conn)
      if (stage.kind === 'pick') {
        record(uuid)
        stage = { kind: 'pick', chosen: [...stage.chosen, uuid] }
        if (stage.chosen.length >= cards.length) afterPick(stage.chosen)
        else setTimeout(emitStage, 60)
      } else if (stage.kind === 'order') {
        record(uuid)
        const offered = stage.offered.filter((id) => id !== uuid)
        if (offered.length > 1) {
          stage = { ...stage, offered }
          setTimeout(emitStage, 60)
        } else {
          advance()
        }
      } else {
        record(uuid)
      }
    },
    onSendPlayerBoolean: (conn, ctx) => {
      track(conn)
      const value = ctx.args.value === true || ctx.args.value === 'true'
      record(value)
      if (stage.kind === 'pick' && !value) afterPick(stage.chosen)
    },
  })
}
