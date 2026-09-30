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

/** Puerto del proxy WS al que se conectan la página (?proxyPort=) y el
 *  HumanHelper. En fake es DINÁMICO (cada test elige un puerto libre vía
 *  setFakePort); en real es el proxy del stack (8787). Función (no const)
 *  para leer el puerto vigente en el momento del goto. */
export function proxyPort(): number {
  return FAKE_MODE ? getFakePort() : 8787
}
