import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

class Rpc {
  private buffer = ''
  private readonly waiting = new Map<number, (message: { result?: unknown }) => void>()

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk
      let index = this.buffer.indexOf('\n')
      while (index >= 0) {
        const line = this.buffer.slice(0, index)
        this.buffer = this.buffer.slice(index + 1)
        if (line.trim()) {
          const message = JSON.parse(line) as { id?: number; result?: unknown }
          if (message.id !== undefined) this.waiting.get(message.id)?.(message)
        }
        index = this.buffer.indexOf('\n')
      }
    })
  }

  request(id: number, method: string, params: unknown): Promise<{ result?: unknown }> {
    return new Promise((resolve) => {
      this.waiting.set(id, resolve)
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  }

  notify(method: string): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`)
  }
}

describe('mage-nexus MCP server shutdown', () => {
  let wss: WebSocketServer
  let url = ''
  const children: ChildProcessWithoutNullStreams[] = []
  let closeCodes: number[] = []

  beforeEach(async () => {
    closeCodes = []
    wss = new WebSocketServer({ port: 0 })
    await new Promise<void>((resolve) => wss.once('listening', () => resolve()))
    const address = wss.address()
    url = `ws://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
    wss.on('connection', (socket: WebSocket) => {
      socket.on('close', (code) => closeCodes.push(code))
      socket.on('message', (raw) => {
        const message = JSON.parse(String(raw)) as { requestId: string; action: string }
        socket.send(
          JSON.stringify({
            type: 'result',
            requestId: message.requestId,
            action: message.action,
            ok: true,
            data: message.action === 'connect' ? { serverVersion: 'test' } : null,
          }),
        )
      })
    })
  })

  afterEach(async () => {
    for (const child of children.splice(0)) if (child.exitCode === null) child.kill('SIGKILL')
    for (const socket of wss.clients) socket.terminate()
    await new Promise<void>((resolve) => wss.close(() => resolve()))
  })

  async function startWithOpenSession(): Promise<{ child: ChildProcessWithoutNullStreams; exited: Promise<number | null> }> {
    const child = spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'pipe'] })
    children.push(child)
    const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)))
    const rpc = new Rpc(child)
    await rpc.request(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'shutdown-test', version: '0.0.0' },
    })
    rpc.notify('notifications/initialized')
    const call = await rpc.request(2, 'tools/call', {
      name: 'mage_connect',
      arguments: { proxyUrl: url, host: 'localhost', port: 17171, username: 'mcptest' },
    })
    const text = (call.result as { content: { text: string }[] }).content.map((item) => item.text).join('\n')
    expect(text).toContain('"loggedIn": true')
    return { child, exited }
  }

  const exitWithin = (exited: Promise<number | null>, ms: number) =>
    Promise.race([exited, new Promise<string>((resolve) => setTimeout(() => resolve('still running'), ms))])

  async function proxySawCleanClose(): Promise<void> {
    const started = Date.now()
    while (closeCodes.length === 0 && Date.now() - started < 5_000) await new Promise((resolve) => setTimeout(resolve, 50))
    expect(closeCodes.length).toBeGreaterThan(0)
    expect(closeCodes).not.toContain(1006)
  }

  it('exits when stdin closes while a proxy session is still open', async () => {
    const { child, exited } = await startWithOpenSession()
    child.stdin.end()
    expect(await exitWithin(exited, 5_000)).toBe(0)
    await proxySawCleanClose()
  }, 30_000)

  it('exits cleanly on SIGTERM while a proxy session is still open', async () => {
    const { child, exited } = await startWithOpenSession()
    child.kill('SIGTERM')
    expect(await exitWithin(exited, 5_000)).toBe(0)
    await proxySawCleanClose()
  }, 30_000)
})
