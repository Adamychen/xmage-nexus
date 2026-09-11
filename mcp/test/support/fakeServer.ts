export interface FakeConn {
  readonly id: number
  event(method: string, data: unknown, objectId?: string | null): void
  broadcast(method: string, data: unknown, objectId?: string | null): void
  ok(requestId: string | number, action: string, data?: unknown): void
  fail(requestId: string | number, action: string, error: string, errorCode?: string): void
  lobby(tables: unknown[], users?: unknown[]): void
  raw(obj: unknown): void
  isOpen(): boolean
  close(): void
}

export interface Scenario {
  onAction?(conn: FakeConn, action: string, args: Record<string, unknown>, requestId: string | number): void
  onConnect?(conn: FakeConn): void
  onStart?(conn: FakeConn): (() => void) | void
}

export interface FakeServerInstance {
  port: number
  connectedConns: number
  stop(): Promise<void>
}

interface FakeModule {
  FakeServer: {
    start(port: number, makeScenario: () => Scenario): Promise<FakeServerInstance>
  }
  makeBaseScenario(options: Record<string, unknown>): Scenario
  makeTable(options: Record<string, unknown>): unknown
}

let cached: Promise<FakeModule> | null = null

export function loadFake(): Promise<FakeModule> {
  cached ??= import(new URL('../../../web/fixtures/fake.ts', import.meta.url).href) as Promise<FakeModule>
  return cached
}

export interface FakeServerHandle {
  url: string
  port: number
  server: FakeServerInstance
  stop(): Promise<void>
}

export async function startFakeServer(makeScenario: () => Scenario): Promise<FakeServerHandle> {
  const { FakeServer } = await loadFake()
  const server = await FakeServer.start(0, makeScenario)
  return {
    port: server.port,
    url: `ws://127.0.0.1:${server.port}`,
    server,
    stop: () => server.stop(),
  }
}
