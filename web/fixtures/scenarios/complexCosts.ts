import { TABLE } from '../table-names'
/**
 * Escenario del FixtureServer para probar las mecánicas de costes complejos de MTG:
 * 1. Maná Pirexiano ({U/P}): Pagar 2 vidas con GAME_ASK y reducir vidas de 20 a 18.
 * 2. Kicker / Estímulo adicional: Confirmar estímulo con GAME_ASK y resolver con 4 de daño.
 * 3. Cartas Dobles / Split Cards: GAME_CHOOSE_ABILITY para elegir Fire, Ice o Fuse.
 * 4. Aventura / MDFC: GAME_CHOOSE_ABILITY para elegir entre Criatura o Aventura (Stomp).
 * 5. Convoke / Improvise: GAME_PLAY_MANA girando criaturas en mesa para pagar el coste.
 */

import { makeBaseScenario } from '../fake'
import { makeCard, makePermanent } from '../../src/__fixtures__/gameViews'
import type { CardView, GameView, PlayerView } from '../../src/net/types'
import {
  GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID,
} from '../humanGameConstants'

export function complexCostsScenario(): Scenario {
  const tableId = TABLE_ID
  const gameId = GAME_ID

  let stage:
    | 'phyrexian'
    | 'kicker'
    | 'kicker_target'
    | 'split'
    | 'adventure'
    | 'convoke_amount'
    | 'convoke_mana'
    | 'finished' = 'phyrexian'

  let humanLife = 20
  let simLife = 20
  let mysticTapped = false
  let llanowarTapped = false

  const getGameView = (): GameView => {
    const humanPlayer: PlayerView = {
      playerId: HUMAN_PLAYER_ID,
      name: HUMAN_NAME,
      life: humanLife,
      controlled: true,
      isHuman: true,
      hasPriority: true,
      isActive: true,
      handCount: 5,
      libraryCount: 40,
      battlefield: {
        'land-forest-1': makePermanent({
          id: 'land-forest-1',
          name: 'Forest',
          displayName: 'Forest',
          parentId: 'land-forest-1',
          controlled: true,
          cardTypes: ['Land'],
          tapped: false,
        }),
        'land-forest-2': makePermanent({
          id: 'land-forest-2',
          name: 'Forest',
          displayName: 'Forest',
          parentId: 'land-forest-2',
          controlled: true,
          cardTypes: ['Land'],
          tapped: false,
        }),
        'creature-elvish-mystic': makePermanent({
          id: 'creature-elvish-mystic',
          name: 'Elvish Mystic',
          displayName: 'Elvish Mystic',
          parentId: 'creature-elvish-mystic',
          controlled: true,
          power: '1',
          toughness: '1',
          cardTypes: ['Creature'],
          tapped: mysticTapped,
          rules: ['{T}: Add {G}.', 'Convoke (Your creatures can help pay for this spell.)'],
        }),
        'creature-llanowar-elves': makePermanent({
          id: 'creature-llanowar-elves',
          name: 'Llanowar Elves',
          displayName: 'Llanowar Elves',
          parentId: 'creature-llanowar-elves',
          controlled: true,
          power: '1',
          toughness: '1',
          cardTypes: ['Creature'],
          tapped: llanowarTapped,
          rules: ['{T}: Add {G}.', 'Convoke (Your creatures can help pay for this spell.)'],
        }),
      },
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
        'opp-grizzly-bears': makePermanent({
          id: 'opp-grizzly-bears',
          name: 'Grizzly Bears',
          displayName: 'Grizzly Bears',
          parentId: 'opp-grizzly-bears',
          controlled: false,
          power: '2',
          toughness: '2',
          cardTypes: ['Creature'],
        }),
      },
    }

    const handCards: Record<string, CardView> = {
      'hand-probe': makeCard({
        id: 'hand-probe',
        name: 'Gitaxian Probe',
        displayName: 'Gitaxian Probe',
        manaCostLeftStr: ['{U/P}'],
        manaValue: 1,
        cardTypes: ['Sorcery'],
        rules: ['({U/P} can be paid with either {U} or 2 life.)', 'Look at target player’s hand.', 'Draw a card.'],
      }),
      'hand-burst': makeCard({
        id: 'hand-burst',
        name: 'Burst Lightning',
        displayName: 'Burst Lightning',
        manaCostLeftStr: ['{R}'],
        manaValue: 1,
        cardTypes: ['Instant'],
        rules: ['Kicker {4}', 'Burst Lightning deals 2 damage to any target. If it was kicked, it deals 4 damage instead.'],
      }),
      'hand-fire-ice': makeCard({
        id: 'hand-fire-ice',
        name: 'Fire // Ice',
        displayName: 'Fire // Ice',
        manaCostLeftStr: ['{1}{R}', '{1}{U}'],
        manaValue: 2,
        cardTypes: ['Instant'],
        rules: ['Fire deals 2 damage divided as you choose among one or two targets.', 'Ice taps target permanent. Draw a card.'],
      }),
      'hand-giant': makeCard({
        id: 'hand-giant',
        name: 'Bonecrusher Giant',
        displayName: 'Bonecrusher Giant',
        manaCostLeftStr: ['{2}{R}'],
        manaValue: 3,
        power: '4',
        toughness: '3',
        cardTypes: ['Creature'],
        rules: ['Whenever Bonecrusher Giant becomes the target of a spell, it deals 2 damage to that spell’s controller.'],
      }),
      'hand-chord': makeCard({
        id: 'hand-chord',
        name: 'Chord of Calling',
        displayName: 'Chord of Calling',
        manaCostLeftStr: ['{X}{G}{G}{G}'],
        manaValue: 3,
        cardTypes: ['Instant'],
        rules: ['Convoke', 'Search your library for a creature card with mana value X or less, put it onto the battlefield, then shuffle.'],
      }),
    }

    return {
      gameId,
      turn: 3,
      phase: 'PRECOMBAT_MAIN',
      step: 'PRECOMBAT_MAIN',
      activePlayerId: HUMAN_PLAYER_ID,
      priorityPlayerId: HUMAN_PLAYER_ID,
      players: [humanPlayer, simPlayer],
      myHand: handCards,
      canPlayObjects: {
        objects: {
          'hand-probe': { basicCastAbilities: [{ id: 'hand-probe', value: 'Cast Gitaxian Probe' }] },
          'hand-burst': { basicCastAbilities: [{ id: 'hand-burst', value: 'Cast Burst Lightning' }] },
          'hand-fire-ice': { basicCastAbilities: [{ id: 'hand-fire-ice', value: 'Cast Fire // Ice' }] },
          'hand-giant': { basicCastAbilities: [{ id: 'hand-giant', value: 'Cast Bonecrusher Giant' }] },
          'hand-chord': { basicCastAbilities: [{ id: 'hand-chord', value: 'Cast Chord of Calling' }] },
          'creature-elvish-mystic': { basicCastAbilities: [{ id: 'creature-elvish-mystic', value: 'Tap for mana / Convoke' }] },
          'creature-llanowar-elves': { basicCastAbilities: [{ id: 'creature-llanowar-elves', value: 'Tap for mana / Convoke' }] },
        },
      },
    }
  }

  return makeBaseScenario({
    tableId,
    tableName: TABLE.complexCosts,
    gameId,
    getGameView,
    onStartMatch: (conn) => {
      // 1. Maná Pirexiano: Pregunta si pagar 2 vidas
      stage = 'phyrexian'
      conn.broadcast(
        'GAME_ASK',
        {
          message: '¿Deseas pagar 2 vidas por {U/P} para lanzar Gitaxian Probe?',
          gameView: getGameView(),
        },
        GAME_ID,
      )
    },
    onSendPlayerBoolean: (conn) => {
      if (stage === 'phyrexian') {
        // El jugador paga 2 vidas
        humanLife = 18
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)

        // 2. Kicker / Estímulo adicional
        stage = 'kicker'
        conn.broadcast(
          'GAME_ASK',
          {
            message: '¿Deseas pagar el coste adicional de Estímulo (Kicker) de {4} para Burst Lightning?',
            gameView: getGameView(),
          },
          GAME_ID,
        )
      } else if (stage === 'kicker') {
        // Confirmó el Kicker -> pedir objetivo
        stage = 'kicker_target'
        conn.broadcast(
          'GAME_TARGET',
          {
            message: 'Selecciona el objetivo para Burst Lightning (infligirá 4 de daño por Estímulo)',
            targets: [SIM_PLAYER_ID],
            gameView: getGameView(),
          },
          GAME_ID,
        )
      } else if (stage === 'convoke_mana') {
        // Finalizó el pago de maná/convoke
        stage = 'finished'
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
        conn.broadcast(
          'GAME_SELECT',
          {
            message: 'Prioridad en Fase Principal (M1)',
            gameView: getGameView(),
          },
          GAME_ID,
        )
      }
    },
    onSendPlayerUUID: (conn, uuid) => {
      if (stage === 'kicker_target') {
        // El daño de 4 de Kicker impacta al Sim
        simLife = 16
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)

        // 3. Cartas Dobles / Split Cards: GAME_CHOOSE_ABILITY
        stage = 'split'
        conn.broadcast(
          'GAME_CHOOSE_ABILITY',
          {
            message: 'Elige qué mitad de Fire // Ice deseas lanzar:',
            choices: [
              { id: 'cast-fire', label: 'Lanzar Fire {1}{R} — 2 de daño divididos', value: 'cast-fire' },
              { id: 'cast-ice', label: 'Lanzar Ice {1}{U} — Gira el objetivo y roba una carta', value: 'cast-ice' },
              { id: 'cast-fuse', label: 'Lanzar con Fusión (Fuse) {2}{U}{R} — Ambas mitades', value: 'cast-fuse' },
            ],
            gameView: getGameView(),
          },
          GAME_ID,
        )
      } else if (stage === 'split') {
        // 4. Aventura / MDFC: GAME_CHOOSE_ABILITY
        stage = 'adventure'
        conn.broadcast(
          'GAME_CHOOSE_ABILITY',
          {
            message: 'Elige cómo deseas lanzar Bonecrusher Giant // Stomp:',
            choices: [
              { id: 'cast-giant', label: 'Lanzar Bonecrusher Giant {2}{R} [Criatura 4/3]', value: 'cast-giant' },
              { id: 'cast-stomp', label: 'Lanzar Stomp {1}{R} [Aventura — Daño y no se puede prevenir]', value: 'cast-stomp' },
            ],
            gameView: getGameView(),
          },
          GAME_ID,
        )
      } else if (stage === 'adventure') {
        // 5. Convoke: pedir valor de X para Chord of Calling
        stage = 'convoke_amount'
        conn.broadcast(
          'GAME_GET_AMOUNT',
          {
            message: 'Elige el valor de X para Chord of Calling {X}{G}{G}{G}',
            min: 1,
            max: 4,
            gameView: getGameView(),
          },
          GAME_ID,
        )
      } else if (stage === 'convoke_mana') {
        // El jugador clica en las criaturas para girarlas por Convoke
        if (uuid === 'creature-elvish-mystic') {
          mysticTapped = true
        } else if (uuid === 'creature-llanowar-elves') {
          llanowarTapped = true
        }
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
      }
    },
    onSendPlayerInteger: (conn) => {
      if (stage === 'convoke_amount') {
        stage = 'convoke_mana'
        conn.broadcast(
          'GAME_PLAY_MANA',
          {
            message: 'Pagar maná para Chord of Calling {1}{G}{G}{G} (Convoke: gira criaturas para pagar {G} o {1})',
            gameView: getGameView(),
          },
          GAME_ID,
        )
      }
    },
    onSendPlayerString: (conn) => {
      if (stage === 'convoke_mana') {
        stage = 'finished'
        conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
        conn.broadcast(
          'GAME_SELECT',
          {
            message: 'Prioridad en Fase Principal (M1)',
            gameView: getGameView(),
          },
          GAME_ID,
        )
      }
    },
  })
}
