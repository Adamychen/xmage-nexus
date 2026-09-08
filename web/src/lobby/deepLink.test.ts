import { describe, it, expect } from 'vitest'
import { parseDeepLink, buildDeepLink, serverLabel } from './deepLink'

describe('parseDeepLink', () => {
  it('devuelve null con hash vacío o sin prefijo', () => {
    expect(parseDeepLink('')).toBeNull()
    expect(parseDeepLink('#')).toBeNull()
    expect(parseDeepLink('#lobby')).toBeNull()
    expect(parseDeepLink('#join')).toBeNull()
    expect(parseDeepLink('#join&foo=1')).toBeNull()
  })

  it('parsea enlace join completo con password y servidor', () => {
    expect(parseDeepLink('#join=abc123&pwd=s3cret&server=beta.xmage.today:17171')).toEqual({
      kind: 'join',
      tableId: 'abc123',
      password: 's3cret',
      serverHost: 'beta.xmage.today',
      serverPort: 17171,
    })
  })

  it('parsea enlace watch sin password', () => {
    expect(parseDeepLink('#watch=table-9&server=localhost:17171')).toEqual({
      kind: 'watch',
      tableId: 'table-9',
      serverHost: 'localhost',
      serverPort: 17171,
    })
  })

  it('acepta formato con slash', () => {
    expect(parseDeepLink('#/join/abc123?server=localhost:17171')).toEqual({
      kind: 'join',
      tableId: 'abc123',
      serverHost: 'localhost',
      serverPort: 17171,
    })
    expect(parseDeepLink('#watch/table-9')).toEqual({ kind: 'watch', tableId: 'table-9' })
  })

  it('ignora un servidor malformado sin tumbar la invitación', () => {
    expect(parseDeepLink('#join=abc&server=nonsense')).toEqual({ kind: 'join', tableId: 'abc' })
    expect(parseDeepLink('#join=abc&server=:17171')).toEqual({ kind: 'join', tableId: 'abc' })
    expect(parseDeepLink('#join=abc&server=host:notaport')).toEqual({ kind: 'join', tableId: 'abc' })
  })

  it('decodifica ids y passwords con caracteres especiales', () => {
    const link = parseDeepLink('#join=mi%20mesa&pwd=a%26b%3Dc')
    expect(link).toEqual({ kind: 'join', tableId: 'mi mesa', password: 'a&b=c' })
  })
})

describe('buildDeepLink', () => {
  it('construye y el roundtrip es estable', () => {
    const original = {
      kind: 'join' as const,
      tableId: 'abc123',
      password: 's3cret',
      serverHost: 'beta.xmage.today',
      serverPort: 17171,
    }
    const built = buildDeepLink(original)
    expect(built.startsWith('#')).toBe(true)
    expect(parseDeepLink(built)).toEqual(original)
  })

  it('omite password y servidor cuando no hay', () => {
    expect(parseDeepLink(buildDeepLink({ kind: 'watch', tableId: 't1' }))).toEqual({
      kind: 'watch',
      tableId: 't1',
    })
  })
})

describe('serverLabel', () => {
  it('formatea host:puerto o null', () => {
    expect(serverLabel({ serverHost: 'h', serverPort: 1 })).toBe('h:1')
    expect(serverLabel({})).toBeNull()
  })
})
