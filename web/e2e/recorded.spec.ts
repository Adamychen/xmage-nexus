import { DECK } from '../fixtures/deck-names'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { replayRecordedScenario, REPLAY_TABLE_NAME } from '../fixtures/scenarios/replay-recorded'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'recorded', 'manifest.json'), 'utf8'),
) as Array<{ file: string; mechanic: string; assert: string; kind?: 'game' | 'construct' | 'tournament' }>

// Solo los frames de partida (kind 'game' o sin kind) se reemiten como
// GAME_INIT en el FakeServer. Los frames de torneo (CONSTRUCT pool,
// tournament Finished) se validan en fixtures/recorded.test.ts (forma real
// del protocolo); su replay en el FakeServer (ConstructScreen con pool real,
// panel de torneo Finished) queda como trabajo futuro — ver plan2 D.20.
const replayable = manifest.filter((e) => (e.kind ?? 'game') === 'game')

// Smoke test anti-deriva: cada frame real grabado se reemite en el FakeServer y
// el web debe pintarlo sin errores. No depende del servidor real ni de beta.
fakeOnly()
test.describe('Recorded real frames (anti-drift smoke)', { tag: '@recorded' }, () => {
  for (const entry of replayable) {
    test(`${entry.mechanic} (${entry.file}) renderiza sin errores`, async ({ page }) => {
      await withFakeServer(() => replayRecordedScenario(entry.file), async () => {
        const { pageErrors } = await startGame(page, {
          prefix: `rec-${entry.mechanic}`,
          tableName: REPLAY_TABLE_NAME,
          deck: DECK.advanced,
        })

        expect(pageErrors).toEqual([])

        // El tablero pinta al menos una carta del humano (salvo fin de partida
        // en mulligan: sin mano/campo, solo el estado de la partida).
        if (entry.assert === 'hasConcedeMulligan' || entry.assert === 'hasTimeoutLoss') {
          // Fin de partida sin concesión explícita de cartas: el jugador
          // controlado ya salió (conceder en mulligan / reloj agotado) y su
          // zona queda vacía.
          await expect(page.locator('[data-testid="game-status"]')).toBeVisible()
          await expect(page.locator('.player-zone .card-slot')).toHaveCount(0)
        } else if (entry.assert === 'firstMulliganFreeSecondCostsCard') {
          // Justo tras el mulligan (turno 1): mano final de 6 (dos mulligans
          // con el primero gratis: 7 − 1 carta al fondo) y el comandante en
          // la zona de mando (el único card-slot del player-zone).
          await expect(page.locator('[data-testid="game-status"]')).toBeVisible()
          await expect(page.getByTestId('hand-bar')).toHaveAttribute('data-hand-count', '6')
          await expect(page.locator('.player-zone .card-slot[data-card-name="Krenko, Mob Boss"]')).toHaveCount(1)
        } else if (entry.assert === 'hasKarnRestart') {
          // Reinicio de Karn: mesa vacía pero mano nueva (7 cartas).
          await expect(page.locator('.hand-zone .card-slot').first()).toBeVisible()
        } else {
          const myCard = page.locator('.player-zone .card-slot').first()
          await expect(myCard).toBeVisible()
        }

        // Sin grupos de attachment heredados (el render de mutate/pila es distinto).
        // Los frames con adjunto propio (aura, Lure forzando bloqueo) se asertan aparte.
        if (entry.assert === 'hasAttachedAura' || entry.assert === 'hasMustBlock' || entry.assert === 'hasTrampleDeathtouch') {
          await expect(page.locator('.card-attachment-group')).not.toHaveCount(0)
        } else {
          await expect(page.locator('.card-attachment-group')).toHaveCount(0)
        }

        if (entry.assert === 'hasMutatedPermanent') {
          await expect(page.locator('.player-zone .card-mutate-pile')).toBeVisible()
          await expect(page.locator('.player-zone .card-mutate-pile .mutate-part')).toHaveCount(2)
        }
        if (entry.assert === 'hasNonMutatedCreature') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Elvish Mystic"]')).toBeVisible()
        }
        if (entry.assert === 'hasCounterOnStack') {
          await expect(page.locator('.stack-zone')).toBeVisible()
          await expect(page.locator('.stack-zone .stack-header-title')).toContainText('(2)')
        }
        if (entry.assert === 'hasTokens') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Goblin Token"]')).toHaveCount(2)
        }
        if (entry.assert === 'hasModalOnStack') {
          await expect(page.locator('.stack-zone')).toBeVisible()
          await expect(page.locator('.stack-zone .stack-header-title')).toContainText('(1)')
        }
        if (entry.assert === 'hasXCostCounters') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Walking Ballista"]')).toBeVisible()
        }
        if (entry.assert === 'hasStackResponse') {
          await expect(page.locator('.stack-zone')).toBeVisible()
          await expect(page.locator('.stack-zone .stack-header-title')).toContainText('(2)')
        }
        if (entry.assert === 'hasDoubleTrigger') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Soul Warden"]')).toHaveCount(2)
        }
        if (entry.assert === 'hasSolemn') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Solemn Simulacrum"]')).toBeVisible()
        }
        if (entry.assert === 'hasConvoke') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Elvish Mystic"]')).toHaveCount(4)
        }
        if (entry.assert === 'hasOverload') {
          await expect(page.locator('.stack-zone')).toBeVisible()
          await expect(page.locator('.stack-zone .stack-header-title')).toContainText('(1)')
        }
        if (entry.assert === 'hasKicker') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Goblin Bushwhacker"]')).toBeVisible()
        }
        if (entry.assert === 'hasClone') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Elvish Mystic"]')).toBeVisible()
        }
        if (entry.assert === 'hasTransform') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Insectile Aberration"]')).toBeVisible()
        }
        if (entry.assert === 'hasAdventure') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Bonecrusher Giant"]')).toBeVisible()
        }
        if (entry.assert === 'hasSplit') {
          await expect(page.locator('.stack-zone')).toBeVisible()
          await expect(page.locator('.stack-zone .stack-header-title')).toContainText('(1)')
        }
        if (entry.assert === 'hasSnowFight') {
          await expect(page.locator('.stack-zone')).toBeVisible()
          await expect(page.locator('.stack-zone .stack-header-title')).toContainText('(1)')
        }
        if (entry.assert === 'hasSplitSecond') {
          await expect(page.locator('.stack-zone')).toBeVisible()
          await expect(page.locator('.stack-zone .stack-header-title')).toContainText('(1)')
        }
        if (entry.assert === 'hasCascade') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Bloodbraid Elf"]')).toBeVisible()
        }
      })
    })
  }
})
