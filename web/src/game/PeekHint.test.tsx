import { describe, expect, it } from 'vitest'
import { peekHintTop } from './PeekHint'

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect

describe('peekHintTop', () => {
  const hint = rect(1369, 12, 219, 35)

  it('stays in the corner when nothing sits under it', () => {
    expect(peekHintTop(hint, 12, [], null, 900)).toBe(12)
  })

  it('drops below the opponent resource bar it would cover', () => {
    expect(peekHintTop(hint, 12, [rect(1352, 0, 234, 96)], null, 900)).toBe(108)
  })

  it('ignores bars outside its column and bars in the lower half of the screen', () => {
    expect(peekHintTop(hint, 12, [rect(0, 0, 300, 96), rect(1352, 700, 234, 96)], null, 900)).toBe(12)
  })

  it('climbs back above the dialog when the dropped position would cover it', () => {
    const panel = rect(250, 100, 1360, 700)
    expect(peekHintTop(hint, 12, [rect(1352, 0, 234, 96)], panel, 900)).toBe(53)
  })

  it('never leaves the screen when there is no room above the dialog', () => {
    const panel = rect(250, 20, 1360, 860)
    expect(peekHintTop(hint, 12, [rect(1352, 0, 234, 96)], panel, 900)).toBe(12)
  })
})
