import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardView } from '../net/types'
import { resetCardImageCache } from './cardImages'
import { useCardImageUrl } from './useCardImageUrl'

const pending = new Map<string, Array<(url: string) => void>>()
const resolveAll = (name: string, url: string) => (pending.get(name) ?? []).forEach((resolve) => resolve(url))

vi.mock('./cardImages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cardImages')>()),
  awaitImageUrl: vi.fn((card: CardView) => new Promise<string>((resolve) => {
    pending.set(card.name, [...(pending.get(card.name) ?? []), resolve])
  })),
}))

const card = (name: string, extra: Partial<CardView> = {}): CardView =>
  ({ name, manaValue: 0, expansionSetCode: 'M10', cardNumber: name === 'Bolt' ? '146' : '147', ...extra }) as CardView

describe('useCardImageUrl', () => {
  beforeEach(() => {
    resetCardImageCache()
    pending.clear()
  })

  it('resolves the image for the card key', async () => {
    const { result } = renderHook(() => useCardImageUrl(card('Bolt')))
    expect(result.current).toBeNull()
    await act(async () => resolveAll('Bolt', 'https://img.test/bolt.jpg'))
    expect(result.current).toBe('https://img.test/bolt.jpg')
  })

  it('never shows the previous card image while the next one loads', async () => {
    const { result, rerender } = renderHook(({ c }) => useCardImageUrl(c), { initialProps: { c: card('Bolt') } })
    await act(async () => resolveAll('Bolt', 'https://img.test/bolt.jpg'))
    expect(result.current).toBe('https://img.test/bolt.jpg')

    rerender({ c: card('Shock') })
    expect(result.current).toBeNull()
    await act(async () => resolveAll('Shock', 'https://img.test/shock.jpg'))
    expect(result.current).toBe('https://img.test/shock.jpg')
  })

  it('reloads when only the token variant differs (imageNumber)', async () => {
    const token = (imageNumber: number) =>
      card(`Treasure${imageNumber}`, { isToken: true, imageFileName: 'Treasure', imageNumber, expansionSetCode: 'XLN', cardNumber: '' })
    const { result, rerender } = renderHook(({ c }) => useCardImageUrl(c), { initialProps: { c: token(1) } })
    await act(async () => resolveAll('Treasure1', 'https://img.test/t1.jpg'))
    expect(result.current).toBe('https://img.test/t1.jpg')
    rerender({ c: token(2) })
    expect(result.current).toBeNull()
  })

  it('returns null when disabled (face-down cards)', () => {
    const { result } = renderHook(() => useCardImageUrl(card('Bolt'), false))
    expect(result.current).toBeNull()
  })

  it('gives the board and the stack the same URL for the same card', async () => {
    const board = renderHook(() => useCardImageUrl(card('Bolt')))
    const stack = renderHook(() => useCardImageUrl(card('Bolt')))
    await act(async () => resolveAll('Bolt', 'https://cards.scryfall.io/normal/front/a/b/bolt.jpg'))
    expect(stack.result.current).toBe(board.result.current)
    expect(board.result.current).toContain('/normal/')
  })
})
