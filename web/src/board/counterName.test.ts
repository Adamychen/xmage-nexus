import { describe, expect, it } from 'vitest'
import { counterName, counterTip } from './counterName'

describe('counter names', () => {
  it('BRD-46: the plus and minus counters are named the way the cards print them', () => {
    expect(counterName('P1P1')).toBe('+1/+1')
    expect(counterName('p1p1')).toBe('+1/+1')
    expect(counterName('M1M1')).toBe('-1/-1')
    expect(counterName('+1/+1')).toBe('+1/+1')
    expect(counterTip('P1P1', 2)).toBe('+1/+1: 2')
  })

  it('BRD-46: any other counter keeps its word, capitalised', () => {
    expect(counterName('lore')).toBe('Lore')
    expect(counterName('oil')).toBe('Oil')
    expect(counterName('time travel')).toBe('Time Travel')
    expect(counterName('')).toBe('')
  })
})
