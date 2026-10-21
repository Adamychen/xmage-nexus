/**
 * FixtureServer: implementación determinista del contrato WS del proxy
 * (Mage.Proxy) para los E2E de navegador. Cada test lo arranca en un puerto
 * libre (`FakeServer.start(0)`; el test publica el asignado vía setFakePort) y
 * responde a las acciones de commands.ts con envelopes
 * {type:'result'} y emite callbacks {type:'event'} según un escenario
 * declarativo. Nada de Java, nada de timing real: los tests de UI corren en
 * segundos y son reproducibles al 100%.
 * Tipado contra src/net/types.ts (el typecheck valida la coherencia fake↔cliente).
 */

import { WebSocketServer, WebSocket } from 'ws'
import { FakeServerCore, type FakeServerOptions, type Scenario } from './fakeCore'

export * from './fakeCore'

export class FakeServer {
  private wss!: WebSocketServer
  private core: FakeServerCore
  private assignedPort: number

  constructor(
    private readonly requestedPort: number,
    makeScenario: () => Scenario,
    options: FakeServerOptions = {},
  ) {
    this.assignedPort = requestedPort
    this.core = new FakeServerCore(makeScenario, options)
  }

  /** Real listening port. If requestedPort=0 the OS assigns one. */
  get port(): number {
    return this.assignedPort
  }

  static async start(port: number, makeScenario: () => Scenario, options: FakeServerOptions = {}): Promise<FakeServer> {
    const server = new FakeServer(port, makeScenario, options)
    await server.listen()
    return server
  }

  private listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.requestedPort })
      this.wss.on('error', reject)
      this.wss.on('listening', () => {
        this.wss.removeListener('error', reject)
        this.assignedPort = (this.wss.address() as { port: number }).port
        this.wss.on('error', (err) => {
          console.error(`[fake] server error (port ${this.port}): ${err.message}`)
        })
        resolve()
      })
      this.wss.on('connection', (ws) => {
        const handle = this.core.attach({
          isOpen: () => ws.readyState === WebSocket.OPEN,
          send: (data) => ws.send(data),
          close: () => ws.close(),
        })
        ws.on('close', handle.close)
        ws.on('error', handle.close)
        ws.on('message', (raw: Buffer) => handle.message(raw.toString()))
      })
    })
  }

  async stop(): Promise<void> {
    this.core.shutdown()
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 2000)
      this.wss.close(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  }
}
