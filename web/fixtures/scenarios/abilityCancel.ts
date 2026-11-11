/**
 * FixtureServer scenario for activated-ability-cancel.spec.ts (PRM-13) and `SCENARIO=abilityCancel
 * npm run play:fake`: Rod of Ruin on the battlefield with three Mountains. Clicking it walks the
 * engine's activation (ability picker, target, {3}) and any cancel restores the board.
 */

import { HumanGame, SIM_PLAYER_ID } from './humanGame'

export const ABILITY_CANCEL_TABLE = 'ability-cancel-test'
export const ROD_ID = 'my-Rod of Ruin'

export function abilityCancelScenario() {
  const game = new HumanGame({
    tableName: ABILITY_CANCEL_TABLE,
    lands: [{ name: 'Mountain', count: 3 }],
    hand: ['Mountain'],
    myBattle: ['Rod of Ruin'],
    abilities: [{
      permanent: 'Rod of Ruin',
      text: '{3}, {T}: Rod of Ruin deals 1 damage to any target.',
      steps: [
        { type: 'target', message: 'Select any target', targets: [SIM_PLAYER_ID], required: false },
        { type: 'mana', message: 'Pay {3}', sources: 3 },
      ],
      tapSource: true,
      damageToSim: 1,
    }],
  })
  return game.scenario()
}
