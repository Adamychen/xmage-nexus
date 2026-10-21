/**
 * Fixtures de Playwright con el backend dual.
 * - fake: el FixtureServer se arranca con `{ fakeServer }` (full-flow usa el
 *   fixture; los specs de partida humana lo arrancan explícitamente con su
 *   escenario, `FakeServer.start(0, escenario())`). Puerto DINÁMICO (el SO
 *   asigna uno libre) y se publica con setFakePort para que la página y el
 *   helper WS naveguen al mismo; así el e2e fake corre en paralelo.
 * - real: fakeServer es null (usa el stack: server + proxy + vite, puerto 8787).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect as baseExpect } from '@playwright/test'
import { FakeServer } from '../fixtures/fake'
import { fullFlowScenario } from '../fixtures/scenarios/fullFlow'
import { FAKE_MODE } from './dual'
import { getFakePort, setFakePort } from './support/fake-port'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

export const test = base.extend<{ fakeServer: FakeServer | null; autoShot: void }>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        if (!window.localStorage.getItem('mage-web-appearance')) {
          window.localStorage.setItem('mage-web-appearance', JSON.stringify({ gameUi: 'v1' }))
        }
      } catch {
        // storage unavailable: the app default applies
      }
    })
    await use(page)
  },
  fakeServer: [
    async ({}, use) => {
      if (!FAKE_MODE) {
        await use(null)
        return
      }
      let server: FakeServer
      try {
        server = await FakeServer.start(0, () => fullFlowScenario())
      } catch (err) {
        throw new Error(`FixtureServer no pudo arrancar (puerto dinámico): ${(err as Error).message}`)
      }
      const previousPort = getFakePort()
      setFakePort(server.port)
      try {
        await use(server)
      } finally {
        try {
          await server.stop()
        } finally {
          setFakePort(previousPort)
        }
      }
    },
    { scope: 'test' },
  ],
  // Automatic fixture: captures the final screen of EVERY test for visual review
  // (and a -FAILED one when it fails). `auto: true` runs it in the teardown of every
  // test of this type (and of those extending it, e.g. chatTest). In CI only the
  // failures are captured: a fullPage shot costs ~0.8 s per test.
  autoShot: [
    async ({ page }, use, testInfo) => {
      await use()
      if (process.env.CI && testInfo.status !== 'failed') return
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
