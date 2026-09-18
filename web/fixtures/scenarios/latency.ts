/**
 * Escenarios del FixtureServer para latency.spec.ts (plan4 §5.4): partidas
 * mínimas y deterministas que exponen UNA acción medible cada una. El retardo
 * de eco lo aporta FakeServer.start(..., { echoDelayMs }) en el spec.
 */

import { HumanGame } from './humanGame'

/** Sin jugables ni tierras en mano: el helper solo puede pasar prioridad. */
export function latencyPassScenario() {
  return new HumanGame({
    tableName: 'latency-pass',
    hand: ['Lightning Bolt', 'Lightning Bolt'],
  }).scenario()
}

/** Mountains en mano y jugables: el helper juega UNA por turno, el test clica otra. */
export function latencyLandScenario() {
  return new HumanGame({
    tableName: 'latency-land',
    hand: ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Lightning Bolt'],
    playable: ['Mountain'],
  }).scenario()
}

/** Lightning Bolt jugable; target al Goblin del Sim y pago de {R} con la tierra. */
export function latencyTargetScenario() {
  return new HumanGame({
    tableName: 'latency-target',
    lands: [{ name: 'Mountain', count: 1 }],
    hand: ['Lightning Bolt', 'Lightning Bolt'],
    playable: ['Lightning Bolt'],
    cast: [
      { type: 'target', message: 'Select any target', targets: ['sim-Raging Goblin'] },
      { type: 'mana', message: 'Pay {R}', sources: 1 },
    ],
    simBattle: ['Raging Goblin'],
    damageToSim: 3,
  }).scenario()
}

/** Goblin propio listo para declarar atacantes (el helper pasa el main). */
export function latencyCombatScenario() {
  return new HumanGame({
    tableName: 'latency-combat',
    hand: ['Lightning Bolt'],
    myBattle: ['Raging Goblin'],
    humanAttack: true,
    humanCombatDamage: 1,
  }).scenario()
}
