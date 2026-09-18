import { describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { FakeServer, makeBaseScenario } from './fake'

interface Frame {
  type?: string
  method?: string
  action?: string
  requestId?: number
}

function once(ws: WebSocket, predicate: (f: Frame) => boolean, timeoutMs = 4000): Promise<{ frame: Frame; at: number }> {
  return new Promise((resolve, reject) => {
    const onMessage = (raw: Buffer) => {
      const frame = JSON.parse(raw.toString()) as Frame
      if (!predicate(frame)) return
      clearTimeout(timer)
      ws.off('message', onMessage)
      resolve({ frame, at: Date.now() })
    }
    const timer = setTimeout(() => {
      ws.off('message', onMessage)
      reject(new Error('timeout esperando el frame'))
    }, timeoutMs)
    ws.on('message', onMessage)
  })
}

async function connect(server: FakeServer): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}`)
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve())
    ws.on('error', reject)
  })
  return ws
}

const makeScenario = () => makeBaseScenario({ tableId: 't1', tableName: 'delay', gameId: 'g1' })

describe('FakeServer echoDelayMs (plan4 §5.4)', () => {
  it('difiere el eco de eventos y el ok de las acciones de decisión', async () => {
    const server = await FakeServer.start(0, makeScenario, { echoDelayMs: 150 })
    const ws = await connect(server)
    try {
      const sentAt = Date.now()
      const result = once(ws, (f) => f.type === 'result' && f.action === 'sendPlayerUUID')
      const event = once(ws, (f) => f.type === 'event' && f.method === 'GAME_UPDATE')
      ws.send(JSON.stringify({ action: 'sendPlayerUUID', requestId: 7, args: { gameId: 'g1', value: 'x' } }))
      const [okFrame, echoFrame] = await Promise.all([result, event])
      expect(okFrame.at - sentAt).toBeGreaterThanOrEqual(100)
      expect(echoFrame.at - sentAt).toBeGreaterThanOrEqual(100)
    } finally {
      ws.close()
      await server.stop()
    }
  })

  it('sin echoDelayMs el ok y el eco llegan de inmediato', async () => {
    const server = await FakeServer.start(0, makeScenario)
    const ws = await connect(server)
    try {
      const sentAt = Date.now()
      const result = once(ws, (f) => f.type === 'result' && f.action === 'sendPlayerUUID')
      const event = once(ws, (f) => f.type === 'event' && f.method === 'GAME_UPDATE')
      ws.send(JSON.stringify({ action: 'sendPlayerUUID', requestId: 8, args: { gameId: 'g1', value: 'y' } }))
      const [okFrame, echoFrame] = await Promise.all([result, event])
      expect(okFrame.at - sentAt).toBeLessThan(100)
      expect(echoFrame.at - sentAt).toBeLessThan(100)
    } finally {
      ws.close()
      await server.stop()
    }
  })
})
