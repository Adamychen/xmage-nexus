import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ActionFeedCard from './ActionFeedCard'
import { setState } from '../state/store'
import { getLanguage } from '../i18n'
import { formatFeedTime } from './feedTime'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { ActionFeedItem } from './gameEventParser'

const TIME = 1_700_000_000_000

function item(overrides: Partial<ActionFeedItem>): ActionFeedItem {
  return { id: 'row-1', timestamp: TIME, type: 'cast', description: '', rawText: '', ...overrides }
}

function seatedGame() {
  return makeGameView({
    players: [
      makePlayer({ playerId: 'a', name: 'Adam', controlled: true }),
      makePlayer({ playerId: 'm', name: 'Mira' }),
      makePlayer({ playerId: 't', name: 'Tobias' }),
    ],
  })
}

describe('ActionFeedCard visual log row', () => {
  afterEach(() => {
    cleanup()
    setState({ game: null })
  })

  it('PNL-3: a cast is one row whose sentence says the card name, the target and the player once', () => {
    const { container } = render(
      <ActionFeedCard
        item={item({ playerName: 'Adam', isMe: true, cardName: 'Lightning Bolt', targetName: 'Mira', description: 'Adam casts Lightning Bolt targeting Mira' })}
      />,
    )
    expect(container.querySelectorAll('.action-feed-row')).toHaveLength(1)
    expect(container.querySelector('.action-feed-sentence')?.textContent).toBe('Adam casts Lightning Bolt targeting Mira')
    expect(container.querySelector('.action-feed-row')?.textContent?.split('Lightning Bolt')).toHaveLength(2)
    expect(container.querySelector('.action-card-name')).toBeNull()
    expect(container.querySelector('.action-feed-sentence .is-card')?.textContent).toBe('Lightning Bolt')
  })

  it('PNL-3: the card art and the black box behind the description are gone', () => {
    const { container } = render(<ActionFeedCard item={item({ cardName: 'Grizzly Bears', description: 'Grizzly Bears attacks' })} />)
    expect(container.querySelector('.action-card-bg')).toBeNull()
    expect(container.querySelector('.action-desc-text')).toBeNull()
    expect(container.querySelector('[style*="background-image"]')).toBeNull()
  })

  it('PNL-3: a damage row shows the amount as a red chip, a life gain as a green one', () => {
    const damage = render(<ActionFeedCard item={item({ type: 'damage', cardName: 'Lightning Bolt', targetName: 'Mira', amount: 4, description: 'Lightning Bolt deals 4 damage to Mira' })} />)
    const chip = damage.container.querySelector('.action-feed-chip')
    expect(chip?.textContent).toBe('−4')
    expect(chip?.classList.contains('loss')).toBe(true)
    damage.unmount()

    const gain = render(<ActionFeedCard item={item({ type: 'life', amount: 3, description: 'Adam gains 3 life' })} />)
    expect(gain.container.querySelector('.action-feed-chip')?.textContent).toBe('+3')
    expect(gain.container.querySelector('.action-feed-chip')?.classList.contains('gain')).toBe(true)
  })

  it('PNL-3: a row without an amount has no chip', () => {
    const { container } = render(<ActionFeedCard item={item({ type: 'land', cardName: 'Forest', description: 'Adam plays Forest' })} />)
    expect(container.querySelector('.action-feed-chip')).toBeNull()
  })

  it('PNL-3: the time is hours and minutes, with the full time in its tooltip', () => {
    const { container } = render(<ActionFeedCard item={item({ description: 'Start Match', type: 'system' })} />)
    const time = container.querySelector('.action-time')!
    expect(time.textContent).toMatch(/^\d{1,2}:\d{2}$/)
    expect(time.getAttribute('title')).toBe(formatFeedTime(TIME, getLanguage()))
  })

  it('PNL-3: hovering a row with a card shows that card, and leaving it clears the preview', () => {
    const onHover = vi.fn()
    const { container } = render(<ActionFeedCard item={item({ type: 'land', cardName: 'Forest', description: 'Adam plays Forest' })} onHover={onHover} />)
    const row = container.querySelector('.action-feed-row')!
    fireEvent.mouseEnter(row)
    expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Forest' }), expect.any(Object))
    fireEvent.mouseLeave(row)
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('PNL-3: a card name in the sentence is a hover link, and leaving it returns the preview to the row card', () => {
    const onHover = vi.fn()
    const { container } = render(
      <ActionFeedCard
        item={item({ type: 'block', playerName: 'Mira', cardName: 'Wall of Omens', targetName: 'Grizzly Bears', description: 'Mira blocks Grizzly Bears with Wall of Omens' })}
        onHover={onHover}
      />,
    )
    const link = container.querySelector<HTMLElement>('.action-feed-sentence .is-card')!
    expect(link.textContent).toBe('Grizzly Bears')
    fireEvent.mouseEnter(link)
    expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Grizzly Bears' }), expect.any(Object))
    fireEvent.mouseOut(link, { relatedTarget: container.querySelector('.action-feed-row') })
    expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Wall of Omens' }), expect.any(Object))
  })

  it('PNL-3: the turn divider keeps its label, the turn and the time', () => {
    const { container } = render(<ActionFeedCard item={item({ type: 'turn', amount: 2, playerName: 'Mira', description: '' })} />)
    expect(container.querySelector('[data-type="turn"]')).not.toBeNull()
    expect(container.querySelector('.turn-badge')?.textContent).toContain('2')
    expect(container.querySelector('.turn-badge')?.textContent).toContain('Mira')
    expect(container.querySelector('.action-time')?.getAttribute('title')).toBe(formatFeedTime(TIME, getLanguage()))
  })

  it('PNL-2: a player name in the sentence takes that player seat colour', () => {
    setState({ game: seatedGame() as never })
    const { container } = render(
      <ActionFeedCard item={item({ playerName: 'Mira', cardName: 'Lightning Bolt', targetName: 'Adam', description: 'Mira casts Lightning Bolt targeting Adam' })} />,
    )
    const mira = [...container.querySelectorAll<HTMLElement>('.action-feed-sentence .is-player')].find((el) => el.textContent === 'Mira')
    const adam = [...container.querySelectorAll<HTMLElement>('.action-feed-sentence .is-player')].find((el) => el.textContent === 'Adam')
    expect(mira?.getAttribute('style')).toContain('var(--seat-1)')
    expect(adam?.getAttribute('style')).toContain('var(--seat-0)')
  })

  it('PNL-2: the turn divider names the active player in that player seat colour', () => {
    setState({ game: seatedGame() as never })
    const { container } = render(<ActionFeedCard item={item({ type: 'turn', amount: 3, playerName: 'Tobias', description: '' })} />)
    const name = container.querySelector<HTMLElement>('.turn-player')
    expect(name?.textContent).toBe('Tobias')
    expect(name?.getAttribute('style')).toContain('var(--seat-2)')
  })

  it('PNL-2: there is no green "you" tag and no red opponent tag', () => {
    setState({ game: seatedGame() as never })
    const { container } = render(
      <ActionFeedCard item={item({ playerName: 'Adam', isMe: true, cardName: 'Forest', description: 'Adam plays Forest' })} />,
    )
    expect(container.querySelector('.action-player-tag')).toBeNull()
    expect(container.querySelector('.action-feed-row')?.className).not.toMatch(/\bis-me\b|\bis-opp\b/)
    expect(container.textContent).not.toContain('Tú')
  })
})
