import { WebSocketServer } from 'ws'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ProxyClient } from '../src/xmage/wsClient.ts'

describe('ProxyClient', () => {
  let wss: WebSocketServer
  let url = ''

  beforeAll(async () => {
    wss = new WebSocketServer({ port: 0 })
    await new Promise<void>((resolve) => wss.once('listening', () => resolve()))
    const address = wss.address()
    const port = typeof address === 'object' && address ? address.port : 0
    url = `ws://127.0.0.1:${port}`
    wss.on('connection', (socket) => {
      socket.on('message', (raw) => {
        const message = JSON.parse(String(raw)) as { requestId: string; action: string; args?: unknown }
        if (message.action === 'boom') {
          socket.send(
            JSON.stringify({
              type: 'result',
              requestId: message.requestId,
              action: message.action,
              ok: false,
              errorCode: 'TEST',
              error: 'boom',
            }),
          )
          return
        }
        socket.send(
          JSON.stringify({
            type: 'result',
            requestId: message.requestId,
            action: message.action,
            ok: true,
            data: { echo: message.args },
          }),
        )
        socket.send(
          JSON.stringify({ type: 'event', method: 'GAME_UPDATE', objectId: 'game-1', data: { gameView: { turn: 3 } } }),
        )
      })
    })
  })

  afterAll(async () => {
    for (const socket of wss.clients) socket.terminate()
    await new Promise<void>((resolve) => wss.close(() => resolve()))
  })

  it('correlates results by requestId and emits events', async () => {
    const client = new ProxyClient(url)
    await client.open()
    const events: { method?: string; objectId?: string | null }[] = []
    client.on('event', (event) => events.push(event))
    const data = await client.requestOk('getTables', { a: 1 })
    expect(data).toEqual({ echo: { a: 1 } })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(events[0]?.method).toBe('GAME_UPDATE')
    expect(events[0]?.objectId).toBe('game-1')
    client.close()
  })

  it('throws on failed results with error code', async () => {
    const client = new ProxyClient(url)
    await client.open()
    await expect(client.requestOk('boom')).rejects.toThrow(/\[TEST\]: boom/)
    client.close()
  })

  it('rejects requests when not connected', async () => {
    const client = new ProxyClient(url)
    await expect(client.requestOk('getTables')).rejects.toThrow(/no conectado/)
  })
})
