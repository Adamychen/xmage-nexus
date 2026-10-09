import { describe, expect, it } from 'vitest'
import { normalizePrioritySound } from './prioritySound'

describe('normalizePrioritySound', () => {
  it('defaults to every-prompt', () => {
    expect(normalizePrioritySound(undefined)).toBe('every-prompt')
    expect(normalizePrioritySound(null)).toBe('every-prompt')
    expect(normalizePrioritySound('nope')).toBe('every-prompt')
    expect(normalizePrioritySound(0)).toBe('every-prompt')
  })

  it('keeps each valid mode', () => {
    expect(normalizePrioritySound('every-prompt')).toBe('every-prompt')
    expect(normalizePrioritySound('on-gain')).toBe('on-gain')
    expect(normalizePrioritySound('off')).toBe('off')
  })
})