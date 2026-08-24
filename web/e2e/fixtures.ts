/**
 * Fixtures de Playwright con el backend dual.
 * - fake: el FixtureServer se arranca con `{ fakeServer }` (full-flow usa el
 *   fixture; los specs de partida humana lo arrancan explícitamente con su
 *   escenario, `FakeServer.start(port, escenario())`). Usa puerto 8788 (dedicado).
 * - real: fakeServer es null (usa el stack: server + proxy + vite, puerto 8787).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect as baseExpect } from '@playwright/test'
import { FakeServer } from '../fixtures/fake'
import { fullFlowScenario } from '../fixtures/scenarios/fullFlow'
import { BACKEND_PORT, FAKE_MODE } from './dual'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

export const test = base.extend<{ fakeServer: FakeServer | null; autoShot: void }>({
  fakeServer: [
    async ({}, use) => {
      if (!FAKE_MODE) {
        await use(null)
        return
      }
      let server: FakeServer
      try {
        server = await FakeServer.start(BACKEND_PORT, () => fullFlowScenario())
      } catch (err) {
        throw new Error(
          `FixtureServer no pudo arrancar en el puerto ${BACKEND_PORT}: ${(err as Error).message}. ` +
            `Asegúrate de que el puerto ${BACKEND_PORT} no esté en uso.`,
        )
      }
      await use(server)
      await server.stop()
    },
    { scope: 'test' },
  ],
  // Fixture automático: captura la pantalla final de CADA test para verificación
  // visual (y un -FAILED si falla). `auto: true` lo ejecuta en el teardown de
  // todos los tests de este tipo (y de los que lo extienden, p.ej. chatTest),
  // de forma fiable en corridas individuales y combinadas.
  autoShot: [
    async ({ page }, use, testInfo) => {
      await use()
      try {
        await fs.promises.mkdir(SHOTS_DIR, { recursive: true })
        const fileStem = path.basename(testInfo.file || 'test', '.spec.ts')
        const safeTitle = String(testInfo.title).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 110)
        const suffix = testInfo.status === 'failed' ? '-FAILED' : ''
        await page.screenshot({ path: path.join(SHOTS_DIR, `${fileStem}__${safeTitle}${suffix}.png`), fullPage: true })
      } catch {
        // nunca fallar el test por un screenshot
      }
    },
    { auto: true },
  ],
})

export const expect = baseExpect
