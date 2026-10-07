import { describe, expect, it } from 'vitest'
import {
  addAutoAnswer,
  clearAutoAnswers,
  findAutoAnswer,
  normalizeQuestion,
  removeAutoAnswer,
  serverAutoAnswerActions,
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

  it('keeps the server key and matches by it (source name folded to {this})', () => {
    const rules = addAutoAnswer([], 'Use Llanowar Elves ability?', true, 'Use {this} ability?')
    expect(rules[0]).toMatchObject({ pattern: 'use llanowar elves ability?', answer: true, key: 'Use {this} ability?' })
    expect(findAutoAnswer(rules, 'Use Elvish Mystic ability?', 'Use {this} ability?')?.answer).toBe(true)
    expect(findAutoAnswer(rules, 'Use Elvish Mystic ability?')).toBeUndefined()
    const flipped = addAutoAnswer(rules, 'Use Elvish Mystic ability?', false, 'Use {this} ability?')
    expect(flipped).toHaveLength(1)
    expect(flipped[0]?.answer).toBe(false)
  })

  it('mirrors the rules on the server: reset, then one TEXT_YES/NO per keyed rule', () => {
    const rules = addAutoAnswer(addAutoAnswer(addAutoAnswer([], 'Legacy?', true), 'Pay {1}?', false, 'Pay {1}?'), 'Draw?', true, 'Draw?')
    expect(serverAutoAnswerActions(rules)).toEqual([
      { action: 'REQUEST_AUTO_ANSWER_RESET_ALL', data: null },
      { action: 'REQUEST_AUTO_ANSWER_TEXT_NO', data: 'Pay {1}?' },
      { action: 'REQUEST_AUTO_ANSWER_TEXT_YES', data: 'Draw?' },
    ])
    expect(serverAutoAnswerActions([])).toEqual([{ action: 'REQUEST_AUTO_ANSWER_RESET_ALL', data: null }])
  })
})
