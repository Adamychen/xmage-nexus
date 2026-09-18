/**
 * Puerto del FixtureServer para los tests que arrancan su PROPIO servidor.
 * Es dinámico: cada test elige un puerto libre (FakeServer.start(0)) para
 * permitir el e2e fake en paralelo y evitar colisiones en TIME_WAIT entre specs.
 * En modo real se ignora (el proxy va por 8787). El default 8789 es solo el
 * fallback para los specs que no arrancan servidor (UI pura, sin WS).
 */

let fakePort = 8789

export function getFakePort(): number {
  return fakePort
}

export function setFakePort(port: number): void {
  fakePort = port
}
