import { FakeServerCore, type FakeSocketHandle } from '../../fixtures/fakeCore'
import { demoScenario } from './scenarios'
import { presentFrame } from './data'

let core: FakeServerCore | null = null

function server(): FakeServerCore {
  if (!core) core = new FakeServerCore(() => demoScenario())
  return core
}

const CONNECTING = 0
const OPEN = 1
const CLOSED = 3

export class DemoSocket {
  static readonly CONNECTING = CONNECTING
  static readonly OPEN = OPEN
  static readonly CLOSED = CLOSED
  readyState = CONNECTING
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  private handle: FakeSocketHandle | null = null

  constructor() {
    queueMicrotask(() => {
      if (this.readyState !== CONNECTING) return
      this.readyState = OPEN
      this.handle = server().attach({
        isOpen: () => this.readyState === OPEN,
        send: (data) => setTimeout(() => this.onmessage?.({ data: presentFrame(data) } as MessageEvent), 0),
        close: () => this.finish(),
      })
      this.onopen?.(new Event('open'))
    })
  }

  send(data: string) {
    if (this.readyState !== OPEN) throw new Error('DemoSocket is not open')
    const handle = this.handle
    setTimeout(() => handle?.message(data), 0)
  }

  close() {
    this.finish()
  }

  private finish() {
    if (this.readyState === CLOSED) return
    this.readyState = CLOSED
    this.handle?.close()
    this.handle = null
    this.onclose?.({ code: 1000, reason: '' } as CloseEvent)
  }
}
