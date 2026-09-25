import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { fireEvent, render } from '@testing-library/react'
import CardSlot from './CardSlot'
import type { PermanentView } from '../net/types'
import { t } from '../i18n'

vi.mock('./cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

vi.mock('../cards/cardImages', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../cards/cardImages')>()
  return { ...mod, awaitImageUrl: vi.fn(async () => 'https://cards.scryfall.io/normal/front/a/b/ab.jpg?1') }
})

const perm = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    name: 'Forest',
    expansionSetCode: 'DMU',
    cardNumber: '281',
    cardTypes: ['LAND'],
    subTypes: ['FOREST'],
    rules: ['{T}: Add {G}.'],
    ...over,
  }) as unknown as PermanentView

describe('CardSlot compact tile', () => {
  it('shows the art crop with name, type and the mana it produces', async () => {
    const { container } = render(<CardSlot card={perm()} compact />)
    await act(async () => {})
    const slot = container.querySelector('.card-slot')!
    expect(slot.classList.contains('is-compact')).toBe(true)
    expect(container.querySelector('img.card-art-crop')?.getAttribute('src')).toBe(
      'https://cards.scryfall.io/art_crop/front/a/b/ab.jpg?1',
    )
    expect(container.querySelector('.compact-name')?.textContent).toBe('Forest')
    expect(container.querySelector('.compact-type')?.textContent).toBe(t('game', 'type_land'))
    expect(container.querySelector('[data-testid="compact-mana-source"]')?.getAttribute('data-mana')).toBe('G')
  })

  it('falls back to the full image when the art crop fails to load', async () => {
    const { container } = render(<CardSlot card={perm()} compact />)
    await act(async () => {})
    fireEvent.error(container.querySelector('img.card-art-crop')!)
    expect(container.querySelector('img.card-art-fallback')?.getAttribute('src')).toBe(
      'https://cards.scryfall.io/normal/front/a/b/ab.jpg?1',
    )
  })

  it('puts the P/T in place of the type for creatures', async () => {
    const bear = perm({ name: 'Grizzly Bears', cardTypes: ['CREATURE'], subTypes: ['BEAR'], rules: [], power: '2', toughness: '2' })
    const { container } = render(<CardSlot card={bear} compact showPt />)
    await act(async () => {})
    expect(container.querySelector('.pt-badge')?.textContent).toBe('2/2')
    expect(container.querySelector('.compact-type')).toBeNull()
    expect(container.querySelector('.compact-plate.has-stat')).not.toBeNull()
    expect(container.querySelector('[data-testid="compact-mana-source"]')).toBeNull()
  })

  it('renders the classic card when compact is off', async () => {
    const { container } = render(<CardSlot card={perm()} />)
    await act(async () => {})
    expect(container.querySelector('.is-compact')).toBeNull()
    expect(container.querySelector('.compact-plate')).toBeNull()
    expect(container.querySelector('img.card-image')?.getAttribute('src')).toBe(
      'https://cards.scryfall.io/normal/front/a/b/ab.jpg?1',
    )
  })
})
