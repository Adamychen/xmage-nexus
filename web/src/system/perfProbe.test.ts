import { beforeEach, describe, expect, it } from 'vitest'
import { perfClear, perfEntries, perfMark } from './perfProbe'

describe('perfProbe (plan4 §5.4)', () => {
  beforeEach(() => perfClear())

  it('registra kind/name/mono/wall/extra', () => {
    perfMark('click', 'playable', 123.5, { id: 'c-1' })
    const [entry] = perfEntries()
    expect(entry.kind).toBe('click')
    expect(entry.name).toBe('playable')
    expect(entry.mono).toBe(123.5)
    expect(typeof entry.wall).toBe('number')
    expect(entry.extra).toEqual({ id: 'c-1' })
  })

  it('usa performance.now() cuando no se pasa `at`', () => {
    perfMark('ack', 'pass')
    const [entry] = perfEntries()
    expect(entry.mono).toBeGreaterThan(0)
    expect(entry.mono).toBeLessThanOrEqual(performance.now())
  })

  it('buffer circular: conserva las últimas 200 marcas en orden cronológico', () => {
    for (let i = 0; i < 250; i++) perfMark('event', `m-${i}`, i)
    const entries = perfEntries()
    expect(entries).toHaveLength(200)
    expect(entries[0].name).toBe('m-50')
    expect(entries[199].name).toBe('m-249')
  })

  it('clear vacía el buffer', () => {
    perfMark('event', 'GAME_UPDATE')
    perfClear()
    expect(perfEntries()).toEqual([])
  })

  it('publica window.__magePerf en dev', () => {
    expect(typeof window.__magePerf?.mark).toBe('function')
    expect(typeof window.__magePerf?.entries).toBe('function')
    expect(typeof window.__magePerf?.clear).toBe('function')
    window.__magePerf?.mark('ack', 'pending')
    expect(window.__magePerf?.entries().some((e) => e.name === 'pending')).toBe(true)
  })
})
