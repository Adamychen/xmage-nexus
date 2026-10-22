import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CombatArrowsOverlay, { liftedArcPath, rectEdgePoint } from './CombatArrowsOverlay'

describe('CombatArrowsOverlay', () => {
  it('renders nothing when there are no arrows', () => {
    const dummyRef = { current: null }
    const { container } = render(
      <CombatArrowsOverlay
        game={null}
        boardRef={dummyRef}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('CMB-4: renders attack arrows when combat groups contain attackers and defender', () => {
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)

    const attCard = document.createElement('div')
    attCard.setAttribute('data-card-id', 'card-goblin-1')
    attCard.getBoundingClientRect = () => ({ left: 100, top: 400, width: 100, height: 140, right: 200, bottom: 540, x: 100, y: 400, toJSON: () => {} } as DOMRect)

    const oppAvatar = document.createElement('div')
    oppAvatar.setAttribute('data-player-id', 'p-opp')
    oppAvatar.getBoundingClientRect = () => ({ left: 100, top: 50, width: 60, height: 60, right: 160, bottom: 110, x: 100, y: 50, toJSON: () => {} } as DOMRect)

    boardDiv.appendChild(attCard)
    boardDiv.appendChild(oppAvatar)
    boardDiv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => {} } as DOMRect)

    const boardRef = { current: boardDiv }

    const fakeGame = {
      step: 'DECLARE_BLOCKERS',
      turn: 3,
      activePlayer: 'player1',
      priorityPlayer: 'player1',
      myPlayerId: 'p-me',
      combat: [
        {
          attackers: { 'card-goblin-1': {} as any },
          defenderId: 'p-opp',
        } as any,
      ],
      players: [
        { playerId: 'p-me', name: 'player1', life: 20, controlled: true, hasPriority: true, isActive: true, libraryCount: 40, handCount: 5 } as any,
        { playerId: 'p-opp', name: 'Computer', life: 19, controlled: false, hasPriority: false, isActive: false, libraryCount: 40, handCount: 5 } as any,
      ],
    }

    const { container, unmount } = render(
      <CombatArrowsOverlay
        game={fakeGame as any}
        boardRef={boardRef}
      />
    )

    const overlay = container.querySelector('.combat-arrows-overlay')
    expect(overlay).not.toBeNull()
    const attackPath = container.querySelector('.arrow-path.arrow-attack')
    expect(attackPath).not.toBeNull()

    unmount()
    boardDiv.remove()
  })

  it('TGT-9: renders targeting arrows from spells in the stack to targets on the board', () => {
    const containerDiv = document.createElement('div')
    document.body.appendChild(containerDiv)

    // Stack card on the right side
    const stackCard = document.createElement('div')
    stackCard.setAttribute('data-card-id', 'spell-bolt-1')
    stackCard.getBoundingClientRect = () => ({ left: 800, top: 200, width: 226, height: 310, right: 1026, bottom: 510, x: 800, y: 200, toJSON: () => {} } as DOMRect)

    // Target creature on the battlefield
    const targetCreature = document.createElement('div')
    targetCreature.setAttribute('data-card-id', 'perm-bear-1')
    targetCreature.getBoundingClientRect = () => ({ left: 300, top: 250, width: 100, height: 140, right: 400, bottom: 390, x: 300, y: 250, toJSON: () => {} } as DOMRect)

    containerDiv.appendChild(stackCard)
    containerDiv.appendChild(targetCreature)
    containerDiv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => {} } as DOMRect)

    const boardRef = { current: containerDiv }

    const fakeGame = {
      turn: 3,
      stack: {
        'spell-bolt-1': {
          name: 'Lightning Bolt',
          targets: ['perm-bear-1'],
        } as any,
      },
      players: [
        { playerId: 'p-me', name: 'player1', life: 20, controlled: true } as any,
        { playerId: 'p-opp', name: 'Opponent', life: 20, controlled: false } as any,
      ],
    }

    const { container, unmount } = render(
      <CombatArrowsOverlay
        game={fakeGame as any}
        boardRef={boardRef}
      />
    )

    const overlay = container.querySelector('.combat-arrows-overlay')
    expect(overlay).not.toBeNull()
    const targetPath = container.querySelector('.arrow-path.arrow-target')
    expect(targetPath).not.toBeNull()

    unmount()
    containerDiv.remove()
  })

  it('CMB-4: aims attack arrows at the deepest player element (avatar anchor), not the zone root', () => {
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)

    const attCard = document.createElement('div')
    attCard.setAttribute('data-card-id', 'card-goblin-2')
    attCard.getBoundingClientRect = () => ({ left: 100, top: 400, width: 100, height: 140, right: 200, bottom: 540, x: 100, y: 400, toJSON: () => {} } as DOMRect)

    const zoneRoot = document.createElement('div')
    zoneRoot.setAttribute('data-player-id', 'p-opp')
    zoneRoot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 400, right: 1000, bottom: 400, x: 0, y: 0, toJSON: () => {} } as DOMRect)

    const infoBar = document.createElement('div')
    infoBar.setAttribute('data-player-id', 'p-opp')
    infoBar.getBoundingClientRect = () => ({ left: 0, top: 20, width: 300, height: 80, right: 300, bottom: 100, x: 0, y: 20, toJSON: () => {} } as DOMRect)

    const avatar = document.createElement('div')
    avatar.setAttribute('data-player-anchor', 'p-opp')
    avatar.getBoundingClientRect = () => ({ left: 120, top: 30, width: 60, height: 60, right: 180, bottom: 90, x: 120, y: 30, toJSON: () => {} } as DOMRect)

    infoBar.appendChild(avatar)
    zoneRoot.appendChild(infoBar)
    boardDiv.appendChild(attCard)
    boardDiv.appendChild(zoneRoot)
    boardDiv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => {} } as DOMRect)

    const boardRef = { current: boardDiv }

    const fakeGame = {
      step: 'DECLARE_BLOCKERS',
      turn: 3,
      combat: [
        {
          attackers: { 'card-goblin-2': {} as any },
          defenderId: 'p-opp',
        } as any,
      ],
      players: [
        { playerId: 'p-me', name: 'player1', life: 20, controlled: true } as any,
        { playerId: 'p-opp', name: 'Computer', life: 19, controlled: false } as any,
      ],
    }

    const { container, unmount } = render(
      <CombatArrowsOverlay
        game={fakeGame as any}
        boardRef={boardRef}
      />
    )

    const attackPath = container.querySelector('.arrow-path.arrow-attack') as SVGPathElement | null
    expect(attackPath).not.toBeNull()
    const d = attackPath!.getAttribute('d') ?? ''
    // Attacker card center (150, 470), avatar center (150, 60):
    // trimmed start y = 470 - 42 = 428, trimmed end y = 60 + 18 = 78
    expect(d.startsWith('M 150 428')).toBe(true)
    expect(d.endsWith('150 78')).toBe(true)

    unmount()
    boardDiv.remove()
  })

  it('CMB-4: v2 colours an attack arrow by the attacker\'s seat and lands it on the defender\'s edge', () => {
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)
    const rect = (left: number, top: number, width: number, height: number) =>
      () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)
    const attCard = document.createElement('div')
    attCard.setAttribute('data-card-id', 'opp-goblin')
    attCard.getBoundingClientRect = rect(100, 100, 100, 70)
    const meAvatar = document.createElement('div')
    meAvatar.setAttribute('data-player-id', 'p-me')
    meAvatar.getBoundingClientRect = rect(100, 600, 76, 76)
    boardDiv.appendChild(attCard)
    boardDiv.appendChild(meAvatar)
    boardDiv.getBoundingClientRect = rect(0, 0, 1000, 800)
    const game = {
      step: 'DECLARE_BLOCKERS',
      combat: [{ attackers: { 'opp-goblin': {} }, defenderId: 'p-me' }],
      players: [
        { playerId: 'p-me', name: 'Me', controlled: true, battlefield: {} },
        { playerId: 'p-opp', name: 'Opp', controlled: false, battlefield: { 'opp-goblin': {} } },
      ],
    }
    const { container, unmount } = render(<CombatArrowsOverlay game={game as any} boardRef={{ current: boardDiv }} variant="v2" />)
    const path = container.querySelector('.arrow-group--v2 .arrow-path.arrow-v2') as SVGPathElement | null
    expect(path).not.toBeNull()
    expect(path!.style.stroke).toBe('var(--seat-1)')
    const d = path!.getAttribute('d')!
    expect(d).toMatch(/^M 149 170 Q /)
    expect(d.endsWith(' 139 597')).toBe(true)
    expect(container.querySelector('.arrow-shadow')).toBeNull()
    unmount()
    boardDiv.remove()
  })

  it('rectEdgePoint clips the centre line to the box edge', () => {
    expect(rectEdgePoint({ x: 0, y: 0 }, 50, 20, { x: 0, y: 100 })).toEqual({ x: 0, y: 20 })
    expect(rectEdgePoint({ x: 0, y: 0 }, 50, 20, { x: -200, y: 0 })).toEqual({ x: -50, y: 0 })
    expect(rectEdgePoint({ x: 0, y: 0 }, 50, 20, { x: 10, y: 10 })).toEqual({ x: 10, y: 10 })
  })

  it('liftedArcPath always bows upward, by at most 90 px', () => {
    expect(liftedArcPath({ x: 0, y: 100 }, { x: 100, y: 100 })).toBe('M 0 100 Q 50 82 100 100')
    expect(liftedArcPath({ x: 0, y: 500 }, { x: 1000, y: 500 })).toBe('M 0 500 Q 500 410 1000 500')
  })

  it('BRD-10: an attack arrow ends on the defender\'s portrait inside a copy', () => {
    const rect = (left: number, top: number, width: number, height: number) =>
      () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)
    boardDiv.getBoundingClientRect = rect(0, 0, 1000, 800)

    const attCard = document.createElement('div')
    attCard.setAttribute('data-card-id', 'card-goblin-1')
    attCard.getBoundingClientRect = rect(100, 400, 100, 140)
    boardDiv.appendChild(attCard)

    const copy = document.createElement('div')
    copy.setAttribute('data-testid', 'spotlight-copy-p-opp')
    copy.className = 'spotlight-copy'
    const copyFrame = document.createElement('div')
    copyFrame.className = 'spotlight-copy-frame'
    const oppZone = document.createElement('div')
    oppZone.setAttribute('data-player-id', 'p-opp')
    const anchor = document.createElement('div')
    anchor.setAttribute('data-player-anchor', 'p-opp')
    anchor.getBoundingClientRect = rect(500, 100, 60, 60)
    oppZone.appendChild(anchor)
    copyFrame.appendChild(oppZone)
    copy.appendChild(copyFrame)
    boardDiv.appendChild(copy)

    const game = {
      step: 'DECLARE_BLOCKERS',
      turn: 3,
      activePlayerId: 'p-me',
      myPlayerId: 'p-me',
      combat: [{ attackers: { 'card-goblin-1': {} }, defenderId: 'p-opp' }],
      players: [
        { playerId: 'p-me', name: 'Alice', life: 20, controlled: true, battlefield: {} },
        { playerId: 'p-opp', name: 'Bob', life: 19, controlled: false, battlefield: {} },
      ],
    }

    const { container, unmount } = render(<CombatArrowsOverlay game={game as any} boardRef={{ current: boardDiv }} />)
    const arrow = container.querySelector('.arrow-group.arrow-attack')
    expect(arrow?.getAttribute('data-arrow-from')).toBe('card-goblin-1')
    expect(arrow?.getAttribute('data-arrow-to')).toBe('p-opp')
    const coords = container.querySelector('.arrow-path.arrow-attack')!.getAttribute('d')!.split(/[ MQ]+/).filter(Boolean).map(Number)
    const [x2, y2] = coords.slice(4)
    expect(x2).toBeGreaterThanOrEqual(500)
    expect(x2).toBeLessThanOrEqual(560)
    expect(y2).toBeGreaterThanOrEqual(100)
    expect(y2).toBeLessThanOrEqual(160)

    unmount()
    boardDiv.remove()
  })

  it('BRD-10: a stack target arrow ends on a card inside a copy', () => {
    const rect = (left: number, top: number, width: number, height: number) =>
      () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)
    boardDiv.getBoundingClientRect = rect(0, 0, 1000, 800)

    const spell = document.createElement('div')
    spell.setAttribute('data-card-id', 'spell-bolt-1')
    spell.getBoundingClientRect = rect(800, 200, 120, 170)
    boardDiv.appendChild(spell)

    const copy = document.createElement('div')
    copy.setAttribute('data-testid', 'spotlight-copy-p-opp')
    copy.className = 'spotlight-copy'
    const target = document.createElement('div')
    target.setAttribute('data-card-id', 'perm-bear-1')
    target.getBoundingClientRect = rect(300, 600, 40, 56)
    copy.appendChild(target)
    boardDiv.appendChild(copy)

    const game = {
      step: 'MAIN1',
      turn: 3,
      activePlayerId: 'p-me',
      myPlayerId: 'p-me',
      players: [{ playerId: 'p-me', name: 'Alice', life: 20, controlled: true, battlefield: {} }],
      stack: { 'spell-bolt-1': { controllerId: 'p-me', targets: ['perm-bear-1'] } },
    }

    const { container, unmount } = render(<CombatArrowsOverlay game={game as any} boardRef={{ current: boardDiv }} />)
    const arrow = container.querySelector('.arrow-group.arrow-target')
    expect(arrow?.getAttribute('data-arrow-from')).toBe('spell-bolt-1')
    expect(arrow?.getAttribute('data-arrow-to')).toBe('perm-bear-1')

    unmount()
    boardDiv.remove()
  })
})
