import { cpus } from 'node:os'
import { defineConfig } from '@playwright/test'

const FAKE_MODE = process.env.E2E_BACKEND !== 'real'

// fake: cada FixtureServer arranca en puerto dinámico (ver e2e/fixtures.ts y
// e2e/support/fake-backend.ts), así que los tests son independientes entre sí y
// se pueden repartir entre workers. real: 1 worker serial (el stack es único).
const E2E_WORKERS =
  Number(process.env.E2E_WORKERS) || Math.max(1, Math.min(6, cpus().length - 1))

// Puerto DEDICADO del dev server del e2e fake (misma lección que el puerto
// propio del FixtureServer):
// si el dev server del usuario o el vite del stack ocupan 5173, con
// reuseExistingServer Playwright reutiliza ESE servidor y los specs corren
// contra su gráfico de módulos (HMR stale, UI vieja) fallando de forma
// intermitente. Con puerto propio + strictPort, el e2e siempre parte de un
// server limpio con el código actual. Real sigue en 5173 (el vite del stack).
const E2E_PORT = FAKE_MODE ? Number(process.env.E2E_PORT) || 5175 : 5173

// Matriz navegador × resolución (plan4 §8.1): por defecto Chromium 1600×900
// (el loop diario no cambia). WebKit = motor real de Tauri en macOS.
//   E2E_BROWSER=webkit npm run test:e2e
//   E2E_VIEWPORT=1366x768|1920x1080|2560x1440 npm run test:e2e
const E2E_BROWSER = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium'

function parseViewport(): { width: number; height: number } {
  const m = /^\s*(\d+)\s*x\s*(\d+)\s*$/i.exec(process.env.E2E_VIEWPORT ?? '')
  if (m) return { width: Number(m[1]), height: Number(m[2]) }
  return { width: 1600, height: 900 }
}

// CI runs the fake suite in two lanes. Playwright balances shards by TEST COUNT, and these two
// specs are alphabetical neighbours that cost far more per test than anything else: measured on
// run 43450704089, board-settle is 23.4 min of work over 48 tests and band-fit-classic 12.9 over
// 8, so the shard holding both carried 50.3 min against 20-23 for the other five and took 17.6
// minutes of wall clock against 7.4-9.1. Both files already split their sweeps into blocks at
// describe level; the problem is which shard they land in, not their size.
// E2E_LANE=light ignores them, E2E_LANE=heavy runs only them, and the two lanes together are the
// whole suite (scripts/workflows.test.mjs checks that). Unset, which is every local run and the
// default, means the whole suite exactly as before.
const HEAVY_SPECS = ['**/board-settle.spec.ts', '**/band-fit-classic.spec.ts']
const LANE = process.env.E2E_LANE

export default defineConfig({
  testDir: './e2e',
  testIgnore: LANE === 'light' ? HEAVY_SPECS : undefined,
  testMatch: LANE === 'heavy' ? HEAVY_SPECS : undefined,
  timeout: 120_000,
  fullyParallel: FAKE_MODE,
  workers: FAKE_MODE ? E2E_WORKERS : 1,
  // One retry in CI for the whole fake suite. A flake used to cost a re-push and another full
  // run, because `gh run rerun` needs admin on this repo; 24 of the 35 CI runs that went red on
  // e2e alone were followed by another run on the same branch within six hours. Retried tests are
  // reported as flaky, which is where an intermittent bug stays visible. The @timing lane
  // overrides this with TIMING_RETRIES_IN_CI (e2e/support/timing.ts).
  retries: process.env.CI ? 1 : 0,
  // en modo fake (por defecto) el e2e no depende del stack: vite se levanta solo
  webServer: FAKE_MODE
    ? {
        command: `npm run dev -- --port ${E2E_PORT} --strictPort`,
        url: `http://localhost:${E2E_PORT}`,
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    viewport: parseViewport(),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Los specs seleccionan la UI por texto en español ('Usuario', 'Conectar',
    // 'Empezar'…): sin esto navigator.language (en-US) ponía la i18n en inglés
    // y todo el suite se quedaba colgado en el login.
    locale: 'es-ES',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [{ name: E2E_BROWSER, use: { browserName: E2E_BROWSER } }],
})
