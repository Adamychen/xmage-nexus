import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CombatArrowsOverlay, { arrowAnchors, arrowPath, stackLoopPath } from './CombatArrowsOverlay'

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
    // TGT-12: the attacker's card is (100,400,100,140) and the avatar (120,30,60,60), so the beam
    // leaves the top edge of the card (y 400) and comes in under the avatar (y 90).
    expect(d.startsWith('M 150 400')).toBe(true)
    expect(d.endsWith('150 90')).toBe(true)

    unmount()
    boardDiv.remove()
  })

  it('TGT-12: every arrow leaves its source through the top edge and comes into its target through the bottom edge', () => {
    const box = (x: number, y: number, w: number, h: number) =>
      ({ x, y, rect: { width: w, height: h } as DOMRect })
    const from = box(100, 300, 80, 120)
    const to = box(400, 120, 80, 120)
    expect(arrowAnchors(from, to)).toEqual({ a: { x: 100, y: 240 }, b: { x: 400, y: 180 } })
  })

  it('TGT-12: the curve leaves the source upwards and rises into the target from below', () => {
    expect(arrowPath({ x: 0, y: 200 }, { x: 0, y: 0 })).toBe('M 0 200 C 0 130 0 70 0 0')
    expect(arrowPath({ x: 0, y: 0 }, { x: 0, y: 200 })).toBe('M 0 0 C 0 -70 0 270 0 200')
    // TGT-12: told the board's height, the handles stay inside it instead of swinging off screen.
    expect(arrowPath({ x: 0, y: 0 }, { x: 0, y: 200 }, 300)).toBe('M 0 0 C 0 6 0 270 0 200')
    expect(arrowPath({ x: 0, y: 100 }, { x: 0, y: 280 }, 300)).toBe('M 0 100 C 0 37 0 294 0 280')
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
