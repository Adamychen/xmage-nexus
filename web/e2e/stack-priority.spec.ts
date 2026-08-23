import { expect, test } from '@playwright/test'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { stackPriorityScenario } from '../fixtures/scenarios/stackPriority'
import { SIM_PLAYER_ID } from '../fixtures/humanGameConstants'

test.describe('Pila, Disparos y Prioridad Avanzada (Bloque B)', () => {
  test('Hold Priority, APNAP Trigger Stacking y Tormenta con copias @spells', async ({ page }) => {
    test.setTimeout(45_000)

    await withFakeServer(() => stackPriorityScenario(), async () => {
      const { pageErrors, helper } = await startGame(page, {
        prefix: 'stk',
        tableName: 'stack-priority-test',
      })

      const board = page.locator('.game-board')
      await expect(board).toBeVisible({ timeout: 10_000 })

      // ─────────────────────────────────────────────────────────────
      // ETAPA 1: Retención de Prioridad (Hold Priority)
      // ─────────────────────────────────────────────────────────────

      // 1.1 Validar toggle de Hold Priority en la barra de controles
      const holdPriorityToggle = page.locator('.hold-priority-toggle input')
      await expect(holdPriorityToggle, 'toggle de Retener Prioridad visible').toBeVisible({ timeout: 10_000 })
      await holdPriorityToggle.check()

      await page.screenshot({ path: 'e2e/shots/stack-priority-01-hold-priority-toggle.png' })

      // 1.2 Lanzar Infernal Tutor con prioridad retenida
      expect(await helper.playCard('card-tutor')).toBeTruthy()

      // 1.3 Comprobar que Infernal Tutor está en la pila y la prioridad sigue activa para el jugador
      const stackZone = page.locator('.stack-zone')
      await expect(stackZone, 'pila visible con Infernal Tutor').toBeVisible({ timeout: 10_000 })
      await expect(page.locator('.stack-item, .stack-card-entry', { hasText: 'Infernal Tutor' })).toBeVisible({ timeout: 10_000 })

      await page.screenshot({ path: 'e2e/shots/stack-priority-02-spell-on-stack-holding.png' })

      // 1.4 Responder a tu propio hechizo lanzando Lion's Eye Diamond
      expect(await helper.playCard('card-led')).toBeTruthy()

      // 1.5 Comprobar que ambos hechizos están en la pila simultáneamente
      await expect(page.locator('.stack-item, .stack-card-entry', { hasText: "Lion's Eye Diamond" })).toBeVisible({ timeout: 10_000 })

      await page.screenshot({ path: 'e2e/shots/stack-priority-03-stacked-spells-in-response.png' })

      // ─────────────────────────────────────────────────────────────
      // ETAPA 2: Ordenación de Disparos Múltiples Simultáneos (APNAP)
      // ─────────────────────────────────────────────────────────────

      // 2.1 Esperar el modal de elección de orden de disparos
      const abilityDialog = page.locator('.feedback-dialog.choose-ability, .feedback-dialog')
      await expect(abilityDialog, 'diálogo de orden de disparos APNAP visible').toBeVisible({ timeout: 10_000 })
      await expect(abilityDialog).toContainText('APNAP')

      const choiceBtn = abilityDialog.locator('button', { hasText: 'Soul Warden' }).first()
      await expect(choiceBtn).toBeVisible({ timeout: 10_000 })

      await page.screenshot({ path: 'e2e/shots/stack-priority-04-apnap-trigger-ordering.png' })

      // 2.2 Seleccionar el orden y validar resolución de vida (humano 21, rival 19)
      await choiceBtn.click()

      const humanLife = page.locator('.pz-bottom-row .life-value')
      await expect(humanLife).toContainText('21', { timeout: 10_000 })

      // ─────────────────────────────────────────────────────────────
      // ETAPA 3: Tormenta (Storm) y Copias en la Pila con Re-targeting
      // ─────────────────────────────────────────────────────────────

      // 3.1 Lanzar Grapeshot con Storm count=2
      expect(await helper.playCard('card-grapeshot')).toBeTruthy()

      // 3.2 Verificar que el prompt de objetivo para las copias aparece
      const targetPrompt = page.locator('.feedback-dialog, .targeting-bar')
      await expect(targetPrompt, 'prompt de selección de objetivo para copia de tormenta').toBeVisible({ timeout: 10_000 })

      await page.screenshot({ path: 'e2e/shots/stack-priority-05-storm-copies-targeting.png' })

      // 3.3 Elegir al oponente como objetivo de la copia
      expect(await helper.playCard(SIM_PLAYER_ID)).toBeTruthy()

      // 3.4 Validar daño total de las 3 copias/original (vida del rival de 19 a 16)
      const oppLife = page.locator('.oz-top-row .life-value')
      await expect(oppLife).toContainText('16', { timeout: 10_000 })

      // ─────────────────────────────────────────────────────────────
      // Validación final de cero errores
      // ─────────────────────────────────────────────────────────────
      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    })
  })
})
