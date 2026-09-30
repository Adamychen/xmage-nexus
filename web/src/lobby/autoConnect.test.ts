import { describe, expect, it } from 'vitest'
import { parseAutoConnect } from './autoConnect'

describe('parseAutoConnect', () => {
  it('devuelve vacío sin parámetros', () => {
    expect(parseAutoConnect('')).toEqual({})
  })

  it('lee proxyPort suelto (compatibilidad con los e2e)', () => {
    const parsed = parseAutoConnect('?proxyPort=8789')
    expect(parsed.proxyPort).toBe(8789)
    expect(parsed.proxyHost).toBeUndefined()
  })

  it('separa host y puerto de proxy=host:port', () => {
    const parsed = parseAutoConnect('?proxy=abc.playit.gg:61101')
    expect(parsed.proxyHost).toBe('abc.playit.gg')
    expect(parsed.proxyPort).toBe(61101)
  })

  it('acepta una URL wss completa como host del proxy', () => {
    const parsed = parseAutoConnect('?proxy=wss://nexus.example.com/ws')
    expect(parsed.proxyHost).toBe('wss://nexus.example.com/ws')
    expect(parsed.proxyPort).toBeUndefined()
  })

  it('el puerto explícito gana al de la URL', () => {
    const parsed = parseAutoConnect('?proxy=wss://nexus.example.com:9443&proxyPort=8443')
    expect(parsed.proxyHost).toBe('wss://nexus.example.com:9443')
    expect(parsed.proxyPort).toBe(8443)
  })

  it('lee server=host:port y serverPort', () => {
    const withPort = parseAutoConnect('?server=beta.xmage.today:17172')
    expect(withPort.serverHost).toBe('beta.xmage.today')
    expect(withPort.serverPort).toBe(17172)

    const override = parseAutoConnect('?server=beta.xmage.today&serverPort=17173')
    expect(override.serverHost).toBe('beta.xmage.today')
    expect(override.serverPort).toBe(17173)
  })

  it('lee username', () => {
    const parsed = parseAutoConnect('?username=planeswalker')
    expect(parsed.username).toBe('planeswalker')
  })

  it('ignora puertos fuera de rango', () => {
    const parsed = parseAutoConnect('?proxy=host:99999')
    expect(parsed.proxyHost).toBe('host')
    expect(parsed.proxyPort).toBeUndefined()
  })
})
