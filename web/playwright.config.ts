import { defineConfig } from '@playwright/test'

const FAKE_MODE = process.env.E2E_BACKEND !== 'real'

// Puerto DEDICADO del e2e fake (misma lección que el 8789 del FixtureServer):
// si el dev server del usuario o el vite del stack ocupan 5173, con
// reuseExistingServer Playwright reutiliza ESE servidor y los specs corren
// contra su gráfico de módulos (HMR stale, UI vieja) fallando de forma
// intermitente. Con puerto propio + strictPort, el e2e siempre parte de un
// server limpio con el código actual. Real sigue en 5173 (el vite del stack).
const E2E_PORT = FAKE_MODE ? 5175 : 5173

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // en modo fake (por defecto) el e2e no depende del stack: vite se levanta solo
  webServer: FAKE_MODE
    ? {
        command: 'npm run dev -- --port 5175 --strictPort',
        url: `http://localhost:${E2E_PORT}`,
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    viewport: { width: 1600, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Los specs seleccionan la UI por texto en español ('Usuario', 'Conectar',
    // 'Empezar'…): sin esto navigator.language (en-US) ponía la i18n en inglés
    // y todo el suite se quedaba colgado en el login.
    locale: 'es-ES',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
})
