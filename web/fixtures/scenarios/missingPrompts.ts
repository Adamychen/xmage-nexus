/**
 * Escenario del FixtureServer para cubrir los prompts del servidor soportados en
 * feedback.ts pero SIN test E2E previo:
 *   1. GAME_SELECT_PLAYER        (uuid, eligir jugador)
 *   2. GAME_CHOOSE_STRING         (string, lista de opciones)
 *   3. GAME_CHOOSE_STRING         (string, texto libre SIN opciones)
 *   4. GAME_CHOOSE_NUMBER         (integer)
 *   5. GAME_CHOOSE_ONE            (string + options)
 *   6. GAME_CHOOSE_BETWEEN        (string + options)
 *   7. GAME_CHOOSE_MODE           (uuid + choices)
 *   8. GAME_CHOOSE_CARDS          (uuid + cardsView1, selección)
 *   9. GAME_TARGET_PLAYER         (uuid, eligir jugador)
 *  10. GAME_TARGET_AMOUNT         (integer, dividir daño)
 *  11. GAME_SELECT_CARDS          (uuid + cardsView1, multi-selección)
 *  12. GAME_PLAY_XMANA            (boolean)
 *  13. USER_REQUEST_DIALOG        (botones -> sendPlayerAction)
 *
 * Máquina de estados lineal: cada respuesta del cliente avanza al siguiente
 * prompt. El flujo termina con GAME_UPDATE + GAME_SELECT.
 */

import type { FakeConn, Scenario } from '../fake'
import { makeCard } from '../../src/__fixtures__/gameViews'
import type { CardView, GameView, PlayerView } from '../../src/net/types'
import {
  GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID,
} from '../humanGameConstants'

type Stage =
  | 'select_player' | 'choose_string' | 'choose_string_free' | 'choose_number'
  | 'choose_one' | 'choose_between' | 'choose_mode' | 'choose_cards'
  | 'target_player' | 'target_amount' | 'select_cards' | 'xmana'
  | 'user_request' | 'finished'

export function missingPromptsScenario(): Scenario {
  const gameId = GAME_ID
  const tableId = TABLE_ID
  let stage: Stage = 'select_player'
  let cardsCount = 0
  let activeConn: FakeConn | null = null

  const human: PlayerView = {
    playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, life: 20, controlled: true,
    isHuman: true, hasPriority: true, isActive: true, handCount: 0, libraryCount: 40,
    battlefield: {},
  }
  const sim: PlayerView = {
    playerId: SIM_PLAYER_ID, name: SIM_NAME, life: 20, controlled: false,
    isHuman: false, hasPriority: false, isActive: false, handCount: 0, libraryCount: 40,
    battlefield: {},
  }

  const getGameView = (): GameView => ({
    gameId, turn: 1, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID, priorityPlayerId: HUMAN_PLAYER_ID,
    players: [human, sim],
    myHand: {},
    canPlayObjects: { objects: {} },
  })

  const table = {
    tableId, tableName: 'missing-prompts-test', controllerName: HUMAN_NAME,
    gameType: 'Two Player Duel', deckType: 'Constructed - Modern', createTime: Date.now(),
    tableState: 'READY_TO_START', skillLevel: 'Casual', tableStateText: 'Lista',
    seatsInfo: '2/2', isTournament: false,
    seats: [
      { playerName: HUMAN_NAME, seatIndex: 0, playerType: 'HUMAN' },
      { playerName: SIM_NAME, seatIndex: 1, playerType: 'SIM' },
    ],
    games: [gameId], quitRatio: '100', minimumRating: '0', limited: false,
  }

  const selectCards: Record<string, CardView> = {
    'c-a': makeCard({ id: 'c-a', name: 'Mountain', displayName: 'Mountain' }),
    'c-b': makeCard({ id: 'c-b', name: 'Island', displayName: 'Island' }),
    'c-c': makeCard({ id: 'c-c', name: 'Forest', displayName: 'Forest' }),
  }

  const emit = (method: string, data: unknown): void => {
    activeConn?.broadcast(method, data, gameId)
  }

  const toSelectPlayer = () => {
    stage = 'select_player'
    emit('GAME_SELECT_PLAYER', {
      message: 'Choose a player',
      targets: [SIM_PLAYER_ID],
      options: { possibleTargets: [SIM_PLAYER_ID] },
      gameView: getGameView(),
    })
  }
  const toChooseString = () => {
    stage = 'choose_string'
    emit('GAME_CHOOSE_STRING', {
      message: 'Name a card (choose from the list)',
      options: ['Black Lotus', 'Ancestral Recall'],
      gameView: getGameView(),
    })
  }
  const toChooseStringFree = () => {
    stage = 'choose_string_free'
    emit('GAME_CHOOSE_STRING', { message: 'Name a card (free text)', gameView: getGameView() })
  }
  const toChooseNumber = () => {
    stage = 'choose_number'
    emit('GAME_CHOOSE_NUMBER', { message: 'Choose a number', min: 1, max: 5, gameView: getGameView() })
  }
  const toChooseOne = () => {
    stage = 'choose_one'
    emit('GAME_CHOOSE_ONE', { message: 'Choose one', options: { a: 'First option', b: 'Second option' }, gameView: getGameView() })
  }
  const toChooseBetween = () => {
    stage = 'choose_between'
    emit('GAME_CHOOSE_BETWEEN', { message: 'Choose between', options: { x: 'Option X', y: 'Option Y' }, gameView: getGameView() })
  }
  const toChooseMode = () => {
    stage = 'choose_mode'
    emit('GAME_CHOOSE_MODE', {
      message: 'Choose a mode',
      choices: [{ id: 'mode-1', label: 'First mode' }, { id: 'mode-2', label: 'Second mode' }],
      gameView: getGameView(),
    })
  }
  const toChooseCards = () => {
    stage = 'choose_cards'
    emit('GAME_CHOOSE_CARDS', {
      message: 'Choose a card',
      cardsView1: selectCards,
      min: 1, max: 1,
      gameView: getGameView(),
    })
  }
  const toTargetPlayer = () => {
    stage = 'target_player'
    emit('GAME_TARGET_PLAYER', {
      message: 'Choose a player',
      targets: [SIM_PLAYER_ID],
      options: { possibleTargets: [SIM_PLAYER_ID] },
      gameView: getGameView(),
    })
  }
  const toTargetAmount = () => {
    stage = 'target_amount'
    emit('GAME_TARGET_AMOUNT', { message: 'Distribute the damage (total 2)', min: 1, max: 5, gameView: getGameView() })
  }
  const toSelectCards = () => {
    stage = 'select_cards'
    cardsCount = 0
    emit('GAME_SELECT_CARDS', {
      message: 'Select up to two cards',
      cardsView1: selectCards,
      min: 1, max: 2,
      gameView: getGameView(),
    })
  }
    const toXMana = () => {
      stage = 'xmana'
      emit('GAME_PLAY_XMANA', { message: 'Pay X mana?', gameView: getGameView() })
    }
    const toUserRequest = () => {
      stage = 'user_request'
      emit('USER_REQUEST_DIALOG', {
        title: 'Confirmar acción',
        message: '¿Qué quieres hacer?',
        button1Text: 'Rebobinar turno',
        button1Action: 'ROLLBACK_TURN',
        button2Text: 'Detener al final del turno',
        button2Action: 'STOP_UNTIL_END_OF_TURN',
        gameId,
      })
    }
  const finish = () => {
    stage = 'finished'
    emit('GAME_UPDATE', { gameView: getGameView() })
    emit('GAME_SELECT', { message: 'Priority', gameView: getGameView() })
  }

  return {
    onConnect: (conn) => {
      activeConn = conn
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
      conn.lobby([table])
    },
    onAction: (conn, action, _args, requestId) => {
      activeConn = conn
      switch (action) {
        case 'connect':
        case 'createTable':
        case 'joinGame':
        case 'watchTable':
        case 'watchGame':
          conn.ok(requestId, action, { tableId })
          conn.lobby([table])
          break
        case 'startMatch':
          conn.ok(requestId, action, {})
          conn.broadcast('START_GAME', { gameId, tableName: 'missing-prompts-test' }, gameId)
          conn.broadcast('GAME_INIT', { gameView: getGameView() }, gameId)
          toSelectPlayer()
          break
        case 'sendPlayerUUID': {
          conn.ok(requestId, action, {})
          if (stage === 'select_player') toChooseString()
          else if (stage === 'choose_mode') toChooseCards()
          else if (stage === 'choose_cards') toTargetPlayer()
          else if (stage === 'target_player') toTargetAmount()
          else if (stage === 'select_cards') {
            cardsCount++
            if (cardsCount >= 2) toXMana()
          }
          break
        }
        case 'sendPlayerString': {
          conn.ok(requestId, action, {})
          if (stage === 'choose_string') toChooseStringFree()
          else if (stage === 'choose_string_free') toChooseNumber()
          else if (stage === 'choose_one') toChooseBetween()
          else if (stage === 'choose_between') toChooseMode()
          break
        }
        case 'sendPlayerInteger': {
          conn.ok(requestId, action, {})
          if (stage === 'choose_number') toChooseOne()
          else if (stage === 'target_amount') toSelectCards()
          break
        }
        case 'sendPlayerBoolean': {
          conn.ok(requestId, action, {})
          if (stage === 'xmana') toUserRequest()
          break
        }
        case 'sendPlayerAction': {
          conn.ok(requestId, action, {})
          if (stage === 'user_request') finish()
          break
        }
        default:
          conn.ok(requestId, action, {})
          break
      }
    },
  }
}
