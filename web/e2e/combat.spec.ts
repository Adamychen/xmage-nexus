import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { controlledPlayer, framesOf, lastGameView, opponentBattlefield, parseFrames } from './support/frames'
import { quickStartGame } from './support/start-game'
import { FAKE_MODE } from './dual'
import { combatScenario } from '../fixtures/scenarios/combat'
import { withFakeServer } from './support/fake-backend'
import { retryTimingSpecInCi } from './support/timing'

retryTimingSpecInCi()

/** Verifica el combate del Sim (el HumanHelper mantiene los turnos del humano):
 *  criatura en el campo, ataque declarado y daño aplicado. Además comprueba que
 *  el atacante se muestra girado (clase `tapped`) mientras dura el combate. */
const QUARTER_TURN = 'matrix(0, 1, -1, 0, 0, 0)'

type CombatSeen = { goblin: boolean; attack: boolean; damaged: boolean; tapped: boolean; transform: string | null }

async function waitForSimCombat(page: Page): Promise<CombatSeen> {
  const deadline = Date.now() + 30_000
  const seen: CombatSeen = { goblin: false, attack: false, damaged: false, tapped: false, transform: null }
  while (Date.now() < deadline) {
    const view = lastGameView(parseFrames(framesOf(page)))
    if (view) {
      const battlefield = opponentBattlefield(view)
      seen.goblin =
        seen.goblin ||
        Object.values(battlefield).some((p) => p.name === 'Raging Goblin' || p.displayName === 'Raging Goblin')
      const combat = (view.combat ?? []) as Array<Record<string, unknown>>
      seen.attack =
        seen.attack ||
        combat.some((group) => {
          const attackers = group.attackers
          return (Array.isArray(attackers) && attackers.length > 0) || (!!attackers && typeof attackers === 'object' && Object.keys(attackers).length > 0)
        })
      const life = controlledPlayer(view)?.life
      seen.damaged = seen.damaged || (typeof life === 'number' && life < 20)
    }
    if (seen.transform !== QUARTER_TURN) {
      const transform = await page.evaluate(() => {
        const slot = document.querySelector<HTMLElement>('.card-slot.tapped[data-card-name="Raging Goblin"]')
        return slot ? getComputedStyle(slot).transform : null
      })
      if (transform !== null) {
        seen.tapped = true
        seen.transform = transform
      }
    }
    if (seen.goblin && seen.attack && seen.damaged && seen.transform === QUARTER_TURN) return seen
    await page.waitForTimeout(150)
  }
  return seen
}

function assertCombat(seen: CombatSeen) {
  expect(seen.goblin, 'el Sim debería lanzar el Raging Goblin (criatura en su campo)').toBeTruthy()
  expect(seen.attack, 'el Sim debería declarar atacantes (combate con atacantes)').toBeTruthy()
  expect(seen.damaged, 'el daño de combate debería bajar la vida del humano por debajo de 20').toBeTruthy()
  expect(seen.tapped, 'el atacante debería verse girado (clase tapped en su CardSlot) durante el combate').toBeTruthy()
}

test('CMB-3: the Sim casts a creature and attacks, the attacker is drawn tapped and the damage lowers life', { tag: ['@combat', '@timing'] }, async ({ page }) => {
  await withFakeServer(() => combatScenario(), async () => {
    const { frames, pageErrors } = await quickStartGame(page, {
      prefix: 'cb',
      tableName: TABLE.combat,
      // mazo humano solo tierras: la partida no avanza sola (nada que lanzar) y el
      // Sim (tierras + Raging Goblin) ataca; el helper pasa las prioridades
      ...(FAKE_MODE ? {} : { deck: DECK.lands, simDeck: DECK.combatSim }),
    })
    void frames

    // el Sim juega tierra y lanza el Raging Goblin (mano determinista: 4 Mountain + 2 Goblin),
    // ataca con todo (haste: el mismo turno en que entra) y el daño baja la vida del humano
    const seen = await waitForSimCombat(page)
    assertCombat(seen)

    // La clase `tapped` debe traducirse en rotación REAL: el transform computado
    // no puede quedar en identidad. (Regresión 2026-09-01: `entering` clavado +
    // fill forwards de cardAppear pisaba `.tapped` con transform identidad en dev.)
    expect(seen.transform, `el atacante debería estar rotado 90° (transform computado: ${seen.transform})`).toBe(QUARTER_TURN)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})