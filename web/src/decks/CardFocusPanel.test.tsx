import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CardFocusPanel, type CardFocusPanelProps } from './CardFocusPanel'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import type { DeckPile } from './stackPiles'
import { resetCustomCardArtCache, setCustomCardArtDataUrl } from '../cards/customCardArt'
import { t } from '../i18n'

const confirmMock = vi.fn(async (_msg: string) => true)
vi.mock('../ui/confirmDialog', () => ({
  confirmDialog: (msg: string) => confirmMock(msg),
}))

const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 1 }
const boltMeta: CardStripMeta = {
  imageUrl: 'https://img.example/bolt.jpg',
  artCropUrl: null,
  backImageUrl: null,
  manaCost: '{R}',
  cmc: 1,
  typeLine: 'Instant',
  rarity: 'common',
  colors: ['R'],
}

const piles: DeckPile[] = [
  { id: 'p1', label: 'Removal' },
  { id: 'p2', label: 'Lands' },
]

function props(overrides: Partial<CardFocusPanelProps> = {}): CardFocusPanelProps {
  const fn = () => {}
  return {
    card: bolt,
    meta: boltMeta,
    zone: 'main',
    inMain: 1,
    inSide: 0,
    isCommanderFormat: false,
    isCommander: false,
    isPartner: false,
    canBeCommander: true,
    isCover: false,
    onDec: fn,
    onInc: fn,
    onRemoveAll: fn,
    onSwapZone: fn,
    onChangePrinting: fn,
    onSetCover: fn,
    onSetCommander: fn,
    onSetPartner: fn,
    onMoveToPile: fn,
    onNewPile: fn,
    ...overrides,
  }
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement
}

describe('CardFocusPanel', () => {
  afterEach(() => {
    cleanup()
    confirmMock.mockClear()
    resetCustomCardArtCache()
  })

  it('DCK-10: shows the card image, name, type line, rarity, mana value and the counts in each zone', () => {
    render(<CardFocusPanel {...props({ inMain: 3, inSide: 1 })} />)
    expect(screen.getByRole('img', { name: 'Lightning Bolt' }).getAttribute('src')).toBe('https://img.example/bolt.jpg')
    expect(screen.getByRole('heading', { name: 'Lightning Bolt' })).toBeTruthy()
    expect(screen.getByText('Instant')).toBeTruthy()
    expect(screen.getByText(t('decks', 'pile_cmc', { n: 1 }))).toBeTruthy()
    expect(screen.getByText(t('decks', 'rarity_common'))).toBeTruthy()
    expect(screen.getByText(t('decks', 'focus_counts', { main: 3, side: 1 }))).toBeTruthy()
  })

  it('DCK-10: shows the custom card art before the Scryfall image', async () => {
    setCustomCardArtDataUrl('Lightning Bolt', 'data:image/jpeg;base64,AAAA')
    render(<CardFocusPanel {...props()} />)
    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Lightning Bolt' }).getAttribute('src')).toBe('data:image/jpeg;base64,AAAA')
    })
  })

  it('DCK-10: a double-faced card flips to its back face with the flip button', () => {
    const dfc: CardStripMeta = { ...boltMeta, backImageUrl: 'https://img.example/back.jpg' }
    render(<CardFocusPanel {...props({ meta: dfc })} />)
    expect(screen.getByRole('img', { name: 'Lightning Bolt' }).getAttribute('src')).toBe('https://img.example/bolt.jpg')
    fireEvent.click(button(t('wiki', 'face_back')))
    expect(screen.getByRole('img', { name: 'Lightning Bolt' }).getAttribute('src')).toBe('https://img.example/back.jpg')
    fireEvent.click(button(t('wiki', 'face_front')))
    expect(screen.getByRole('img', { name: 'Lightning Bolt' }).getAttribute('src')).toBe('https://img.example/bolt.jpg')
  })

  it('DCK-10: shows the issue of the card as a warning', () => {
    const { container } = render(<CardFocusPanel {...props({ issue: 'Not implemented in XMage' })} />)
    expect(container.querySelector('.card-focus-issue')?.textContent).toContain('Not implemented in XMage')
  })

  it('DCK-10: renders nothing without a card', () => {
    const { container } = render(<CardFocusPanel {...props({ card: null, meta: undefined })} />)
    expect(container.firstChild).toBeNull()
  })

  it('DCK-10: a card whose data is still loading shows a placeholder with its name', () => {
    render(<CardFocusPanel {...props({ meta: undefined })} />)
    expect(screen.getByText(t('decks', 'pile_loading'))).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Lightning Bolt' })).toBeTruthy()
  })

  it('DCK-9: −1, +1 and Remove all call their callbacks with the card', async () => {
    const onDec = vi.fn()
    const onInc = vi.fn()
    const onRemoveAll = vi.fn()
    render(<CardFocusPanel {...props({ onDec, onInc, onRemoveAll })} />)
    fireEvent.click(button(t('decks', 'strip_remove_one')))
    expect(onDec).toHaveBeenCalledWith(bolt)
    fireEvent.click(button(t('decks', 'strip_add_one')))
    expect(onInc).toHaveBeenCalledWith(bolt)
    fireEvent.click(button(t('decks', 'focus_remove_all')))
    await waitFor(() => expect(onRemoveAll).toHaveBeenCalledWith(bolt))
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('DCK-9: Remove all of several copies asks first and does nothing when declined', async () => {
    const onRemoveAll = vi.fn()
    const several: DeckCard = { ...bolt, amount: 3 }
    confirmMock.mockResolvedValueOnce(false)
    render(<CardFocusPanel {...props({ card: several, onRemoveAll })} />)
    fireEvent.click(button(t('decks', 'focus_remove_all')))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(onRemoveAll).not.toHaveBeenCalled()
  })

  it('DCK-9: the zone button names the other zone and swaps the card', () => {
    const onSwapZone = vi.fn()
    const { unmount } = render(<CardFocusPanel {...props({ onSwapZone })} />)
    expect(screen.getByRole('button', { name: t('decks', 'focus_to_side') })).toBeTruthy()
    fireEvent.click(button(t('decks', 'focus_to_side')))
    expect(onSwapZone).toHaveBeenCalledWith(bolt)
    unmount()

    render(<CardFocusPanel {...props({ zone: 'side' })} />)
    expect(screen.getByRole('button', { name: t('decks', 'focus_to_main') })).toBeTruthy()
    expect(screen.queryByRole('button', { name: t('decks', 'focus_to_side') })).toBeNull()
  })

  it('DCK-9: Printing and Cover call their callbacks, Cover shows the current cover', () => {
    const onChangePrinting = vi.fn()
    const onSetCover = vi.fn()
    const { unmount } = render(<CardFocusPanel {...props({ onChangePrinting, onSetCover })} />)
    fireEvent.click(button(t('decks', 'focus_printing')))
    expect(onChangePrinting).toHaveBeenCalledWith(bolt)
    expect(button(t('decks', 'focus_cover')).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button(t('decks', 'focus_cover')))
    expect(onSetCover).toHaveBeenCalledWith(bolt)
    unmount()

    render(<CardFocusPanel {...props({ isCover: true })} />)
    expect(button(t('decks', 'focus_cover')).getAttribute('aria-pressed')).toBe('true')
  })

  it('DCK-9: commander and partner buttons appear only in commander formats', () => {
    const onSetCommander = vi.fn()
    const onSetPartner = vi.fn()
    const { unmount } = render(<CardFocusPanel {...props({ isCommanderFormat: false })} />)
    expect(screen.queryByRole('button', { name: t('decks', 'pile_commander') })).toBeNull()
    expect(screen.queryByRole('button', { name: t('decks', 'focus_partner') })).toBeNull()
    unmount()

    render(<CardFocusPanel {...props({ isCommanderFormat: true, onSetCommander, onSetPartner })} />)
    fireEvent.click(button(t('decks', 'pile_commander')))
    expect(onSetCommander).toHaveBeenCalledWith(bolt)
    fireEvent.click(button(t('decks', 'focus_partner')))
    expect(onSetPartner).toHaveBeenCalledWith(bolt)
  })

  it('DCK-9: the commander and partner buttons are disabled when the card cannot be a commander', () => {
    render(<CardFocusPanel {...props({ isCommanderFormat: true, canBeCommander: false })} />)
    expect((button(t('decks', 'pile_commander'))).disabled).toBe(true)
    expect((button(t('decks', 'focus_partner'))).disabled).toBe(true)
  })

  it('DCK-9: a commander that is pressed can still be unset when it is not eligible', () => {
    render(<CardFocusPanel {...props({ isCommanderFormat: true, isCommander: true, canBeCommander: false })} />)
    expect((button(t('decks', 'pile_commander'))).disabled).toBe(false)
    expect(button(t('decks', 'pile_commander')).getAttribute('aria-pressed')).toBe('true')
  })

  it('DCK-9: the pile group appears only when piles are given and marks the current pile', () => {
    const onMoveToPile = vi.fn()
    const onNewPile = vi.fn()
    const { unmount } = render(<CardFocusPanel {...props()} />)
    expect(screen.queryByRole('group', { name: t('decks', 'focus_move_to_pile') })).toBeNull()
    unmount()

    render(<CardFocusPanel {...props({ piles, currentPileIds: ['p2', 'p3'], onMoveToPile, onNewPile })} />)
    expect(screen.getByRole('group', { name: t('decks', 'focus_move_to_pile') })).toBeTruthy()
    expect(button('Removal').getAttribute('aria-pressed')).toBe('false')
    expect(button('Lands').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button('Removal'))
    expect(onMoveToPile).toHaveBeenCalledWith('p1')
    fireEvent.click(button(t('decks', 'focus_new_pile')))
    expect(onNewPile).toHaveBeenCalledTimes(1)
  })

  it('DCK-9: the action buttons reach 44 px on a coarse pointer', () => {
    const css = readFileSync(join(process.cwd(), 'src/decks/CardFocusPanel.css'), 'utf8')
    expect(css).toMatch(/@media \(pointer: coarse\)\s*\{[\s\S]*min-height:\s*44px/)
  })
})
