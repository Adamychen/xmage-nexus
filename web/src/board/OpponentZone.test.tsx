import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import OpponentZone from './OpponentZone'
import type { CardView, PlayerView } from '../net/types'

describe('OpponentZone', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders face-down cards when no revealed cards are known', () => {
    const oppPlayer: Partial<PlayerView> = {
      playerId: 'p-opp',
      name: 'Computer',
      life: 20,
      handCount: 3,
      controlled: false,
      hasPriority: false,
      isActive: false,
      libraryCount: 40,
      battlefield: {},
    }

    const { container } = render(
      <OpponentZone player={oppPlayer as PlayerView} />
    )

    const faceDownCards = container.querySelectorAll('.card-slot.face-down')
    expect(faceDownCards.length).toBe(3)
  })

  it('renders known cards face-up and remaining cards face-down', () => {
    const oppPlayer: Partial<PlayerView> = {
      playerId: 'p-opp',
      name: 'Computer',
      life: 18,
      handCount: 4,
      controlled: false,
      hasPriority: false,
      isActive: false,
      libraryCount: 38,
      battlefield: {},
    }

    const revealedCards: Record<string, CardView> = {
      'card-bolt': {
        id: 'card-bolt',
        name: 'Lightning Bolt',
        manaCostLeftStr: ['{R}'],
        manaValue: 1,
        cardTypes: ['INSTANT'],
      },
      'card-counter': {
        id: 'card-counter',
        name: 'Counterspell',
        manaCostLeftStr: ['{U}{U}'],
        manaValue: 2,
        cardTypes: ['INSTANT'],
      },
    }

    const { container, getByText } = render(
      <OpponentZone player={oppPlayer as PlayerView} revealedCards={revealedCards} />
    )

    // 2 known cards face-up + 2 unknown cards face-down = 4 total cards in hand
    expect(getByText('Lightning Bolt')).not.toBeNull()
    expect(getByText('Counterspell')).not.toBeNull()

    const faceDownCards = container.querySelectorAll('.card-slot.face-down')
    expect(faceDownCards.length).toBe(2) // 4 - 2 = 2 face-down
  })

  it('nests attached auras/equipment under host creatures', () => {
    const oppPlayer: Partial<PlayerView> = {
      playerId: 'p-opp',
      name: 'Computer',
      life: 20,
      handCount: 2,
      controlled: false,
      battlefield: {
        'creature-1': {
          id: 'creature-1',
          name: 'Grizzly Bears',
          cardTypes: ['CREATURE'],
          power: '2',
          toughness: '2',
          attachments: ['aura-1'],
        } as any,
        'aura-1': {
          id: 'aura-1',
          name: 'Pacifism',
          cardTypes: ['ENCHANTMENT'],
          attachedTo: 'creature-1',
        } as any,
      },
    }

    const { container, getByText } = render(
      <OpponentZone player={oppPlayer as PlayerView} />
    )

    // Creature with attachment group
    expect(container.querySelector('.card-attachment-group')).not.toBeNull()
    expect(getByText('Grizzly Bears')).not.toBeNull()
    expect(getByText('Pacifism')).not.toBeNull()

    // Aura should be nested in attachments-list and not in permanents-band
    const permBand = container.querySelector('.permanents-band')
    expect(permBand?.querySelectorAll('.card-slot').length).toBe(0)
  })

  it('renders a mutated creature as a pile with badge and constituent parts', () => {
    const oppPlayer: Partial<PlayerView> = {
      playerId: 'p-opp',
      name: 'Computer',
      life: 20,
      handCount: 0,
      controlled: false,
      battlefield: {
        'mut-creature': {
          id: 'mut-creature',
          name: 'Sea-Dasher Octopus',
          cardTypes: ['CREATURE'],
          power: '3',
          toughness: '3',
          mutated: true,
          mutateView: {
            'under-1': { id: 'under-1', name: 'Gemrazer', manaValue: 4, cardTypes: ['CREATURE'] } as CardView,
            'under-2': { id: 'under-2', name: 'Pouncing Shoreshark', manaValue: 4, cardTypes: ['CREATURE'] } as CardView,
          },
        } as any,
      },
    }

    const { container, getByText } = render(
      <OpponentZone player={oppPlayer as PlayerView} />
    )

    // Mutated creature renders as a pile, not an attachment group
    expect(container.querySelector('.card-mutate-pile')).not.toBeNull()
    expect(container.querySelector('.card-attachment-group')).toBeNull()
    expect(container.querySelector('.mutated-badge')).not.toBeNull()
    expect(container.querySelectorAll('.mutate-part').length).toBe(2)
    expect(getByText('Sea-Dasher Octopus')).not.toBeNull()
    expect(getByText('Gemrazer')).not.toBeNull()
    expect(getByText('Pouncing Shoreshark')).not.toBeNull()
  })

  it('renders opponent commander in command zone', () => {
    const oppPlayer: Partial<PlayerView> = {
      playerId: 'p-opp',
      name: 'OpponentCommander',
      life: 40,
      handCount: 7,
      controlled: false,
      commandList: [
        {
          id: 'cmd-urza',
          name: 'Urza, Lord High Artificer',
          manaValue: 4,
          castCount: 0,
          mageObjectType: 'COMMANDER',
        } as any,
      ],
      battlefield: {},
    }

    const { container, getByText } = render(
      <OpponentZone player={oppPlayer as PlayerView} />
    )

    expect(container.querySelector('.command-zone.opp')).not.toBeNull()
    expect(container.querySelector('.commander-badge')).not.toBeNull()
    expect(getByText('Urza, Lord High Artificer')).not.toBeNull()
  })

  it('groups multiple lands of the same name in a land-group accordion', () => {
    const oppPlayer: Partial<PlayerView> = {
      playerId: 'p-opp',
      name: 'LandLord',
      life: 40,
      handCount: 5,
      controlled: false,
      battlefield: {
        'land-1': { id: 'land-1', name: 'Island', cardTypes: ['LAND'] } as any,
        'land-2': { id: 'land-2', name: 'Island', cardTypes: ['LAND'] } as any,
        'land-3': { id: 'land-3', name: 'Island', cardTypes: ['LAND'] } as any,
        'land-4': { id: 'land-4', name: 'Mountain', cardTypes: ['LAND'] } as any,
      },
    }

    const { container, getByText } = render(
      <OpponentZone player={oppPlayer as PlayerView} compactPod />
    )

    // Island group has 3 lands and badge '×3'
    const islandGroup = container.querySelector('.land-group[data-land-name="Island"]')
    expect(islandGroup).toBeTruthy()
    expect(islandGroup?.getAttribute('data-count')).toBe('3')
    expect(islandGroup?.querySelector('.land-group-badge')?.textContent).toBe('×3')
    expect(islandGroup?.querySelectorAll('.card-slot').length).toBe(3)

    // Mountain is a single land, so not wrapped in land-group
    expect(container.querySelector('.land-group[data-land-name="Mountain"]')).toBeNull()
    expect(getByText('Mountain')).toBeTruthy()

    // Compact-pod enables micro resource bar and compact styling
    expect(container.querySelector('.resource-bar.micro')).toBeTruthy()
  })

  it('renders multiple partner commanders with multi-commander and compact classes', () => {
    const oppPlayer: Partial<PlayerView> = {
      playerId: 'p-partner',
      name: 'PartnerOpponent',
      life: 40,
      handCount: 7,
      controlled: false,
      commandList: [
        {
          id: 'cmd-ellie',
          name: 'Ellie',
          manaValue: 3,
          castCount: 0,
          mageObjectType: 'COMMANDER',
        } as any,
        {
          id: 'cmd-joel',
          name: 'Joel, Resolute Survivor',
          manaValue: 6,
          castCount: 1,
          mageObjectType: 'COMMANDER',
        } as any,
      ],
      battlefield: {},
    }

    const { container, getByText } = render(
      <OpponentZone player={oppPlayer as PlayerView} compactPod />
    )

    const cmdZone = container.querySelector('.command-zone')
    expect(cmdZone).not.toBeNull()
    expect(cmdZone?.classList.contains('multi-commander')).toBe(true)
    expect(cmdZone?.classList.contains('compact')).toBe(true)

    // Both commanders rendered
    expect(getByText('Ellie')).not.toBeNull()
    expect(getByText('Joel, Resolute Survivor')).not.toBeNull()

    // 2 crown badges
    expect(container.querySelectorAll('.commander-badge').length).toBe(2)
  })
})
