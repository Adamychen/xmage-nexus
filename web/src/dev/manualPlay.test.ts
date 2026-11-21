/**
 * A table to play by hand, with no Java and no proxy: it holds the e2e `FakeServer` open on a
 * fixed port so a browser can be pointed at it.
 *
 *   MANUAL_PLAY=1 npx vitest run src/dev/manualPlay.test.ts
 *   (in another shell) npx vite --port 5201 --strictPort --host 127.0.0.1
 *   then open http://127.0.0.1:5201/?proxyPort=8795
 *
 * Log in with any name of 14 characters or fewer, create a table and play. The opponent is the
 * same mini engine the e2e specs drive, so it answers priorities, blocks and resolutions.
 *
 * It is skipped unless MANUAL_PLAY is set, so it costs a CI run nothing.
 */
import { describe, it } from 'vitest'
import { FakeServer } from '../../fixtures/fake'
import { HumanGame } from '../../fixtures/scenarios/humanGame'
import { SIM_PLAYER_ID } from '../../fixtures/humanGameConstants'

const PORT = Number(process.env.MANUAL_PLAY_PORT ?? 8795)
const MINUTES = Number(process.env.MANUAL_PLAY_MINUTES ?? 45)

/** A board with something to do on it: lands out, spells in hand, creatures on both sides. */
function playgroundScenario() {
  return new HumanGame({
    tableName: 'Manual play',
    lands: [{ name: 'Mountain', count: 3 }, { name: 'Forest', count: 2 }],
    hand: ['Lightning Bolt', 'Giant Growth', 'Raging Goblin', 'Mountain', 'Forest', 'Llanowar Elves'],
    playable: ['Lightning Bolt', 'Raging Goblin', 'Mountain', 'Forest', 'Llanowar Elves'],
    myBattle: ['Raging Goblin', 'Llanowar Elves'],
    simBattle: ['Grizzly Bears', 'Serra Angel'],
    cast: [
      { type: 'target', message: 'Select any target', targets: [SIM_PLAYER_ID] },
      { type: 'mana', message: 'Pay {R}', sources: 1 },
    ],
    damageToSim: 3,
    humanAttack: true,
    humanCombatDamage: 1,
    simAttack: true,
    simCombatDamage: 2,
  }).scenario()
}

describe.skipIf(!process.env.MANUAL_PLAY)('a table to play by hand', () => {
  it('holds the fake server open', async () => {
    const server = await FakeServer.start(PORT, playgroundScenario)
    // eslint-disable-next-line no-console
    console.log(`\n  fake server on ws://127.0.0.1:${server.port}\n  open http://127.0.0.1:5201/?proxyPort=${server.port}\n`)
    await new Promise((resolve) => setTimeout(resolve, MINUTES * 60_000))
    await server.stop()
  }, MINUTES * 60_000 + 10_000)
})
