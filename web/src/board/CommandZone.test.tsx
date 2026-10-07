import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CommandZone from './CommandZone'
import type { PlayerView } from '../net/types'

describe('CommandZone', () => {
  it('renders nothing when there are no commanders or emblems', () => {
    const fakePlayer: Partial<PlayerView> = {
      name: 'Player1',
      commandList: [],
      helperCards: {},
    }

    const { container } = render(
      <CommandZone player={fakePlayer as PlayerView} side="my" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders 1 commander with crown and tax badge, and handles click to cast', () => {
    const onCardClick = vi.fn()
    const fakePlayer: Partial<PlayerView> = {
      name: 'Player1',
      commandList: [
        {
          id: 'cmd-atrata',
          name: 'Etrata, Deadly Fugitive',
          manaValue: 3,
          castCount: 2,
          mageObjectType: 'COMMANDER',
        } as any,
      ],
    }

    const { container } = render(
      <CommandZone
        player={fakePlayer as PlayerView}
        side="my"
        playableIds={new Set(['cmd-atrata'])}
        onCardClick={onCardClick}
      />
    )

    expect(container.querySelector('.command-zone')).not.toBeNull()
    expect(container.querySelector('.commander-badge')).not.toBeNull()
    expect(container.querySelector('[data-testid="commander-tax"]')?.getAttribute('data-tax')).toBe('4') // 2 casts * 2 tax = +4

    const slot = container.querySelector('[data-card-id="cmd-atrata"]')
    expect(slot).not.toBeNull()
    if (slot) {
      fireEvent.click(slot)
      expect(onCardClick).toHaveBeenCalledWith('cmd-atrata')
    }
  })

  it('renders commanders and emblems as compact tiles with the compact card style', () => {
    const fakePlayer: Partial<PlayerView> = {
      name: 'Player1',
      commandList: [
        { id: 'cmd-1', name: 'Krenko, Mob Boss', manaValue: 4, mageObjectType: 'COMMANDER' } as any,
        { id: 'emb-1', name: 'Emblem Gideon', mageObjectType: 'EMBLEM' } as any,
      ],
    }

    const { container, rerender } = render(<CommandZone player={fakePlayer as PlayerView} side="my" compactCards />)
    expect(container.querySelector('.command-zone.art-tiles')).not.toBeNull()
    expect(container.querySelector('[data-card-id="cmd-1"]')?.classList.contains('is-compact')).toBe(true)
    expect(container.querySelector('[data-card-id="emb-1"]')?.classList.contains('is-compact')).toBe(true)

    rerender(<CommandZone player={fakePlayer as PlayerView} side="my" />)
    expect(container.querySelector('.command-zone.art-tiles')).toBeNull()
    expect(container.querySelector('.is-compact')).toBeNull()
  })

  it('renders 2 partner commanders with independent tax badges and click triggers', () => {
    const onCardClick = vi.fn()
    const fakePlayer: Partial<PlayerView> = {
      name: 'PartnerPlayer',
      commandList: [
        {
          id: 'cmd-kraum',
          name: "Kraum, Ludevic's Opus",
          manaValue: 5,
          castCount: 1, // Tax +2
          mageObjectType: 'COMMANDER',
        } as any,
        {
          id: 'cmd-tymna',
          name: 'Tymna the Weaver',
          manaValue: 3,
          castCount: 3, // Tax +6
          mageObjectType: 'COMMANDER',
        } as any,
      ],
    }

    const { container } = render(
      <CommandZone
        player={fakePlayer as PlayerView}
        side="my"
        playableIds={new Set(['cmd-kraum', 'cmd-tymna'])}
        onCardClick={onCardClick}
      />
    )

    const commanderBadges = container.querySelectorAll('.commander-badge')
    expect(commanderBadges.length).toBe(2) // 2 crowns

    const taxes = [...container.querySelectorAll('[data-testid="commander-tax"]')].map((b) => b.getAttribute('data-tax'))
    expect(taxes).toEqual(['2', '6'])

    const kraumSlot = container.querySelector('[data-card-id="cmd-kraum"]')
    const tymnaSlot = container.querySelector('[data-card-id="cmd-tymna"]')
    expect(kraumSlot).not.toBeNull()
    expect(tymnaSlot).not.toBeNull()

    if (kraumSlot) {
      fireEvent.click(kraumSlot)
      expect(onCardClick).toHaveBeenCalledWith('cmd-kraum')
    }
    if (tymnaSlot) {
      fireEvent.click(tymnaSlot)
      expect(onCardClick).toHaveBeenCalledWith('cmd-tymna')
    }
  })

  it('renders 2 partner commanders and 1 companion simultaneously', () => {
    const fakePlayer: Partial<PlayerView> = {
      name: 'PartnerCompanionPlayer',
      commandList: [
        {
          id: 'cmd-thrasios',
          name: 'Thrasios, Triton Hero',
          manaValue: 2,
          castCount: 0,
          mageObjectType: 'COMMANDER',
        } as any,
        {
          id: 'cmd-vialsmasher',
          name: 'Vial Smasher the Fierce',
          manaValue: 3,
          castCount: 0,
          mageObjectType: 'COMMANDER',
        } as any,
        {
          id: 'companion-lurrus',
          name: 'Lurrus of the Dream-Den',
          manaValue: 3,
          castCount: 0,
          mageObjectType: 'COMPANION',
          rules: ['Companion — Each permanent card in your starting deck has mana value 2 or less.'],
        } as any,
      ],
    }

    const { container } = render(
      <CommandZone player={fakePlayer as PlayerView} side="my" />
    )

    const crowns = container.querySelectorAll('.commander-badge')
    const companions = container.querySelectorAll('.companion-badge')

    expect(crowns.length).toBe(2) // 2 Partner commanders
    expect(companions.length).toBe(1) // 1 Companion
  })

  it('renders emblems stack when helperCards has emblems', () => {
    const fakePlayer: Partial<PlayerView> = {
      name: 'Player1',
      helperCards: {
        'emblem-1': {
          id: 'emblem-1',
          name: 'Emblem - Teferi, Hero of Dominaria',
          manaValue: 0,
          mageObjectType: 'EMBLEM',
        },
        'emblem-2': {
          id: 'emblem-2',
          name: 'Emblem - Chandra, Torch of Defiance',
          manaValue: 0,
          mageObjectType: 'EMBLEM',
        },
      },
    }

    const { container, getByText } = render(
      <CommandZone player={fakePlayer as PlayerView} side="my" />
    )

    expect(container.querySelector('.emblems-wrap')).not.toBeNull()
    expect(getByText('2')).not.toBeNull() // 2 emblems count badge
  })

  it('filters out XMage internal system helper emblems like Day/Night trackers', () => {
    const fakePlayer: Partial<PlayerView> = {
      name: 'Player1',
      commandList: [],
      helperCards: {
        'helper-day-night': {
          id: 'helper-day-night',
          name: 'Helper Emblem',
          displayName: 'Helper Emblem',
          rules: ["Day or night.\n<br/><hintstart/>It's neither day nor night."],
          manaValue: 0,
        },
      },
    }

    const { container } = render(
      <CommandZone player={fakePlayer as PlayerView} side="my" />
    )

    expect(container.firstChild).toBeNull() // Correctly ignored
  })

  it('filters out reminder tokens like Radiation, Poison, Monarch, Energy in commandList', () => {
    const fakePlayer: Partial<PlayerView> = {
      name: 'Player1',
      commandList: [
        {
          id: 'rad-reminder',
          name: 'Radiation',
          displayName: 'Radiation',
          rules: ['At the beginning of your precombat main phase...'],
          manaValue: 0,
        } as any,
        {
          id: 'monarch-reminder',
          name: 'The Monarch',
          displayName: 'The Monarch',
          manaValue: 0,
        } as any,
      ],
    }

    const { container } = render(
      <CommandZone player={fakePlayer as PlayerView} side="my" />
    )

    expect(container.firstChild).toBeNull() // Correctly ignored
  })
})

describe('CommandZone commander tax pip (real server shape)', () => {
  it('shows the tax pip from the rules line when the view has no castCount field', () => {
    const player = {
      name: 'Player1',
      commandList: [
        {
          id: 'cmd-krenko',
          name: 'Krenko, Mob Boss',
          mageObjectType: 'COMMANDER',
          expansionSetCode: 'M13',
          cardNumber: '138',
          rules: ['{T}: Create X 1/1 red Goblin creature tokens.', '<b>Commander</b> 2 times played from the command zone.'],
        },
      ],
      helperCards: {},
    } as unknown as PlayerView
    const { container } = render(<CommandZone player={player} side="opp" />)
    const badge = container.querySelector('[data-testid="commander-tax"]')
    expect(badge?.getAttribute('data-tax')).toBe('4')
    expect(badge?.querySelector('.commander-tax-pip img')?.getAttribute('alt')).toBe('{4}')
  })

  it('shows no pip before the first cast', () => {
    const player = {
      name: 'Player1',
      commandList: [{ id: 'cmd-krenko', name: 'Krenko, Mob Boss', mageObjectType: 'COMMANDER', rules: ['<b>Commander</b>'] }],
      helperCards: {},
    } as unknown as PlayerView
    const { container } = render(<CommandZone player={player} side="opp" />)
    expect(container.querySelector('.commander-badge')).not.toBeNull()
    expect(container.querySelector('[data-testid="commander-tax"]')).toBeNull()
  })
})
