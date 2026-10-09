import { TABLE } from '../table-names'
import { makeBaseScenario, type Scenario } from '../fake'
import { makeGameView, makePlayer, makePermanent } from '../../src/__fixtures__/gameViews'
import type { GameView } from '../../src/net/types'

/**
 * A fixed board holding exactly the shapes that `ptBadgeMode` and
 * `sicknessStyle` distinguish, so the browser suite can assert the drawn layers
 * instead of relying only on the jsdom truth table in `CardSlot.test.tsx`.
 *
 * The four cases (issue #12 review focus):
 * - P/T equal to the printed value → no badge in 'changed' mode;
 * - P/T above the printed value → badge in 'changed' mode;
 * - no printed P/T at all (token) → the badge stays in 'changed' mode, by
 *   design: without a base there is nothing to compare, and hiding the numbers
 *   would hide the information;
 * - summoning sickness on a TAPPED creature → no indicator in either style
 *   (`hasSummoningSickness` requires `!tapped`).
 *
 * `originalPower` stays a plain string here (the generated contract type). The
 * mage-object form (`{ baseValue, cardValue }`), which the server really sends,
 * is covered by the recorded-frame replay in `e2e/recorded.spec.ts`.
 */

export const OVERLAY_GAME_ID = 'game-overlays-1'
export const OVERLAY_TABLE_ID = 'table-overlays-1'
export const OVERLAY_HUMAN_ID = 'overlay-human-1'
export const OVERLAY_HUMAN_NAME = 'Mage Web'
export const OVERLAY_SIM_ID = 'overlay-sim-1'
export const OVERLAY_SIM_NAME = 'sim-000077'

/** 2/2, printed 2/2, no sickness: must show no badge in 'changed' mode. */
export const OV_BASE_BEARS = 'ov-bears'
/** 3/1, printed 1/1, sick and untapped: badge + sickness layer at once. */
export const OV_BUFFED_MYSTIC = 'ov-mystic'
/** 2/2, printed 0/2, sick and untapped. */
export const OV_BUFFED_BALLISTA = 'ov-ballista'
/** 1/1 with no printed P/T (token), sick and untapped. */
export const OV_TOKEN = 'ov-token'
/** Sick but tapped: neither the clock nor the veil may appear. */
export const OV_SICK_TAPPED = 'ov-bear-tapped'
/** Opponent-side sick creature, to cover the top zone as well. */
export const OV_OPP_BEAST = 'ov-opp-beast'

function view(): GameView {
  return makeGameView({
    players: [
      makePlayer({
        playerId: OVERLAY_HUMAN_ID,
        name: OVERLAY_HUMAN_NAME,
        controlled: true,
        isHuman: true,
        isActive: true,
        hasPriority: true,
        handCount: 1,
        battlefield: {
          [OV_BASE_BEARS]: makePermanent({
            name: 'Grizzly Bears',
            parentId: OV_BASE_BEARS,
            controlled: true,
            power: '2',
            toughness: '2',
            originalPower: '2',
            originalToughness: '2',
          }),
          [OV_BUFFED_MYSTIC]: makePermanent({
            name: 'Elvish Mystic',
            parentId: OV_BUFFED_MYSTIC,
            controlled: true,
            power: '3',
            toughness: '1',
            originalPower: '1',
            originalToughness: '1',
            summoningSickness: true,
          }),
          [OV_BUFFED_BALLISTA]: makePermanent({
            name: 'Walking Ballista',
            parentId: OV_BUFFED_BALLISTA,
            controlled: true,
            cardTypes: ['Artifact', 'Creature'],
            power: '2',
            toughness: '2',
            originalPower: '0',
            originalToughness: '2',
            summoningSickness: true,
          }),
          [OV_TOKEN]: makePermanent({
            name: 'Goblin Token',
            parentId: OV_TOKEN,
            controlled: true,
            power: '1',
            toughness: '1',
            summoningSickness: true,
          }),
          [OV_SICK_TAPPED]: makePermanent({
            name: 'Runeclaw Bear',
            parentId: OV_SICK_TAPPED,
            controlled: true,
            power: '2',
            toughness: '2',
            originalPower: '2',
            originalToughness: '2',
            tapped: true,
            summoningSickness: true,
          }),
        },
      }),
      makePlayer({
        playerId: OVERLAY_SIM_ID,
        name: OVERLAY_SIM_NAME,
        controlled: false,
        isHuman: false,
        handCount: 3,
        battlefield: {
          [OV_OPP_BEAST]: makePermanent({
            name: 'Runeclaw Bear',
            parentId: OV_OPP_BEAST,
            power: '2',
            toughness: '2',
            originalPower: '2',
            originalToughness: '2',
            summoningSickness: true,
          }),
        },
      }),
    ],
    myPlayerId: OVERLAY_HUMAN_ID,
    activePlayerId: OVERLAY_HUMAN_ID,
    activePlayerName: OVERLAY_HUMAN_NAME,
    priorityPlayerName: OVERLAY_HUMAN_NAME,
    turn: 3,
  })
}

export function cardOverlaysScenario(): Scenario {
  return makeBaseScenario({
    tableId: OVERLAY_TABLE_ID,
    tableName: TABLE.cardOverlays,
    gameId: OVERLAY_GAME_ID,
    getGameView: view,
    selectMessage: 'Priority (overlay fixture)',
  })
}