import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CombatArrowsOverlay, { ARROW_HEAD, arrowAnchors, arrowPath, stackLoopPath } from './CombatArrowsOverlay'

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
    // TGT-12: the attacker's card is (100,400,100,140) and the avatar (120,30,60,60), both centred on
    // x 150, so the beam leaves the card's top edge (y 400) and stops a dart short of the avatar's
    // bottom edge (y 90), which is where the head then lands (TGT-11).
    const coords = d.split(/[ MC]+/).filter(Boolean).map(Number)
    expect(coords[0]).toBe(150)
    // Over the card, not on its border: inside the attacker's top half.
    expect(coords[1]).toBeGreaterThan(400)
    expect(coords[1]).toBeLessThan(470)
    const end = coords.slice(-2)
    expect(end[0]).toBe(150)
    // The line stops a dart short and the head covers the rest, landing over the portrait (y 30..90).
    expect(end[1] - ARROW_HEAD).toBeLessThanOrEqual(90)
    expect(end[1] - ARROW_HEAD).toBeGreaterThanOrEqual(30)

    unmount()
    boardDiv.remove()
  })

  it('CMB-4: a blocked attacker trades its beam for a tie with two heads; unblocking gives it back', () => {
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)
    const box = (el: Element, left: number, top: number) => {
      el.getBoundingClientRect = () => ({ left, top, width: 100, height: 140, right: left + 100, bottom: top + 140, x: left, y: top, toJSON: () => {} } as DOMRect)
    }
    const attacker = document.createElement('div')
    attacker.setAttribute('data-card-id', 'att-1')
    box(attacker, 100, 400)
    const blocker = document.createElement('div')
    blocker.setAttribute('data-card-id', 'blk-1')
    box(blocker, 100, 150)
    const seat = document.createElement('div')
    seat.setAttribute('data-player-id', 'p-opp')
    const anchorEl = document.createElement('div')
    anchorEl.setAttribute('data-player-anchor', 'p-opp')
    box(anchorEl, 20, 20)
    seat.appendChild(anchorEl)
    boardDiv.append(attacker, blocker, seat)
    boardDiv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => {} } as DOMRect)

    const base = {
      step: 'DECLARE_BLOCKERS',
      turn: 3,
      players: [
        { playerId: 'p-me', name: 'me', life: 20, controlled: true, battlefield: { 'att-1': {} } },
        { playerId: 'p-opp', name: 'them', life: 20, controlled: false, battlefield: { 'blk-1': {} } },
      ],
    }
    const blocked = { ...base, combat: [{ attackers: { 'att-1': {} }, blockers: { 'blk-1': {} }, isBlocked: true, defenderId: 'p-opp' }] }

    const first = render(<CombatArrowsOverlay game={blocked as never} boardRef={{ current: boardDiv }} />)
    expect(first.container.querySelector('.arrow-path.arrow-attack')).toBeNull()
    expect(first.container.querySelectorAll('.arrow-path.arrow-block')).toHaveLength(1)
    const tie = first.container.querySelector('.arrow-path.arrow-block')
    expect(tie).not.toBeNull()
    expect(tie?.getAttribute('marker-start')).toBe('url(#marker-block)')
    expect(tie?.getAttribute('marker-end')).toBe('url(#marker-block)')
    first.unmount()

    const unblocked = { ...base, combat: [{ attackers: { 'att-1': {} }, blockers: {}, isBlocked: false, defenderId: 'p-opp' }] }
    const second = render(<CombatArrowsOverlay game={unblocked as never} boardRef={{ current: boardDiv }} />)
    expect(second.container.querySelector('.arrow-path.arrow-attack')).not.toBeNull()
    expect(second.container.querySelector('.arrow-path.arrow-block')).toBeNull()
    second.unmount()
    boardDiv.remove()
  })

  it('CMB-4: an attacker whose blocker died draws neither beam nor tie while the view calls it blocked', () => {
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)
    const attacker = document.createElement('div')
    attacker.setAttribute('data-card-id', 'kraken')
    attacker.getBoundingClientRect = () => ({ left: 100, top: 400, width: 100, height: 140, right: 200, bottom: 540, x: 100, y: 400, toJSON: () => {} } as DOMRect)
    const seat = document.createElement('div')
    seat.setAttribute('data-player-id', 'p-opp')
    const anchorEl = document.createElement('div')
    anchorEl.setAttribute('data-player-anchor', 'p-opp')
    anchorEl.getBoundingClientRect = () => ({ left: 20, top: 20, width: 60, height: 60, right: 80, bottom: 80, x: 20, y: 20, toJSON: () => {} } as DOMRect)
    seat.appendChild(anchorEl)
    boardDiv.append(attacker, seat)
    boardDiv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => {} } as DOMRect)

    const game = {
      step: 'COMBAT_DAMAGE',
      turn: 3,
      players: [
        { playerId: 'p-me', name: 'me', life: 20, controlled: true, battlefield: { kraken: {} } },
        { playerId: 'p-opp', name: 'them', life: 20, controlled: false, battlefield: {} },
      ],
      combat: [{ attackers: { kraken: {} }, blockers: {}, isBlocked: true, defenderId: 'p-opp' }],
    }
    const { container, unmount } = render(<CombatArrowsOverlay game={game as never} boardRef={{ current: boardDiv }} />)
    expect(container.querySelector('.arrow-path.arrow-attack')).toBeNull()
    expect(container.querySelector('.arrow-path.arrow-block')).toBeNull()
    unmount()
    boardDiv.remove()
  })

  it('CMB-4: two blockers of one attacker land side by side on it, in their own order', () => {
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)
    const box = (el: Element, left: number, top: number) => {
      el.getBoundingClientRect = () => ({ left, top, width: 100, height: 140, right: left + 100, bottom: top + 140, x: left, y: top, toJSON: () => {} } as DOMRect)
    }
    const attacker = document.createElement('div')
    attacker.setAttribute('data-card-id', 'att-1')
    box(attacker, 300, 400)
    const left = document.createElement('div')
    left.setAttribute('data-card-id', 'blk-left')
    box(left, 100, 100)
    const right = document.createElement('div')
    right.setAttribute('data-card-id', 'blk-right')
    box(right, 500, 100)
    boardDiv.append(attacker, left, right)
    boardDiv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => {} } as DOMRect)

    const game = {
      step: 'DECLARE_BLOCKERS',
      turn: 3,
      players: [
        { playerId: 'p-me', name: 'me', life: 20, controlled: true, battlefield: { 'att-1': {} } },
        { playerId: 'p-opp', name: 'them', life: 20, controlled: false, battlefield: { 'blk-left': {}, 'blk-right': {} } },
      ],
      combat: [{ attackers: { 'att-1': {} }, blockers: { 'blk-left': {}, 'blk-right': {} }, isBlocked: true, defenderId: 'p-opp' }],
    }
    const { container, unmount } = render(<CombatArrowsOverlay game={game as never} boardRef={{ current: boardDiv }} />)
    const ends = [...container.querySelectorAll('.arrow-group.arrow-block')].map((g) => {
      const d = g.querySelector('.arrow-path')!.getAttribute('d')!
      const numbers = d.split(/[ MC]+/).filter(Boolean).map(Number)
      return { from: g.getAttribute('data-arrow-from'), x: numbers[numbers.length - 2] }
    })
    expect(ends).toHaveLength(2)
    const leftTie = ends.find((e) => e.from === 'blk-left')!
    const rightTie = ends.find((e) => e.from === 'blk-right')!
    // Each lands on its own spot of the attacker, and the left blocker's is the left one.
    expect(leftTie.x).not.toBe(rightTie.x)
    expect(leftTie.x).toBeLessThan(rightTie.x)
    unmount()
    boardDiv.remove()
  })

  it('TGT-12: both ends sit over their own card, on the sides that face each other', () => {
    const box = (x: number, y: number, w: number, h: number) =>
      ({ x, y, rect: { width: w, height: h } as DOMRect })
    // Straight up: inside the source's top half and inside the target's bottom half, not on the edges.
    const up = arrowAnchors(box(100, 300, 80, 120), box(100, 100, 80, 120))
    expect(up.a.x).toBe(100)
    expect(up.a.y).toBeGreaterThan(240)
    expect(up.a.y).toBeLessThan(300)
    expect(up.b.y).toBeLessThan(160)
    expect(up.b.y).toBeGreaterThan(100)
    // Straight across: the sides, never the top and the bottom.
    const across = arrowAnchors(box(100, 300, 80, 120), box(400, 300, 80, 120))
    expect(across.a.y).toBe(300)
    expect(across.b.y).toBe(300)
    expect(across.a.x).toBeGreaterThan(100)
    expect(across.a.x).toBeLessThan(140)
    expect(across.b.x).toBeGreaterThan(360)
    expect(across.b.x).toBeLessThan(400)
    // Down and to the right: the bottom-right corner of the source, the top-left of the target.
    const diagonal = arrowAnchors(box(100, 100, 80, 120), box(300, 300, 80, 120))
    expect(diagonal.a.x).toBeGreaterThan(100)
    expect(diagonal.a.y).toBeGreaterThan(100)
    expect(diagonal.b.x).toBeLessThan(300)
    expect(diagonal.b.y).toBeLessThan(300)
  })

  it('TGT-12: the curve is a shallow arc between those ends, never a loop', () => {
    const path = arrowPath({ x: 0, y: 200 }, { x: 0, y: 0 })
    expect(path.startsWith('M 0 200 C ')).toBe(true)
    expect(path.endsWith(' 0 0')).toBe(true)
    const handles = path.replace('M 0 200 C ', '').split(' ').map(Number)
    // Both handles stay between the two ends, so the beam never swings past either of them.
    expect(handles[1]).toBeLessThanOrEqual(200)
    expect(handles[1]).toBeGreaterThanOrEqual(0)
    expect(handles[3]).toBeLessThanOrEqual(200)
    expect(handles[3]).toBeGreaterThanOrEqual(0)
    // The bow is a fraction of the span, not the old 35%.
    expect(Math.abs(handles[0])).toBeLessThanOrEqual(200 * 0.17)
    // TGT-12: told the board's height, the handles stay inside it instead of swinging off screen.
    const bounded = arrowPath({ x: 0, y: 0 }, { x: 0, y: 200 }, 300)
    for (const value of bounded.replace('M 0 0 C ', '').split(' ').map(Number).filter((_, i) => i % 2 === 1)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(300)
    }
  })

  it('TGT-12: an arrow between two objects on the stack swings out past the cascade and still rises into its target from below', () => {
    const d = stackLoopPath({ x: 1100, y: 300 }, { x: 1010, y: 560 }, 900, 900)
    expect(d.startsWith('M 1100 300 C 1100 ')).toBe(true)
    const nums = d.match(/-?\d+/g)!.map(Number)
    expect(nums[3], 'it leaves upwards').toBeLessThan(300)
    const xs = nums.filter((_, i) => i % 2 === 0)
    expect(Math.min(...xs), 'it goes round the cascade, not through it').toBe(900)
    const [, , c2x, c2y, ex, ey] = nums.slice(-6)
    expect([ex, ey]).toEqual([1010, 560])
    expect(c2x, 'the last handle sits straight under the target').toBe(1010)
    expect(c2y, 'so the dart rises into its bottom edge').toBeGreaterThan(560)
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
    const coords = container.querySelector('.arrow-path.arrow-attack')!.getAttribute('d')!.split(/[ MCQ]+/).filter(Boolean).map(Number)
    const [x2, y2] = coords.slice(-2)
    // The beam stops a dart short of the portrait, which is where the head lands (TGT-11).
    expect(x2).toBeGreaterThanOrEqual(500 - ARROW_HEAD)
    expect(x2).toBeLessThanOrEqual(560 + ARROW_HEAD)
    expect(y2).toBeGreaterThanOrEqual(100 - ARROW_HEAD)
    expect(y2).toBeLessThanOrEqual(160 + ARROW_HEAD)

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

describe('CMB-14: a group whose defender the view does not name', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} }) as DOMRect

  function board(defenderId: string | undefined) {
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)
    boardDiv.getBoundingClientRect = () => rect(0, 0, 1000, 800)
    const att = document.createElement('div')
    att.setAttribute('data-card-id', 'att-1')
    att.getBoundingClientRect = () => rect(100, 400, 100, 140)
    boardDiv.appendChild(att)
    for (const id of ['p-me', 'p-opp']) {
      const zone = document.createElement('div')
      zone.setAttribute('data-player-id', id)
      zone.getBoundingClientRect = () => rect(0, 0, 400, 200)
      const avatar = document.createElement('div')
      avatar.setAttribute('data-player-anchor', id)
      avatar.getBoundingClientRect = () => rect(100, 50, 60, 60)
      zone.appendChild(avatar)
      boardDiv.appendChild(zone)
    }
    const game = {
      step: 'DECLARE_BLOCKERS',
      turn: 4,
      activePlayerId: 'p-me',
      myPlayerId: 'p-me',
      combat: [{ attackers: { 'att-1': {} }, blockers: {}, ...(defenderId ? { defenderId } : null) }],
      players: [
        { playerId: 'p-me', name: 'me', life: 20, controlled: true, battlefield: { 'att-1': {} } },
        { playerId: 'p-opp', name: 'opp', life: 20, controlled: false, battlefield: {} },
      ],
    }
    return { boardRef: { current: boardDiv }, game }
  }

  it('CMB-14: draws no beam, instead of sending it to the other player', () => {
    // What happens when a planeswalker under attack leaves: the group stops naming a defender.
    const { boardRef, game } = board(undefined)
    const { container, unmount } = render(<CombatArrowsOverlay game={game as never} boardRef={boardRef} />)
    expect(container.querySelector('.arrow-path.arrow-attack')).toBeNull()
    unmount()
  })

  it('CMB-14: a group that does name its defender keeps its beam', () => {
    const { boardRef, game } = board('p-opp')
    const { container, unmount } = render(<CombatArrowsOverlay game={game as never} boardRef={boardRef} />)
    expect(container.querySelector('.arrow-path.arrow-attack')).not.toBeNull()
    unmount()
  })
})

describe('CMB-18: a chosen attacker with no defender named', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} }) as DOMRect

  const table = (seats: string[]) => {
    const boardDiv = document.createElement('div')
    document.body.appendChild(boardDiv)
    boardDiv.getBoundingClientRect = () => rect(0, 0, 1000, 800)

    const attCard = document.createElement('div')
    attCard.setAttribute('data-card-id', 'att-1')
    attCard.getBoundingClientRect = () => rect(100, 400, 100, 140)
    boardDiv.appendChild(attCard)

    seats.forEach((id, i) => {
      const zone = document.createElement('div')
      zone.setAttribute('data-player-id', id)
      zone.getBoundingClientRect = () => rect(i * 300, 0, 300, 200)
      const avatar = document.createElement('div')
      avatar.setAttribute('data-player-anchor', id)
      avatar.getBoundingClientRect = () => rect(100 + i * 300, 50, 60, 60)
      zone.appendChild(avatar)
      boardDiv.appendChild(zone)
    })

    const game = {
      step: 'DECLARE_ATTACKERS',
      turn: 3,
      activePlayerId: 'p-me',
      myPlayerId: 'p-me',
      combat: [],
      players: [
        { playerId: 'p-me', name: 'me', life: 20, controlled: true, battlefield: { 'att-1': {} } },
        ...seats.map((id) => ({ playerId: id, name: id, life: 20, controlled: false, battlefield: {} })),
      ],
    }
    return { boardRef: { current: boardDiv }, game }
  }

  it('CMB-18: with more than one seat to attack, the marked creature draws no arrow at a guessed one', () => {
    const { boardRef, game } = table(['p-a', 'p-b'])
    const { container, unmount } = render(
      <CombatArrowsOverlay game={game as never} boardRef={boardRef} combatMode="attack" combatChosen={['att-1']} />,
    )
    expect(container.querySelector('.arrow-path.arrow-attack')).toBeNull()
    unmount()
  })

  it('CMB-18: with one seat to attack there is nothing to guess, so the arrow is drawn', () => {
    const { boardRef, game } = table(['p-a'])
    const { container, unmount } = render(
      <CombatArrowsOverlay game={game as never} boardRef={boardRef} combatMode="attack" combatChosen={['att-1']} />,
    )
    expect(container.querySelector('.arrow-path.arrow-attack')).not.toBeNull()
    unmount()
  })
})

describe('CombatArrowsOverlay — stacking', () => {
  const css = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')

  /** Every numeric `z-index` a stylesheet declares, with the selector it belongs to. */
  const layers = (file: string): { selector: string; z: number }[] => {
    const out: { selector: string; z: number }[] = []
    const blocks = css(file).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)
    for (const [, selector, body] of blocks) {
      const z = body.match(/z-index:\s*(-?\d+)\s*;/)
      if (z) out.push({ selector: selector.trim().replace(/\s+/g, ' '), z: Number(z[1]) })
    }
    return out
  }

  const arrowsZ = (): number => {
    const found = layers('./CombatArrowsOverlay.css').filter((l) => l.selector === '.combat-arrows-overlay')
    expect(found.length).toBe(1)
    return found[0].z
  }

  it("TGT-10: an arrow is drawn over every layer of the board's own chrome", () => {
    // The board's chrome: the zones and their piles, the seat strip, the phase ladder, the player
    // chips. A ghost or an overlay is not chrome, it is an effect painted over the board on
    // purpose, and the arrows share that range with it.
    const chrome = [
      './BoardZone.css',
      './ArenaBoard.css',
      './BoardShell.css',
      '../game/PhaseLadder.css',
      '../game/PlayerInfoBar.css',
    ]
      .flatMap(layers)
      .filter((l) => !/ghost|overlay|preview/i.test(l.selector))

    expect(chrome.length).toBeGreaterThan(5)
    const highest = chrome.reduce((a, b) => (b.z > a.z ? b : a))
    expect(`arrows ${arrowsZ()} over ${highest.selector} ${highest.z}`).toBe(
      `arrows ${arrowsZ()} over ${highest.selector} ${Math.min(highest.z, arrowsZ() - 1)}`,
    )
  })

  it('TGT-11: an arrow is a beam in one colour, with a halo and a seam and no dash pattern', () => {
    const sheet = css('./CombatArrowsOverlay.css')
    expect(sheet).not.toMatch(/stroke-dasharray/)
    expect(sheet).not.toMatch(/stroke-dashoffset/)
    expect(sheet).not.toContain(".arrow-glow")
    expect(sheet).toContain(".arrow-shadow")
  })

  it('TGT-10: an arrow still passes under a card lifted out of the hand', () => {
    const lifted = layers('./HandBar.css').filter((l) => /hand-card-slot:hover/.test(l.selector))
    expect(lifted.length).toBe(1)
    expect(arrowsZ()).toBeLessThan(lifted[0].z)
  })
})
