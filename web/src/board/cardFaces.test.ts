import { describe, expect, it } from 'vitest'
import { activeCardFace } from './cardFaces'
import type { CardView, PermanentView } from '../net/types'

const card = (over: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    name: 'Delver of Secrets',
    displayName: 'Delver of Secrets',
    rules: [],
    cardTypes: [],
    ...over,
  }) as unknown as CardView

describe('activeCardFace', () => {
  it('returns the front face by default', () => {
    const front = activeCardFace(card(), false)
    expect(front.name).toBe('Delver of Secrets')
    expect((front as unknown as { isFrontFace?: boolean }).isFrontFace).toBe(true)
  })

  it('returns the second face when flipping a double-faced card', () => {
    const dfc = card({
      secondCardFace: {
        id: 'b1',
        name: 'Insectile Aberration',
        displayName: 'Insectile Aberration',
      },
      transformable: true,
    })
    const back = activeCardFace(dfc, true)
    expect(back.name).toBe('Insectile Aberration')
    expect((back as unknown as { isSecondCardFace?: boolean }).isSecondCardFace).toBe(true)
  })

  it('shows the current side of a transformed permanent and flips to the front', () => {
    const perm = {
      id: 'p1',
      name: 'Delver of Secrets',
      displayName: 'Delver of Secrets',
      transformed: true,
      secondCardFace: { id: 'b1', name: 'Insectile Aberration', displayName: 'Insectile Aberration' },
    } as unknown as PermanentView

    expect(activeCardFace(perm, false).name).toBe('Insectile Aberration')
    expect(activeCardFace(perm, true).name).toBe('Delver of Secrets')
  })

  it('substitutes the hidden face-down name and clears its printing identity', () => {
    const morph = card({
      name: 'Morph: Den Protector',
      displayName: 'Morph: Den Protector',
      faceDown: true,
      expansionSetCode: 'XMAGE',
      cardNumber: '0',
    })
    const resolved = activeCardFace(morph, false)
    expect(resolved.name).toBe('Den Protector')
    expect((resolved as unknown as { faceDown?: boolean }).faceDown).toBe(false)
    expect((resolved as unknown as { expansionSetCode?: string }).expansionSetCode).toBe('')
  })
})
