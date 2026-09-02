import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { login, createTable, dismissStaging } from './support/start-game'
import { FAKE_MODE } from './dual'

// Un mismo proxy debe servir a dos cuentas XMage independientes a la vez.
// Requiere el stack real (server + proxy) y el web server (vite) levantados:
//   E2E_BACKEND=real E2E_SERVER_HOST=localhost E2E_SERVER_PORT=17171 npx playwright test multi-user.spec.ts
test.skip(FAKE_MODE, 'multi-user solo corre contra el stack real (dos cuentas distintas)')

test.describe('multi-user: dos cuentas en un mismo proxy', () => {
  let ctxA: BrowserContext
  let ctxB: BrowserContext
  let pageA: Page
  let pageB: Page

  const stamp = Date.now().toString().slice(-8)
  const userA = `muA${stamp}`
  const userB = `muB${stamp}`

  test.beforeAll(async ({ browser }) => {
    ctxA = await browser.newContext()
    ctxB = await browser.newContext()
    pageA = await ctxA.newPage()
    pageB = await ctxB.newPage()
  })

  test.afterAll(async () => {
    await ctxA?.close()
    await ctxB?.close()
  })

  test(
    'dos usuarios entran y uno ve la mesa del otro (sesiones aisladas, mismo server)',
    { tag: '@multiuser' },
    async () => {
      await login(pageA, userA)
      await login(pageB, userB)

      // Ambos llegan al lobby: cada uno es una sesión propia en el mismo proxy.
      await expect(pageA.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible({ timeout: 20_000 })
      await expect(pageB.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible({ timeout: 20_000 })

      // A crea una mesa; B (otra cuenta, otra pestaña) debe verla en su lobby.
      // Prueba que ambas cuentas cuelgan del mismo server vía el mismo proxy, pero
      // con sesiones independientes (multi-tenant).
      const tableName = `mu${stamp}`
      await createTable(pageA, tableName)

      // A (creador + asiento) salta automáticamente a la sala de espera (JOINED_TABLE);
      // paridad con el TableWaitingDialog del cliente desktop.
      await expect(pageA.getByTestId('staging-player-actions')).toBeVisible({ timeout: 20_000 })
      await dismissStaging(pageA)

      const rowInA = pageA.locator('.table-row', { hasText: tableName }).first()
      await expect(rowInA).toBeVisible({ timeout: 20_000 })

      const rowInB = pageB.locator('.table-row', { hasText: tableName }).first()
      await expect(rowInB).toBeVisible({ timeout: 20_000 })
    },
  )
})
