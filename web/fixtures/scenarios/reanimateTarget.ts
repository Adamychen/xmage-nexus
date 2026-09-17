/**
 * Escenario del FixtureServer para graveyard-target.spec.ts: Reanimate en
 * mano apunta a Grizzly Bears, que reposa en el propio cementerio SIN ser
 * jugable desde ahí (otherZoneCards, a diferencia de crossZone que además lo
 * marcaría como lanzable por flashback/escape y contaminaría la prueba con
 * el "ray" de cast, que ya funcionaba antes del fix). Reproduce el path que
 * estaba roto (commit 8290f779a45): PileOverlay no recibía targetIds/
 * onTargetClick, así que una carta objetivo dentro del cementerio/exilio/
 * biblioteca no tenía onClick.
 */

import { HumanGame } from './humanGame'

export const REANIMATE_GRIZZLY_ID = 'oz-Grizzly-Bears'

export function reanimateTargetScenario() {
  const game = new HumanGame({
    tableName: 'reanimate-target-test',
    lands: [{ name: 'Swamp', count: 1 }],
    hand: ['Reanimate'],
    playable: ['Reanimate'],
    otherZoneCards: [{ name: 'Grizzly Bears', zone: 'graveyard' }],
    cast: [
      { type: 'target', message: 'Select target creature card in a graveyard', targets: [REANIMATE_GRIZZLY_ID] },
      { type: 'mana', message: 'Pay {B}', sources: 1 },
    ],
    resolveEffect: { addToMyBattle: [{ name: 'Grizzly Bears' }] },
  })
  return game.scenario()
}
