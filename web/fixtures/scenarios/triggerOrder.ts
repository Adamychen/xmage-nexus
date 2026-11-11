import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import type { Scenario } from '../fake'
import type { FakeConn } from '../fake'
import type { CardView, GameView, PlayerView } from '../../src/net/types'
import { makeCard, makePermanent, makePlayer } from '../../src/__fixtures__/gameViews'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

const TRIGGER_WARDEN = '11111111-1111-1111-1111-111111111111'
const TRIGGER_ARTIST = '22222222-2222-2222-2222-222222222222'

const CARDS: Record<string, unknown> = {
  [TRIGGER_WARDEN]: {
    id: TRIGGER_WARDEN, name: 'Ability', displayName: null,
    sourceName: 'Soul Warden',
    sourceCard: {
      id: 'src-soul-warden', name: 'Soul Warden', displayName: 'Soul Warden',
      expansionSetCode: 'TMP', cardNumber: '35', manaValue: 1,
    },
    rules: ['Whenever another creature enters the battlefield, you gain 1 life.'],
  },
  [TRIGGER_ARTIST]: {
    id: TRIGGER_ARTIST, name: 'Ability', displayName: null,
    sourceName: 'Blood Artist',
    sourceCard: {
      id: 'src-blood-artist', name: 'Blood Artist', displayName: 'Blood Artist',
      expansionSetCode: 'AVR', cardNumber: '82', manaValue: 2,
    },
    rules: ['Whenever Blood Artist or another creature dies, target player loses 1 life.'],
  },
}

export const TRIGGER_ACTIONS: string[] = []
export const TRIGGER_PICKS: string[] = []

interface TriggerOrderSetup {
  tableName: string
  /** Ability views of the PICK_ABILITY prompt (`CardsView(abilities, game)` on the wire). */
  cards: Record<string, unknown>
  getGameView: () => GameView
}

function makeTriggerOrderScenario(setup: TriggerOrderSetup): Scenario {
  const gameId = GAME_ID
  const tableId = TABLE_ID
  let activeConn: FakeConn | null = null
  let remaining: string[] = []

  // The server re-asks once per pick with the remaining abilities: the scenario
  // mirrors that so the client's auto-chaining is actually exercised.
  const emitPickAbility = (ids: string[]) => {
    activeConn?.broadcast('GAME_TARGET', {
      message: 'Pick triggered ability (goes to the stack first)',
      options: { queryType: 'PICK_ABILITY' },
      targets: ids,
      cardsView1: Object.fromEntries(ids.map((id) => [id, setup.cards[id]])),
      gameView: setup.getGameView(),
    }, gameId)
  }

  const finish = () => {
    activeConn?.broadcast('GAME_UPDATE', { gameView: setup.getGameView() }, gameId)
    activeConn?.broadcast('GAME_SELECT', { message: 'Priority', gameView: setup.getGameView() }, gameId)
  }

  const track = (conn: FakeConn) => { activeConn = conn }

  return makeBaseScenario({
    tableId,
    tableName: setup.tableName,
    gameId,
    getGameView: setup.getGameView,
    onConnect: track,
    onStartMatch: (conn) => {
      track(conn)
      remaining = Object.keys(setup.cards)
      TRIGGER_PICKS.length = 0
      setTimeout(() => emitPickAbility(remaining), 60)
    },
    onSendPlayerAction: (conn, action) => { track(conn); TRIGGER_ACTIONS.push(action) },
    onSendPlayerUUID: (conn, uuid) => {
      track(conn)
      TRIGGER_PICKS.push(uuid)
      remaining = remaining.filter((id) => id !== uuid)
      if (remaining.length > 0) setTimeout(() => emitPickAbility(remaining), 60)
      else finish()
    },
  })
}

export function triggerOrderScenario(): Scenario {
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
  return makeTriggerOrderScenario({ tableName: TABLE.triggerOrder ?? 'trigger-order-test', cards: CARDS, getGameView })
}

// --- Tergrid: several opponents discard at once -----------------------------

export const TERGRID_PERMANENT = 'tergrid-perm-0001'
export const TERGRID_ELVES = '33333333-3333-3333-3333-333333333331'
export const TERGRID_SOL_RING = '33333333-3333-3333-3333-333333333332'
export const TERGRID_SIGNET = '33333333-3333-3333-3333-333333333333'
export const WASTE_NOT_TRIGGER = '33333333-3333-3333-3333-333333333334'
export const GRAVE_ELVES = 'grave-llanowar-elves'
export const GRAVE_SOL_RING = 'grave-sol-ring'
export const GRAVE_SIGNET = 'grave-arcane-signet'
export const SECOND_OPPONENT_ID = 'opp-2'
const WASTE_NOT_PERMANENT = 'waste-not-perm-0001'

const TERGRID_RULE = 'Whenever an opponent sacrifices a nontoken permanent or discards a permanent card, you may put that card from a graveyard onto the battlefield under your control.'

/** `CardsView(abilities, game)`: a FixedTarget pointer becomes `targets` plus a "Related objects" rule. */
function tergridTrigger(id: string, cardId: string, cardName: string): unknown {
  return {
    id, name: 'Ability', displayName: null,
    sourceName: 'Tergrid, God of Fright',
    sourceCard: {
      id: TERGRID_PERMANENT, name: 'Tergrid, God of Fright', displayName: 'Tergrid, God of Fright',
      expansionSetCode: 'KHM', cardNumber: '112', manaValue: 5, cardTypes: ['Creature'],
    },
    rules: [TERGRID_RULE, `<i>Related objects: [<font color='#FFFFFF'>${cardName} [${cardId.slice(-3)}]</font>]</i>`],
    targets: [cardId],
  }
}

const TERGRID_CARDS: Record<string, unknown> = {
  [TERGRID_ELVES]: tergridTrigger(TERGRID_ELVES, GRAVE_ELVES, 'Llanowar Elves'),
  [TERGRID_SOL_RING]: tergridTrigger(TERGRID_SOL_RING, GRAVE_SOL_RING, 'Sol Ring'),
  [TERGRID_SIGNET]: tergridTrigger(TERGRID_SIGNET, GRAVE_SIGNET, 'Arcane Signet'),
  [WASTE_NOT_TRIGGER]: {
    id: WASTE_NOT_TRIGGER, name: 'Ability', displayName: null,
    sourceName: 'Waste Not',
    sourceCard: {
      id: WASTE_NOT_PERMANENT, name: 'Waste Not', displayName: 'Waste Not',
      expansionSetCode: 'M20', cardNumber: '122', manaValue: 2, cardTypes: ['Enchantment'],
    },
    rules: ['Whenever an opponent discards a creature card, create a 2/2 black Zombie creature token.'],
  },
}

/**
 * Tergrid, God of Fright with two opponents discarding at once (the case Darío reported):
 * three Tergrid triggers whose only difference is the card in a graveyard, plus an untargeted
 * Waste Not trigger. Play it with `SCENARIO=tergrid npm run play:fake`.
 */
export function triggerOrderTergridScenario(): Scenario {
  const graveCard = (id: string, name: string, types: string[]): CardView =>
    makeCard({ id, name, cardTypes: types as CardView['cardTypes'] })
  const human = makePlayer({
    playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, controlled: true, isActive: true, hasPriority: true,
    battlefield: {
      [TERGRID_PERMANENT]: makePermanent({ id: TERGRID_PERMANENT, name: 'Tergrid, God of Fright', power: '4', toughness: '5', controllerId: HUMAN_PLAYER_ID }),
      [WASTE_NOT_PERMANENT]: makePermanent({ id: WASTE_NOT_PERMANENT, name: 'Waste Not', cardTypes: ['Enchantment'], controllerId: HUMAN_PLAYER_ID }),
    },
  } as Parameters<typeof makePlayer>[0])
  const sim = makePlayer({
    playerId: SIM_PLAYER_ID, name: SIM_NAME, isHuman: false,
    graveyard: { [GRAVE_ELVES]: graveCard(GRAVE_ELVES, 'Llanowar Elves', ['Creature']) },
  })
  const second = makePlayer({
    playerId: SECOND_OPPONENT_ID, name: 'sim-000002-118', isHuman: false,
    graveyard: {
      [GRAVE_SOL_RING]: graveCard(GRAVE_SOL_RING, 'Sol Ring', ['Artifact']),
      [GRAVE_SIGNET]: graveCard(GRAVE_SIGNET, 'Arcane Signet', ['Artifact']),
    },
  })
  const getGameView = (): GameView => ({
    turn: 3, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID, priorityPlayerId: HUMAN_PLAYER_ID,
    players: [human, sim, second], myHand: {}, canPlayObjects: { objects: {} },
  } as unknown as GameView)
  return makeTriggerOrderScenario({ tableName: TABLE.triggerOrder ?? 'trigger-order-test', cards: TERGRID_CARDS, getGameView })
}
