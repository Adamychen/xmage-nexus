import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import type { Scenario } from '../fake'
import type { FakeConn } from '../fake'
import type { CardView, GameView, PlayerView } from '../../src/net/types'
import { makeCard } from '../../src/__fixtures__/gameViews'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

/**
 * Kodama's Reach as the engine plays it (`recorded/prompts/kodamas-reach-chain.json`, driver
 * `kodamas-reach-chain.mjs`): a library search that states its maximum only in the message, one
 * re-ask per picked card, the pick closing by itself on the second card and asking Done twice when
 * fewer are picked (`TargetCardInLibrary.choose`), then "put one onto the battlefield tapped" over
 * the found lands, and the found lands revealed in `GameView.revealed`.
 */
export const KODAMA_LANDS = [
  { id: 'cccccccc-0000-0000-0000-000000000001', name: 'Forest' },
  { id: 'cccccccc-0000-0000-0000-000000000002', name: 'Island' },
  { id: 'cccccccc-0000-0000-0000-000000000003', name: 'Mountain' },
  { id: 'cccccccc-0000-0000-0000-000000000004', name: 'Plains' },
] as const

export const BATTLEFIELD_PICK = 'Select a card to put on the battlefield tapped'
export const KODAMA_ANSWERS: { message: string; value: string | boolean }[] = []

type Stage = { kind: 'search'; chosen: string[]; dones: number } | { kind: 'battlefield'; found: string[] } | { kind: 'done' }

function cardsView(ids: string[]): Record<string, CardView> {
  const byId = new Map<string, string>(KODAMA_LANDS.map((c) => [c.id, c.name]))
  return Object.fromEntries(ids.map((id) => [id, makeCard({ id, name: byId.get(id) ?? id, cardTypes: ['Land'] as CardView['cardTypes'] })]))
}

export function kodamasReachScenario(): Scenario {
  const gameId = GAME_ID
  const library = KODAMA_LANDS.map((c) => c.id as string)
  let conn: FakeConn | null = null
  let stage: Stage = { kind: 'search', chosen: [], dones: 0 }
  let revealed: string[] = []
  let lastMessage = ''

  const human = {
    playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, life: 20, controlled: true,
    isHuman: true, hasPriority: true, isActive: true, handCount: 0, libraryCount: 40, battlefield: {},
  } as unknown as PlayerView
  const sim = {
    playerId: SIM_PLAYER_ID, name: SIM_NAME, life: 20, controlled: false,
    isHuman: false, hasPriority: false, isActive: false, handCount: 0, libraryCount: 40, battlefield: {},
  } as unknown as PlayerView
  const getGameView = (): GameView => ({
    turn: 3, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID, priorityPlayerId: HUMAN_PLAYER_ID,
    players: [human, sim], myHand: {}, canPlayObjects: { objects: {} },
    revealed: revealed.length ? [{ name: "Kodama's Reach [a1b]", cards: cardsView(revealed) }] : [],
  } as unknown as GameView)

  const emit = () => {
    if (stage.kind === 'search') {
      const offered = library.filter((id) => !(stage.kind === 'search' && stage.chosen.includes(id)))
      lastMessage = `Select basic land cards (selected ${stage.chosen.length} of 2)`
      conn?.broadcast('GAME_TARGET', {
        message: lastMessage, cardsView1: cardsView(library), flag: false, min: 0, max: 0,
        options: { possibleTargets: offered, chosenTargets: stage.chosen }, gameView: getGameView(),
      }, gameId)
    } else if (stage.kind === 'battlefield') {
      lastMessage = BATTLEFIELD_PICK
      conn?.broadcast('GAME_TARGET', {
        message: lastMessage, cardsView1: cardsView(stage.found), flag: true, min: 0, max: 0,
        options: { possibleTargets: stage.found, chosenTargets: [] }, gameView: getGameView(),
      }, gameId)
    }
  }
  const later = () => setTimeout(emit, 60)

  const searched = (found: string[]) => {
    revealed = found
    if (found.length > 1) {
      stage = { kind: 'battlefield', found }
      later()
    } else {
      finish()
    }
  }
  const finish = () => {
    stage = { kind: 'done' }
    conn?.broadcast('GAME_UPDATE', { gameView: getGameView() }, gameId)
    conn?.broadcast('GAME_SELECT', { message: 'Priority', gameView: getGameView() }, gameId)
  }

  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE.kodamasReach,
    gameId,
    getGameView,
    onConnect: (c) => { conn = c },
    onStartMatch: (c) => {
      conn = c
      KODAMA_ANSWERS.length = 0
      revealed = []
      stage = { kind: 'search', chosen: [], dones: 0 }
      later()
    },
    onSendPlayerUUID: (c, uuid) => {
      conn = c
      KODAMA_ANSWERS.push({ message: lastMessage, value: uuid })
      if (stage.kind === 'search') {
        const chosen = [...stage.chosen, uuid]
        if (chosen.length >= 2) searched(chosen)
        else {
          stage = { kind: 'search', chosen, dones: 0 }
          later()
        }
      } else if (stage.kind === 'battlefield') {
        finish()
      }
    },
    onSendPlayerBoolean: (c, ctx) => {
      conn = c
      const value = ctx.args.value === true || ctx.args.value === 'true'
      KODAMA_ANSWERS.push({ message: lastMessage, value })
      if (stage.kind !== 'search' || value) return
      const dones = stage.dones + 1
      if (stage.chosen.length > 0 && dones < 2) {
        stage = { ...stage, dones }
        later()
      } else {
        searched(stage.chosen)
      }
    },
  })
}
