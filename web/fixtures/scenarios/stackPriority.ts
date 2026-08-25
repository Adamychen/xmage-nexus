/**
 * Escenario del FixtureServer para probar las mecánicas de Pila y Prioridad Avanzada (Bloque B):
 * 1. Hold Priority: Lanzar Infernal Tutor y retener prioridad para responder en la pila con Lion's Eye Diamond.
 * 2. APNAP Trigger Stacking: Ordenar disparos múltiples simultáneos (Soul Warden + Impact Tremors).
 * 3. Storm & Copias: Lanzar Grapeshot con Storm count=2, crear copias en la pila y re-elegir objetivos.
 */

import { makeBaseScenario } from '../fake'
import { makeCard, makePermanent } from '../../src/__fixtures__/gameViews'
import type { CardView, GameView, PlayerView } from '../../src/net/types'
import {
  GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID,
} from '../humanGameConstants'

export function stackPriorityScenario(): Scenario {
  const tableId = TABLE_ID
  const gameId = GAME_ID

  let stage:
    | 'hold_priority_idle'
    | 'hold_priority_active'
    | 'tutor_cast_holding'
    | 'led_in_response'
    | 'triggers_order'
    | 'storm_cast'
    | 'storm_copies'
    | 'finished' = 'hold_priority_idle'

  let humanLife = 20
  let simLife = 20
  let holdingPriority = false

  const getGameView = (): GameView => {
    const stackCards: Record<string, CardView> = {}

    if (stage === 'tutor_cast_holding') {
      stackCards['stack-tutor'] = makeCard({
        id: 'stack-tutor',
        name: 'Infernal Tutor',
        manaValue: 2,
        cardNumber: '105',
        expansionSetCode: 'dis',
        cardTypes: ['Sorcery'],
        rules: ['Search your library for a card. If you have no cards in hand, reveal it and put it into your hand.'],
      })
    } else if (stage === 'led_in_response') {
      stackCards['stack-tutor'] = makeCard({
        id: 'stack-tutor',
        name: 'Infernal Tutor',
        manaValue: 2,
        cardNumber: '105',
        expansionSetCode: 'dis',
        cardTypes: ['Sorcery'],
      })
      stackCards['stack-led'] = makeCard({
        id: 'stack-led',
        name: "Lion's Eye Diamond",
        manaValue: 0,
        cardNumber: '241',
        expansionSetCode: 'mir',
        cardTypes: ['Artifact'],
        rules: ['{T}, Discard your hand, Sacrifice: Add three mana of any one color.'],
      })
    } else if (stage === 'triggers_order') {
      stackCards['trigger-warden'] = makeCard({
        id: 'trigger-warden',
        name: 'Soul Warden [Trigger]',
        manaValue: 0,
        cardNumber: '39',
        expansionSetCode: 'm10',
        cardTypes: ['Ability'],
        rules: ['Whenever another creature enters the battlefield, you gain 1 life.'],
      })
      stackCards['trigger-tremors'] = makeCard({
        id: 'trigger-tremors',
        name: 'Impact Tremors [Trigger]',
        manaValue: 0,
        cardNumber: '140',
        expansionSetCode: 'dtk',
        cardTypes: ['Ability'],
        rules: ['Whenever a creature enters the battlefield under your control, deal 1 damage to each opponent.'],
      })
    } else if (stage === 'storm_cast' || stage === 'storm_copies') {
      stackCards['stack-grapeshot-orig'] = makeCard({
        id: 'stack-grapeshot-orig',
        name: 'Grapeshot [Original]',
        manaValue: 2,
        cardNumber: '160',
        expansionSetCode: 'tsp',
        cardTypes: ['Sorcery'],
        rules: ['Grapeshot deals 1 damage to any target. Storm (copy for each spell cast before it).'],
      })
      stackCards['stack-grapeshot-copy1'] = makeCard({
        id: 'stack-grapeshot-copy1',
        name: 'Grapeshot [Copia 1]',
        manaValue: 2,
        cardNumber: '160',
        expansionSetCode: 'tsp',
        cardTypes: ['Sorcery'],
        rules: ['Grapeshot deals 1 damage to any target.'],
      })
      stackCards['stack-grapeshot-copy2'] = makeCard({
        id: 'stack-grapeshot-copy2',
        name: 'Grapeshot [Copia 2]',
        manaValue: 2,
        cardNumber: '160',
        expansionSetCode: 'tsp',
        cardTypes: ['Sorcery'],
        rules: ['Grapeshot deals 1 damage to any target.'],
      })
    }

    const humanHand: Record<string, CardView> = {}
    if (stage === 'hold_priority_idle' || stage === 'hold_priority_active') {
      humanHand['card-tutor'] = makeCard({
        id: 'card-tutor',
        name: 'Infernal Tutor',
        manaValue: 2,
        cardNumber: '105',
        expansionSetCode: 'dis',
        cardTypes: ['Sorcery'],
      })
      humanHand['card-led'] = makeCard({
        id: 'card-led',
        name: "Lion's Eye Diamond",
        manaValue: 0,
        cardNumber: '241',
        expansionSetCode: 'mir',
        cardTypes: ['Artifact'],
      })
    } else if (stage === 'tutor_cast_holding') {
      humanHand['card-led'] = makeCard({
        id: 'card-led',
        name: "Lion's Eye Diamond",
        manaValue: 0,
        cardNumber: '241',
        expansionSetCode: 'mir',
        cardTypes: ['Artifact'],
      })
    } else if (stage === 'triggers_order' || stage === 'storm_cast') {
      humanHand['card-grapeshot'] = makeCard({
        id: 'card-grapeshot',
        name: 'Grapeshot',
        manaValue: 2,
        cardNumber: '160',
        expansionSetCode: 'tsp',
        cardTypes: ['Sorcery'],
      })
    }

    const humanPlayer: PlayerView = {
      playerId: HUMAN_PLAYER_ID,
      name: HUMAN_NAME,
      life: humanLife,
      controlled: true,
      isHuman: true,
      hasPriority: true,
      isActive: true,
      handCount: Object.keys(humanHand).length,
      libraryCount: 40,
      battlefield: {
        'land-swamp-1': makePermanent({
          id: 'land-swamp-1',
          name: 'Swamp',
          cardNumber: '260',
          expansionSetCode: 'm21',
          cardTypes: ['Land', 'Basic'],
          tapped: false,
        }),
        'land-swamp-2': makePermanent({
          id: 'land-swamp-2',
          name: 'Swamp',
          cardNumber: '260',
          expansionSetCode: 'm21',
          cardTypes: ['Land', 'Basic'],
          tapped: false,
        }),
        'land-mountain-1': makePermanent({
          id: 'land-mountain-1',
          name: 'Mountain',
          cardNumber: '265',
          expansionSetCode: 'm21',
          cardTypes: ['Land', 'Basic'],
          tapped: false,
        }),
        'land-mountain-2': makePermanent({
          id: 'land-mountain-2',
          name: 'Mountain',
          cardNumber: '265',
          expansionSetCode: 'm21',
          cardTypes: ['Land', 'Basic'],
          tapped: false,
        }),
      },
      manaPool: { white: 0, blue: 0, black: 2, red: 2, green: 0, colorless: 0 },
      graveyard: {},
      exile: {},
      sideboard: {},
      helperCards: {},
      topCard: null,
      wins: 0,
      winsNeeded: 2,
      counters: [],
      commandList: [],
      attachments: [],
      hasLeft: false,
      timerActive: false,
      statesSavedSize: 0,
      priorityTimeSavedTimeMs: 0,
    }

    const simPlayer: PlayerView = {
      playerId: SIM_PLAYER_ID,
      name: SIM_NAME,
      life: simLife,
      controlled: false,
      isHuman: false,
      hasPriority: false,
      isActive: false,
      handCount: 4,
      libraryCount: 40,
      battlefield: {
        'sim-creature-1': makePermanent({
          id: 'sim-creature-1',
          name: 'Grizzly Bears',
          cardNumber: '19',
          expansionSetCode: '10e',
          cardTypes: ['Creature'],
          power: '2',
          toughness: '2',
          tapped: false,
        }),
      },
      manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
      graveyard: {},
      exile: {},
      sideboard: {},
      helperCards: {},
      topCard: null,
      wins: 0,
      winsNeeded: 2,
      counters: [],
      commandList: [],
      attachments: [],
      hasLeft: false,
      timerActive: false,
      statesSavedSize: 0,
      priorityTimeSavedTimeMs: 0,
    }

    return {
      gameCycle: 1,
      turn: 3,
      step: 'PRECOMBAT_MAIN',
      phase: 'PRECOMBAT_MAIN',
      special: false,
      rollbackTurnsAllowed: false,
      totalErrorsCount: 0,
      totalEffectsCount: 0,
      priorityTime: 120,
      bufferTime: 0,
      activePlayerId: HUMAN_PLAYER_ID,
      activePlayerName: HUMAN_NAME,
      priorityPlayerName: HUMAN_NAME,
      players: [humanPlayer, simPlayer],
      myPlayerId: HUMAN_PLAYER_ID,
      myHand: humanHand,
      myHelperEmblems: {},
      canPlayObjects: {
        objects: {
          'card-tutor': { basicCastAbilities: [{ id: 'card-tutor', value: 'Cast Infernal Tutor' }] },
          'card-led': { basicCastAbilities: [{ id: 'card-led', value: "Cast Lion's Eye Diamond" }] },
          'card-grapeshot': { basicCastAbilities: [{ id: 'card-grapeshot', value: 'Cast Grapeshot' }] },
        },
      },
      opponentHands: {},
      watchedHands: {},
      stack: stackCards,
      exiles: [],
      revealed: [],
      lookedAt: [],
      companion: [],
      combat: [],
    }
  }

  return makeBaseScenario({
    tableId,
    tableName: 'stack-priority-test',
    gameId,
    getGameView,
    selectMessage: 'Prioridad en Fase Principal (M1) — Lanza Infernal Tutor con prioridad retenida:',
    onSendPlayerAction: (_conn, value) => {
      if (value === 'HOLD_PRIORITY') {
        holdingPriority = true
        stage = 'hold_priority_active'
      } else if (value === 'UNHOLD_PRIORITY') {
        holdingPriority = false
        stage = 'hold_priority_idle'
      }
    },
    onSendPlayerUUID: (conn, uuid) => {
      // STAGE 1: Hold priority & cast Tutor
      if (uuid === 'card-tutor') {
        stage = 'tutor_cast_holding'
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
        conn.broadcast(
          'GAME_SELECT',
          {
            message: 'Prioridad retenida tras lanzar Infernal Tutor. Puedes responder en la pila.',
            gameView: getGameView(),
          },
          GAME_ID,
        )
        return
      }

      // STAGE 1 (cont): Cast LED in response
      if (uuid === 'card-led') {
        stage = 'led_in_response'
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)

        // Stage 2: APNAP trigger stacking
        setTimeout(() => {
          stage = 'triggers_order'
          conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
          conn.broadcast(
            'GAME_CHOOSE_ABILITY',
            {
              message: 'Elige el orden de colocación en la pila para las habilidades disparadas simultáneas (APNAP):',
              choices: [
                {
                  id: 'choice-warden-first',
                  label: 'Poner Soul Warden primero (Impact Tremors resolverá antes)',
                  value: 'choice-warden-first',
                },
                {
                  id: 'choice-tremors-first',
                  label: 'Poner Impact Tremors primero (Soul Warden resolverá antes)',
                  value: 'choice-tremors-first',
                },
              ],
              gameView: getGameView(),
            },
            GAME_ID,
          )
        }, 250)
        return
      }

      // STAGE 2: Order triggers chosen
      if (stage === 'triggers_order' || uuid === 'choice-warden-first' || uuid === 'choice-tremors-first') {
        stage = 'storm_cast'
        humanLife = 21 // Soul Warden gain +1
        simLife = 19 // Impact Tremors deal 1
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
        conn.broadcast(
          'GAME_SELECT',
          {
            message: 'Lanza Grapeshot con Tormenta (Storm count = 2):',
            gameView: getGameView(),
          },
          GAME_ID,
        )
        return
      }

      // STAGE 3: Cast Grapeshot with Storm
      if (uuid === 'card-grapeshot') {
        stage = 'storm_copies'
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
        conn.broadcast(
          'GAME_TARGET',
          {
            message: 'Elige objetivo para la copia de Grapeshot (Tormenta):',
            targets: [SIM_PLAYER_ID, 'sim-creature-1'],
            gameView: getGameView(),
          },
          GAME_ID,
        )
        return
      }

      // STAGE 3 (cont): Target chosen for copy
      if (stage === 'storm_copies') {
        stage = 'finished'
        simLife = 16 // -3 damage from original + 2 copies
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
        conn.broadcast(
          'GAME_SELECT',
          {
            message: '¡Tormenta resuelta! Daño total aplicado a la pila.',
            gameView: getGameView(),
          },
          GAME_ID,
        )
      }
    },
  })
}
