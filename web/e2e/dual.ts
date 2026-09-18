/**
 * Modo dual de los E2E: el MISMO spec corre contra dos backends.
 * - fake (por defecto, E2E_BACKEND != 'real'): FixtureServer determinista en
 *   puerto DINÁMICO elegido por el SO (ver support/fake-port.ts; 8788 está
 *   vetado porque es la página HTTP del proxy Java). Cada test arranca el suyo,
 *   así el e2e fake corre en paralelo sin colisiones.
 * - real (E2E_BACKEND=real): proxy + servidor XMage reales (contrato, puerto 8787).
 * El fake se arranca por test (e2e/fixtures.ts, withFakeServer) y el real es el
 * stack (node scripts/ctl.mjs start).
 */

export const FAKE_MODE = (process.env.E2E_BACKEND || '').trim() !== 'real'

import { getFakePort } from './support/fake-port'

export const BACKEND_HOST = 'localhost'
/** Puerto por defecto del FixtureServer fake cuando ningún test ha publicado
 *  todavía uno dinámico (fallback de getFakePort; los servidores reales del e2e
 *  usan FakeServer.start(0) + setFakePort). OJO: NO usar 8788 — es la página
 *  HTTP del proxy Java (Mage.Proxy), que la ocupa siempre que el stack está arriba. */
export const BACKEND_PORT = 8789

/** Puerto del proxy WS al que se conectan la página (?proxyPort=) y el
 *  HumanHelper. En fake es DINÁMICO (cada test elige un puerto libre vía
 *  setFakePort); en real es el proxy del stack (8787). Función (no const)
 *  para leer el puerto vigente en el momento del goto. */
export function proxyPort(): number {
  return FAKE_MODE ? getFakePort() : 8787
}

export function backendUrl(): string {
  return `ws://${BACKEND_HOST}:${proxyPort()}`
}
