// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import BoardZone from './BoardZone'
import PlayerZone from './PlayerZone'
import OpponentZone from './OpponentZone'
import GameBoard from './GameBoard'
import ArenaBoard from './ArenaBoard'
import { getState, setSetting } from '../state/store'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { CardView } from '../net/types'

function commander(id: string, name: string, castCount = 0): CardView {
  return { id, name, manaValue: 3, expansionSetCode: 'TEST', cardNumber: '1', mageObjectType: 'COMMANDER', castCount } as unknown as CardView
}

const me = () =>
  makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, commandList: [commander('cmd-atraxa', "Atraxa, Praetors' Voice", 1)] })
const partnersMe = () =>
  makePlayer({
    playerId: 'p1',
    name: 'Alice',
    controlled: true,
    commandList: [commander('cmd-kraum', "Kraum, Ludevic's Opus"), commander('cmd-tymna', 'Tymna the Weaver', 2)],
  })
const opp = (id = 'p2') => makePlayer({ playerId: id, name: `Opp-${id}`, commandList: [commander(`cmd-${id}`, 'Urza, Lord High Artificer')] })

describe('BoardZone commander placement and the visible commander setting', () => {
  let initial: boolean
  beforeEach(() => {
    initial = getState().settings.visibleCommander
  })
  afterEach(() => {
    setSetting('visibleCommander', initial)
    cleanup()
  })

  it('defaults to a visible commander', () => {
    expect(initial).toBe(true)
  })

  describe('setting on', () => {
    beforeEach(() => setSetting('visibleCommander', true))

    it('renders my commander full-size in its own column, out of the creatures row', () => {
      const { container } = render(<PlayerZone player={me()} />)
      const zone = container.querySelector('.board-zone')
      expect(zone?.classList.contains('has-command-col')).toBe(true)
      const col = container.querySelector('.bz-command-col')
      expect(col?.querySelector('.command-zone.my:not(.mini):not(.command-crowns) .commander-slot[data-card-id="cmd-atraxa"]')).not.toBeNull()
      expect(col?.querySelector('.commander-badge')).not.toBeNull()
      expect(col?.querySelector('.commander-tax-badge')?.getAttribute('data-tax')).toBe('2')
      expect(container.querySelector('.bz-creatures-row .command-zone')).toBeNull()
      expect(container.querySelector('[data-testid="commander-crowns"]')).toBeNull()
    })

    it('keeps click-to-cast, playable glow and targeting on the full slot', () => {
      const onCardClick = vi.fn()
      const { container } = render(
        <PlayerZone player={me()} onCardClick={onCardClick} playableIds={new Set(['cmd-atraxa'])} />
      )
      const slot = container.querySelector('.bz-command-col [data-card-id="cmd-atraxa"]') as HTMLElement
      expect(slot.className).toMatch(/playable/)
      fireEvent.click(slot)
      expect(onCardClick).toHaveBeenCalledWith('cmd-atraxa')
    })

    it('uses art tiles in the column with the compact card style', () => {
      const prev = getState().settings.cardStyle
      setSetting('cardStyle', 'compact')
      try {
        const { container } = render(<PlayerZone player={me()} />)
        expect(container.querySelector('.board-zone.card-style-compact.has-command-col')).not.toBeNull()
        expect(container.querySelector('.bz-command-col .command-zone.art-tiles .commander-slot.is-compact')).not.toBeNull()
      } finally {
        setSetting('cardStyle', prev)
      }
    })
  })

  describe('setting off', () => {
    beforeEach(() => setSetting('visibleCommander', false))

    it('shrinks my commander to a crown button next to my info bar', () => {
      const { container, getAllByTestId } = render(<PlayerZone player={me()} />)
      expect(container.querySelector('.bz-command-col')).toBeNull()
      expect(container.querySelector('.has-command-col')).toBeNull()
      expect(container.querySelector('.commander-slot')).toBeNull()
      const crowns = container.querySelector('.bz-status-row > .bz-commander-crowns')
      expect(crowns?.previousElementSibling?.classList.contains('player-info-bar')).toBe(true)
      expect(getAllByTestId('commander-crown-btn')).toHaveLength(1)
      expect(crowns?.querySelector('.commander-tax-badge')?.getAttribute('data-tax')).toBe('2')
    })

    it('casts the commander from the crown button through onCardClick', () => {
      const onCardClick = vi.fn()
      const { getByTestId } = render(
        <PlayerZone player={me()} onCardClick={onCardClick} playableIds={new Set(['cmd-atraxa'])} />
      )
      const crown = getByTestId('commander-crown-btn')
      expect(crown.classList.contains('is-playable')).toBe(true)
      fireEvent.click(crown)
      expect(onCardClick).toHaveBeenCalledWith('cmd-atraxa')
    })

    it('shows the card preview when the crown is hovered', () => {
      const onCardHover = vi.fn()
      const { getByTestId } = render(<PlayerZone player={me()} onCardHover={onCardHover} />)
      fireEvent.mouseEnter(getByTestId('commander-crown-btn'))
      expect(onCardHover).toHaveBeenCalledWith(expect.objectContaining({ id: 'cmd-atraxa' }), expect.anything())
    })

    it('renders one crown per partner commander', () => {
      const { getAllByTestId } = render(<PlayerZone player={partnersMe()} />)
      const crowns = getAllByTestId('commander-crown-btn')
      expect(crowns.map((c) => c.getAttribute('data-card-id'))).toEqual(['cmd-kraum', 'cmd-tymna'])
    })

    it('never hides an opponent commander', () => {
      const { container } = render(<OpponentZone player={opp()} />)
      expect(container.querySelector('.bz-identity .command-zone.mini.opp')).not.toBeNull()
      expect(container.querySelector('[data-testid="commander-crowns"]')).toBeNull()
    })

    it('keeps the mini zone for a non-controlled bottom player (spectator view)', () => {
      const { container } = render(<BoardZone player={opp('p9')} position="bottom" isControlled={false} />)
      expect(container.querySelector('.bz-identity .command-zone.mini')).not.toBeNull()
      expect(container.querySelector('.bz-commander-crowns')).toBeNull()
    })
  })

  describe('board layouts', () => {
    const game = () => makeGameView({ players: [me(), opp('p2'), opp('p3')], activePlayerId: 'p1' })

    for (const visible of [true, false]) {
      it(`standard and arena place my commander bottom-left and opponents under their info bars (visible=${visible})`, () => {
        setSetting('visibleCommander', visible)
        for (const Board of [GameBoard, ArenaBoard]) {
          const { container, unmount } = render(<Board game={game()} />)
          const mine = container.querySelector('.board-zone[data-player-id="p1"]')
          if (visible) {
            expect(mine?.querySelector('.bz-command-col [data-card-id="cmd-atraxa"]')).not.toBeNull()
          } else {
            expect(mine?.querySelector('.bz-commander-crowns [data-card-id="cmd-atraxa"]')).not.toBeNull()
          }
          const opps = container.querySelectorAll('.opponent-zone .bz-identity .command-zone.mini')
          expect(opps.length).toBeGreaterThan(0)
          expect(container.querySelector('.bz-creatures-row .command-zone')).toBeNull()
          unmount()
        }
      })
    }
  })
})
