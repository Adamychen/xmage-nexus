// @vitest-environment jsdom
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import CardSlot from './CardSlot'
import type { PermanentView } from '../net/types'
import { setState, setSetting } from '../state/store'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

vi.mock('../cards/cardImages', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../cards/cardImages')>()
  return { ...mod, awaitImageUrl: vi.fn(async () => 'https://img.test/art.jpg') }
})

const hidden = (controllerId: string) =>
  ({ id: 'c1', name: '', faceDown: true, controllerId, cardTypes: ['Creature'] }) as unknown as PermanentView

function seat(declared?: string) {
  setState({
    game: makeGameView({
      myPlayerId: 'me',
      players: [
        makePlayer({ playerId: 'me', name: 'Me', controlled: true }),
        makePlayer({ playerId: 'rival', name: 'Rival', ...(declared ? { userData: { userIdStr: declared } } : {}) }),
      ],
    }) as never,
  })
}

function sleeveOf(controllerId: string): string | null | undefined {
  const { container } = render(<CardSlot card={hidden(controllerId)} faceDown />)
  return container.querySelector('[data-sleeve-id]')?.getAttribute('data-sleeve-id')
}

describe('the card back each seat is drawn with', () => {
  beforeEach(() => {
    setSetting('sleeveId', 'midnight')
  })
  afterEach(() => {
    setSetting('sleeveId', 'classic')
    setState({ game: null, gameId: null })
    cleanup()
  })

  it('APR-6: a rival is drawn with the sleeve they declared, and I with mine', () => {
    seat('nxs1;slv=nebula')
    expect(sleeveOf('rival')).toBe('nebula')
    expect(sleeveOf('me')).toBe('midnight')
  })

  it('APR-6: a seat that declares nothing keeps the classic back', () => {
    seat()
    expect(sleeveOf('rival')).toBe('classic')
  })

  it('APR-6: a seat that declares a sleeve this client cannot draw keeps the classic back', () => {
    seat('nxs1;slv=custom')
    expect(sleeveOf('rival')).toBe('classic')
  })
})
