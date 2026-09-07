import { describe, expect, it } from 'vitest'
import {
  addChoiceMemory,
  clearChoiceMemory,
  findChoiceMemory,
  normalizeChoiceQuestion,
  removeChoiceMemory,
} from './choiceMemory'

describe('choiceMemory (pure)', () => {
  it('normalizes questions for comparison', () => {
    expect(normalizeChoiceQuestion('  Choose   a mode? ')).toBe('choose a mode?')
    expect(normalizeChoiceQuestion('PAY 2 LIFE?')).toBe('pay 2 life?')
    expect(normalizeChoiceQuestion('   ')).toBe('')
  })

  it('matches only identical normalized text', () => {
    const rules = addChoiceMemory([], 'Choose a mode?', 'mode-a')
    expect(findChoiceMemory(rules, 'Choose a mode?')?.value).toBe('mode-a')
    expect(findChoiceMemory(rules, 'CHOOSE A MODE?')?.value).toBe('mode-a')
    expect(findChoiceMemory(rules, 'Choose a color?')).toBeUndefined()
    expect(findChoiceMemory([], 'Choose a mode?')).toBeUndefined()
  })

  it('overwrites the stored value for the same question', () => {
    const once = addChoiceMemory([], 'Choose a mode?', 'mode-a')
    const twice = addChoiceMemory(once, 'Choose a mode?', 'mode-b')
    expect(twice).toHaveLength(1)
    expect(findChoiceMemory(twice, 'Choose a mode?')?.value).toBe('mode-b')
  })

  it('caps the rule list and removes by id', () => {
    let rules = addChoiceMemory([], 'Q?', 'v')
    for (let i = 0; i < 60; i++) rules = addChoiceMemory(rules, `Question ${i}?`, `v${i}`)
    expect(rules.length).toBeLessThanOrEqual(50)
    const id = rules[0]?.id ?? ''
    expect(removeChoiceMemory(rules, id)).toHaveLength(rules.length - 1)
    expect(clearChoiceMemory()).toEqual([])
  })
})
