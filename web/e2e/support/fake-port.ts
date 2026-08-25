/**
 * Puerto del FixtureServer para los specs que arrancan su PROPIO servidor por
 * test (withFakeServer). Es dinámico: cada test elige un puerto libre para
 * evitar colisiones en TIME_WAIT entre specs fake secuenciales (la causa de las
 * cascadas tipo "reveal falla porque missing-prompts no liberó el 8789").
 * En modo real se ignora (el proxy va por 8787). El default 8789 preserva el
 * comportamiento de los specs que usan el servidor compartido por worker
 * (fixtures.ts, que sigue en 8789 fijo).
 */

let fakePort = 8789

export function getFakePort(): number {
  return fakePort
}

export function setFakePort(port: number): void {
  fakePort = port
}
