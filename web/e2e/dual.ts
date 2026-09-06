/**
 * Modo dual de los E2E: el MISMO spec corre contra dos backends.
 * - fake (por defecto, E2E_BACKEND != 'real'): FixtureServer determinista en
 *   puerto dedicado (8789; 8788 es la página HTTP del proxy Java). Segundos, sin Java, sin flakes.
 * - real (E2E_BACKEND=real): proxy + servidor XMage reales (contrato, puerto 8787).
 * El fake se arranca por worker (e2e/fixtures.ts) y el real es el stack
 * (node scripts/ctl.mjs start).
 */

export const FAKE_MODE = (process.env.E2E_BACKEND || '').trim() !== 'real'

import { getFakePort } from './support/fake-port'

export const BACKEND_HOST = 'localhost'
/** Puerto del FixtureServer en fake. OJO: NO usar 8788 — es la página HTTP del
 *  proxy Java (Mage.Proxy), que la ocupa siempre que el stack está arriba. */
export const BACKEND_PORT = 8789

/** Puerto del proxy WS al que se conectan la página (?proxyPort=) y el
 *  HumanHelper. En fake es DINÁMICO (cada withFakeServer elige un puerto libre
 *  vía setFakePort; el fijo 8789 solo lo usa el servidor compartido por worker
 *  de fixtures.ts); en real es el proxy del stack (8787). Función (no const)
 *  para leer el puerto vigente en el momento del goto. */
export function proxyPort(): number {
  return FAKE_MODE ? getFakePort() : 8787
}

export function backendUrl(): string {
  return `ws://${BACKEND_HOST}:${BACKEND_PORT}`
}
