import { describe, expect, it } from 'vitest'
import {
  addAutoAnswer,
  clearAutoAnswers,
  findAutoAnswer,
  normalizeQuestion,
  removeAutoAnswer,
} from './autoAnswers'

describe('autoAnswers (pure)', () => {
  it('normalizes questions for comparison', () => {
    expect(normalizeQuestion('  ¿Quieres   robar? ')).toBe('¿quieres robar?')
    expect(normalizeQuestion('PAY 2 LIFE?')).toBe('pay 2 life?')
    expect(normalizeQuestion('   ')).toBe('')
  })

  it('matches only identical normalized text', () => {
    const rules = addAutoAnswer([], '¿Quieres robar una carta?', true)
    expect(findAutoAnswer(rules, '¿Quieres robar una carta?')?.answer).toBe(true)
    expect(findAutoAnswer(rules, '¿QUIERES ROBAR UNA CARTA?')?.answer).toBe(true)
    expect(findAutoAnswer(rules, '¿Quieres robar 2 cartas?')).toBeUndefined()
    expect(findAutoAnswer(rules, '¿Pagás 2 vidas?')).toBeUndefined()
    expect(findAutoAnswer([], '¿Quieres robar una carta?')).toBeUndefined()
  })

  it('adds idempotently and updates changed answers', () => {
    const once = addAutoAnswer([], 'Pay?', true)
    expect(addAutoAnswer(once, 'Pay?', true)).toBe(once)
    const updated = addAutoAnswer(once, 'Pay?', false)
    expect(updated).toHaveLength(1)
    expect(updated[0]?.answer).toBe(false)
    expect(addAutoAnswer(once, '   ', true)).toBe(once)
  })

  it('removes single rules and clears all', () => {
    const rules = addAutoAnswer(addAutoAnswer([], 'A?', true), 'B?', false)
    const id = rules[0]?.id ?? ''
    expect(removeAutoAnswer(rules, id)).toHaveLength(1)
    expect(clearAutoAnswers()).toEqual([])
  })
})
