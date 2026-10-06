import { TABLE } from '../table-names'
/**
 * Escenario del FixtureServer para el flujo LEARN (Strixhaven) con los payloads
 * REALES capturados contra el motor 1.4.62 (driver scripts/drivers/learn.mjs,
 * Eyetwitch muerto con Lightning Bolt, sideboard con Environmental Sciences):
 *
 *   1. GAME_ASK   "Reveal a Lesson card you own from outside the game and put
 *                 it into your hand?"            (WishEffect → chooseUse)
 *   2. GAME_TARGET "Select a Lesson card"        (WishEffect → choose) con la
 *                 forma EXACTA del overload Cards: `targets: null` (los ids
 *                 legales van en options.possibleTargets), cardsView1 con el
 *                 CardView completo de la Lesson (zone OUTSIDE) y
 *                 options.targetZone 'ALL'.
 *
 * El jugador debe poder responder SÍ y clicar la Lesson en el CardGrid; el
 * cliente debe enviar sendPlayerUUID(<lesson-id>).
 */

import type { FakeConn } from '../fake'
import { makeBaseScenario } from '../fake'
import { makeCard } from '../../src/__fixtures__/gameViews'
import type { CardView, GameView, PlayerView } from '../../src/net/types'
import {
  GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID,
} from '../humanGameConstants'

/** Id real de la Environmental Sciences del sideboard capturado en vivo. */
export const LESSON_ID = '411af814-1947-41ed-84b2-c427902a87cf'

type Stage = 'ask' | 'pick_lesson' | 'finished'

export function learnScenario(): Scenario {
  const gameId = GAME_ID
  const tableId = TABLE_ID
  let stage: Stage = 'ask'
  let activeConn: FakeConn | null = null

  const human: PlayerView = {
    playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, life: 20, controlled: true,
    isHuman: true, hasPriority: false, isActive: true, handCount: 7, libraryCount: 53,
    battlefield: {},
    sideboard: {
      [LESSON_ID]: makeCard({
        id: LESSON_ID,
        name: 'Environmental Sciences',
        displayName: 'Environmental Sciences',
        manaValue: 2,
        cardTypes: ['SORCERY'],
        subTypes: ['LESSON'],
        manaCostLeftStr: ['{2}'],
        rules: ['Search your library for a basic land card, reveal it, put it into your hand, then shuffle. You gain 2 life.'],
      }),
    },
  }
  const sim: PlayerView = {
    playerId: SIM_PLAYER_ID, name: SIM_NAME, life: 20, controlled: false,
    isHuman: false, hasPriority: false, isActive: false, handCount: 7, libraryCount: 53,
    battlefield: {},
  }

  const getGameView = (): GameView => ({
    gameId, turn: 1, phase: 'POSTCOMBAT_MAIN', step: 'POSTCOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID, priorityPlayerId: HUMAN_PLAYER_ID,
    players: [human, sim],
    myHand: {
      'hand-m1': makeCard({ id: 'hand-m1', name: 'Mountain', displayName: 'Mountain' }),
      'hand-bolt': makeCard({ id: 'hand-bolt', name: 'Lightning Bolt', displayName: 'Lightning Bolt', manaCostLeftStr: ['{R}'], manaValue: 1 }),
    },
    canPlayObjects: { objects: {} },
  })

  const emit = (method: string, data: unknown): void => {
    activeConn?.broadcast(method, data, gameId)
  }

  /** Pregunta SÍ/NO del LearnEffect (WishEffect.chooseUse), texto literal del motor. */
  const toAsk = () => {
    stage = 'ask'
    emit('GAME_ASK', {
      question: 'Reveal a Lesson card you own from outside the game and put it into your hand?',
      gameView: getGameView(),
    })
  }

  /**
   * Elegir la Lesson (WishEffect → HumanPlayer.choose(Outcome, Cards, TargetCard)).
   * Payload EXACTO del overload Cards capturado en vivo: targets null,
   * possibleTargets en options, cardsView1 con el CardView de la Lesson.
   */
  const toPickLesson = () => {
    stage = 'pick_lesson'
    emit('GAME_TARGET', {
      message: 'Select a Lesson card',
      cardsView1: {
        [LESSON_ID]: makeCard({
          id: LESSON_ID,
          name: 'Environmental Sciences',
          displayName: 'Environmental Sciences',
          manaValue: 2,
          cardTypes: ['SORCERY'],
          subTypes: ['LESSON'],
          manaCostLeftStr: ['{2}'],
          zone: 'OUTSIDE',
          rules: ['Search your library for a basic land card, reveal it, put it into your hand, then shuffle. You gain 2 life.'],
        }),
      },
      cardsView2: null,
      targets: null,
      min: 0,
      max: 0,
      flag: true,
      options: {
        chosenTargets: [],
        possibleTargets: [LESSON_ID],
        targetZone: 'ALL',
        queryType: 'PICK_TARGET',
      },
      gameView: getGameView(),
    })
  }

  const finish = () => {
    stage = 'finished'
    emit('GAME_UPDATE', { gameView: getGameView() })
    emit('GAME_SELECT', { message: 'Priority', gameView: getGameView() })
  }

  const track = (conn: FakeConn): void => {
    activeConn = conn
  }

  return makeBaseScenario({
    tableId,
    tableName: TABLE.learn,
    gameId,
    getGameView,
    onConnect: track,
    onStartMatch: (conn) => {
      track(conn)
      toAsk()
    },
    onSendPlayerBoolean: (conn) => {
      track(conn)
      if (stage === 'ask') toPickLesson()
      else if (stage === 'pick_lesson') finish()
    },
    onSendPlayerUUID: (conn) => {
      track(conn)
      if (stage === 'pick_lesson') finish()
    },
  })
}