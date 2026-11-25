import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StackZone from './StackZone'
import type { CardView, PlayerView } from '../net/types'
import { setState } from '../state/state'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

vi.mock('../cards/cardImages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cards/cardImages')>()),
  awaitImageUrl: vi.fn().mockResolvedValue('https://img.test/card.jpg'),
  isAbilityCard: vi.fn().mockImplementation((card: CardView) => {
    const t = card.mageObjectType ?? ''
    return t.includes('Ability') || t.includes('ABILITY')
  }),
  getSourceCardName: vi.fn().mockImplementation((card: CardView) => card.displayName ?? card.name ?? 'Habilidad'),
  cardName: vi.fn().mockImplementation((card: CardView) => card.displayName ?? card.name ?? 'Habilidad'),
}))

const spell = (id: string, name: string, over: Partial<CardView> = {}): CardView =>
  ({ id, name, cardTypes: ['INSTANT'], manaValue: 1, ...over }) as CardView

const stackOf = (...cards: CardView[]): Record<string, CardView> =>
  Object.fromEntries(cards.map((c) => [String(c.id), c]))

const cards = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.stack-card')]
const ids = (container: HTMLElement) => cards(container).map((el) => el.getAttribute('data-card-id'))

/** The ids the board was last told to draw arrows for. */
function lastFocus(onFocusIds: ReturnType<typeof vi.fn>): string[] {
  const call = onFocusIds.mock.calls.at(-1)?.[0] as ReadonlySet<string> | null
  return call ? [...call].sort() : []
}

describe('StackZone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('STK-2: an empty stack draws nothing at all, not even a box saying so', () => {
    const { container, rerender } = render(<StackZone stack={null} />)
    expect(container.innerHTML).toBe('')
    rerender(<StackZone stack={{}} />)
    expect(container.innerHTML).toBe('')
  })

  it('STK-1: an object on the stack is drawn as the card it is', () => {
    const { container } = render(<StackZone stack={stackOf(spell('spell-1', 'Lightning Bolt'))} />)
    const card = container.querySelector<HTMLElement>('.stack-card')
    expect(card).not.toBeNull()
    expect(card!.getAttribute('data-card-id')).toBe('spell-1')
    expect(card!.querySelector('.stack-card-face')).not.toBeNull()
    expect(container.textContent).toContain('Lightning Bolt')
  })

  it('STK-1: the object that resolves next is the one in front, and it is the only one', () => {
    const { container } = render(
      <StackZone stack={stackOf(spell('spell-2', 'Counterspell'), spell('spell-1', 'Lightning Bolt'))} />,
    )
    expect(ids(container)).toEqual(['spell-2', 'spell-1'])
    expect(cards(container).map((el) => el.classList.contains('is-top'))).toEqual([true, false])
  })

  it('STK-4: three copies of the same spell are three cards, not one with a count', () => {
    const { container } = render(
      <StackZone stack={stackOf(spell('bolt-1', 'Lightning Bolt'), spell('bolt-2', 'Lightning Bolt'), spell('bolt-3', 'Lightning Bolt'))} />,
    )
    expect(ids(container)).toEqual(['bolt-1', 'bolt-2', 'bolt-3'])
    expect(container.textContent).not.toContain('×3')
    expect(container.querySelector('[data-testid="stack-cascade-more"]')).toBeNull()
  })

  it('STK-2: the grip pushes the whole stack aside, and brings it back', () => {
    const { container } = render(<StackZone stack={stackOf(spell('spell-1', 'Lightning Bolt'))} />)
    const zone = container.querySelector<HTMLElement>('.stack-zone')!
    const grip = container.querySelector<HTMLButtonElement>('[data-testid="stack-push"]')!
    expect(zone.classList.contains('is-pushed')).toBe(false)

    fireEvent.click(grip)
    expect(zone.classList.contains('is-pushed')).toBe(true)
    expect(grip.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(grip)
    expect(zone.classList.contains('is-pushed')).toBe(false)
  })

  it('STK-3: the object about to resolve points at its targets, and so does the one under the pointer', () => {
    const onFocusIds = vi.fn()
    const { container } = render(
      <StackZone stack={stackOf(spell('spell-2', 'Counterspell'), spell('spell-1', 'Lightning Bolt'))} onFocusIds={onFocusIds} />,
    )
    expect(lastFocus(onFocusIds)).toEqual(['spell-2'])

    fireEvent.mouseEnter(cards(container)[1])
    expect(lastFocus(onFocusIds)).toEqual(['spell-1', 'spell-2'])

    fireEvent.mouseLeave(cards(container)[1])
    expect(lastFocus(onFocusIds)).toEqual(['spell-2'])
  })

  it('STK-3: a stack pushed aside points at nothing', () => {
    const onFocusIds = vi.fn()
    const { container } = render(
      <StackZone stack={stackOf(spell('spell-1', 'Lightning Bolt'))} onFocusIds={onFocusIds} />,
    )
    expect(lastFocus(onFocusIds)).toEqual(['spell-1'])

    fireEvent.click(container.querySelector('[data-testid="stack-push"]')!)
    expect(lastFocus(onFocusIds)).toEqual([])
  })

  it('STK-1: clicking an object sends that object, and hovering it reports the card', () => {
    const onCardClick = vi.fn()
    const onHover = vi.fn()
    const { container } = render(
      <StackZone stack={stackOf(spell('spell-1', 'Lightning Bolt'))} onCardClick={onCardClick} onHover={onHover} />,
    )
    const card = cards(container)[0]
    expect(card.classList.contains('clickable')).toBe(true)

    fireEvent.click(card)
    expect(onCardClick).toHaveBeenCalledWith('spell-1')

    fireEvent.mouseEnter(card)
    expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lightning Bolt' }), expect.anything())
  })

  it('TGT-7: only the objects the player may target are marked, and clicking one sends that object', () => {
    const onCardClick = vi.fn()
    const { container } = render(
      <StackZone
        stack={stackOf(spell('spell-2', 'Counterspell'), spell('spell-1', 'Lightning Bolt'))}
        targetIds={new Set(['spell-1'])}
        onCardClick={onCardClick}
      />,
    )
    const [top, under] = cards(container)
    expect(top.classList.contains('targetable')).toBe(false)
    expect(under.classList.contains('targetable')).toBe(true)

    fireEvent.click(under)
    expect(onCardClick).toHaveBeenCalledWith('spell-1')
  })

  it('TGT-7: being asked to target something on the stack brings it back into view', () => {
    const stack = stackOf(spell('spell-1', 'Lightning Bolt'))
    const { container, rerender } = render(<StackZone stack={stack} />)
    fireEvent.click(container.querySelector('[data-testid="stack-push"]')!)
    expect(container.querySelector('.stack-zone')!.classList.contains('is-pushed')).toBe(true)

    rerender(<StackZone stack={stack} targetIds={new Set(['spell-1'])} />)
    expect(container.querySelector('.stack-zone')!.classList.contains('is-pushed')).toBe(false)
  })

  it('STK-7: the object in front is read in the bubble, an ability and a spell alike, and nothing is written over the card', () => {
    const ability = spell('ability-1', 'Soul Warden', {
      mageObjectType: 'TRIGGERED_ABILITY',
      rules: ['You gain 1 life.'],
    })
    const instant = spell('spell-1', 'Lightning Bolt', { rules: ['Lightning Bolt deals 3 damage to any target.'] })

    const { container, rerender } = render(<StackZone stack={stackOf(ability)} />)
    expect(container.querySelector('.stack-card')!.classList.contains('is-ability')).toBe(true)
    expect(container.querySelector('[data-testid="stack-bubble-body"]')?.textContent).toContain('You gain 1 life.')
    expect(container.querySelector('.stack-card .stack-tl-rules, .stack-card .stack-controller-pill')).toBeNull()

    rerender(<StackZone stack={stackOf(instant)} />)
    expect(container.querySelector('.stack-card')!.classList.contains('is-spell')).toBe(true)
    expect(container.querySelector('[data-testid="stack-bubble-body"]')?.textContent).toContain('Lightning Bolt deals 3 damage')
  })
})

describe('StackZone, the bubble', () => {
  const tab = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('[data-testid="stack-bubble-tab"]')!
  const body = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-testid="stack-bubble-body"]')!
  const two = () => stackOf(
    spell('spell-2', 'Counterspell', { rules: ['Counter target spell.'] }),
    spell('spell-1', 'Lightning Bolt', { rules: ['Lightning Bolt deals 3 damage to any target.'] }),
  )

  it('STK-10: it comes open on the object about to resolve, with no pointer and no click', () => {
    const { container } = render(<StackZone stack={two()} />)
    expect(tab(container).getAttribute('aria-expanded')).toBe('true')
    expect(body(container).hidden).toBe(false)
    expect(body(container).textContent).toContain('Counter target spell')
    expect(container.querySelector('.stack-bubble-chevron')).not.toBeNull()
  })

  it('STK-10: the pointer moves it onto the card under it, and it falls back a moment after leaving', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<StackZone stack={two()} />)
      const behind = cards(container)[1]
      fireEvent.mouseEnter(behind)
      expect(body(container).textContent).toContain('Lightning Bolt deals 3 damage')
      expect(behind.classList.contains('is-reading'), 'the card being read is ringed').toBe(true)

      fireEvent.mouseLeave(behind)
      fireEvent.mouseEnter(container.querySelector('[data-testid="stack-bubble"]')!)
      act(() => { vi.advanceTimersByTime(1000) })
      expect(body(container).textContent, 'crossing to the bubble keeps the card that was being read').toContain('Lightning Bolt')
      expect(behind.classList.contains('is-reading'), 'which keeps its ring, so the text plainly belongs to it').toBe(true)
      expect(container.querySelector<HTMLElement>('[data-testid="stack-bubble"]')!.style.getPropertyValue('--read-i'), 'and the tail points at it').toBe('1')

      fireEvent.mouseLeave(container.querySelector('[data-testid="stack-bubble"]')!)
      expect(body(container).textContent, 'it does not jump back the instant the pointer leaves').toContain('Lightning Bolt')
      act(() => { vi.advanceTimersByTime(1000) })
      expect(tab(container).getAttribute('aria-expanded'), 'and it is still open, because nothing folded it').toBe('true')
      expect(tab(container).textContent, 'reading the object about to resolve again').toContain('Counterspell')
      expect(behind.classList.contains('is-reading'), 'with no ring left on the card the pointer left').toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('STK-10: the strip is what folds it away, and what brings it back', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<StackZone stack={two()} />)
      fireEvent.click(tab(container))
      act(() => { vi.advanceTimersByTime(1000) })
      expect(tab(container).getAttribute('aria-expanded')).toBe('false')
      expect(body(container).hidden).toBe(true)
      fireEvent.click(tab(container))
      act(() => { vi.advanceTimersByTime(1000) })
      expect(tab(container).getAttribute('aria-expanded')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('STK-10: folded by hand, it stays folded while that stack lasts and comes back with the next one', () => {
    vi.useFakeTimers()
    try {
      const { container, rerender } = render(<StackZone stack={two()} />)
      fireEvent.click(tab(container))
      act(() => { vi.advanceTimersByTime(1000) })
      expect(tab(container).getAttribute('aria-expanded')).toBe('false')

      // the pointer does not undo the fold: only the strip does
      fireEvent.mouseEnter(cards(container)[1])
      expect(tab(container).getAttribute('aria-expanded')).toBe('false')
      fireEvent.mouseLeave(cards(container)[1])

      rerender(<StackZone stack={{}} />)
      act(() => { vi.advanceTimersByTime(1000) })
      rerender(<StackZone stack={two()} />)
      act(() => { vi.advanceTimersByTime(1000) })
      expect(tab(container).getAttribute('aria-expanded'), 'a stack that has run out leaves no fold behind').toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('STK-10: it hangs under the cascade down to the dock, and over the front card when there is no room for it', () => {
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
    let dockTop = 700
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.classList.contains('stack-cascade')) return rect(200, 500)
      if (this.classList.contains('game-dock')) return rect(dockTop, 760)
      return rect(0, 800)
    })
    const dock = document.createElement('div')
    dock.className = 'game-dock'
    document.body.appendChild(dock)
    try {
      const { container, unmount } = render(<StackZone stack={two()} />)
      const bubble = container.querySelector<HTMLElement>('[data-testid="stack-bubble"]')!
      expect(bubble.classList.contains('is-below')).toBe(true)
      const zone = container.querySelector<HTMLElement>('[data-testid="stack-zone"]')!
      // STK-10: the room above the dock, less the clearance it keeps from the button under it.
      expect(zone.style.getPropertyValue('--bubble-max'), 'its height is the room above the dock').toBe('164px')
      unmount()

      dockTop = 540
      const again = render(<StackZone stack={two()} />)
      expect(again.container.querySelector('[data-testid="stack-bubble"]')!.classList.contains('is-inside')).toBe(true)
    } finally {
      spy.mockRestore()
      dock.remove()
    }
  })
})

describe('StackZone, who controls each object', () => {
  const me = { playerId: 'p-human', name: 'Mage Web', life: 20, controlled: true, isHuman: true } as PlayerView
  const opponent = { playerId: 'p-opp', name: 'SimBot', life: 20, controlled: false, isHuman: false } as PlayerView
  const pill = (container: HTMLElement) => container.querySelector<HTMLElement>('.stack-controller-pill')!

  it('STK-6: the object being read says whose it is, mine apart from theirs', () => {
    const { container } = render(
      <StackZone
        stack={stackOf(
          spell('spell-mine', 'Lightning Bolt', { controllerId: 'p-human' }),
          spell('spell-opp', 'Counterspell', { controllerId: 'p-opp' }),
        )}
        players={[me, opponent]}
        myPlayerId="p-human"
      />,
    )
    expect(pill(container).classList.contains('is-me')).toBe(true)
    expect(pill(container).textContent).toContain('Tú')
    fireEvent.mouseEnter(cards(container)[1])
    expect(pill(container).classList.contains('is-opp')).toBe(true)
    expect(pill(container).textContent).toContain('SimBot')
  })

  it('STK-6: a watcher is never told that someone else\'s spell is theirs', () => {
    const { container } = render(
      <StackZone stack={stackOf(spell('spell-watched', 'Counterspell', { controllerId: 'p-opp' }))} players={[opponent]} />,
    )
    expect(pill(container).classList.contains('is-me')).toBe(false)
    expect(pill(container).classList.contains('is-opp')).toBe(true)
    expect(pill(container).textContent).toContain('SimBot')
    expect(pill(container).textContent).not.toContain('Tú')
  })

  it('STK-6: an object that says nothing about its controller is marked unknown, not mine', () => {
    const { container } = render(
      <StackZone stack={stackOf(spell('spell-unknown', 'Mystic Remora', { cardTypes: ['ENCHANTMENT'] }))} players={[opponent]} />,
    )
    expect(pill(container).classList.contains('is-me')).toBe(false)
    expect(pill(container).textContent).not.toContain('Tú')
    expect(pill(container).textContent).toContain('Desconocido')
  })

  it('STK-6: an ability is attributed through the card that made it', () => {
    const ability = {
      id: 'ability-watched',
      name: 'Ability',
      mageObjectType: 'TRIGGERED_ABILITY',
      sourceCard: { controllerId: 'p-opp', controllerName: 'SimBot' },
    } as unknown as CardView

    const { container } = render(<StackZone stack={stackOf(ability)} players={[opponent]} />)
    expect(pill(container).classList.contains('is-opp')).toBe(true)
    expect(pill(container).textContent).toContain('SimBot')
    expect(pill(container).textContent).not.toContain('Desconocido')
  })
})

describe('StackZone, the preview the pointer opens', () => {
  const preview = (container: HTMLElement) => container.querySelector('.floating-card-preview')

  it('STK-5: the preview closes when the card it was showing leaves the stack', () => {
    const onHover = vi.fn()
    const stack = stackOf(spell('spell-2', 'Counterspell'), spell('spell-1', 'Lightning Bolt'))
    const { container, rerender } = render(<StackZone stack={stack} onHover={onHover} />)

    fireEvent.mouseEnter(cards(container)[0])
    expect(preview(container)).not.toBeNull()

    rerender(<StackZone stack={stackOf(stack['spell-1'])} onHover={onHover} />)
    expect(preview(container)).toBeNull()
    expect(onHover).toHaveBeenCalledWith(null)
  })

  it('STK-5: a resolved card never comes back when the stack fills again', async () => {
    const { container, rerender } = render(<StackZone stack={stackOf(spell('spell-1', 'Lightning Bolt'))} />)
    fireEvent.mouseEnter(cards(container)[0])
    expect(preview(container)).not.toBeNull()

    rerender(<StackZone stack={{}} />)
    expect(container.innerHTML).toBe('')

    rerender(<StackZone stack={stackOf(spell('spell-9', 'Giant Growth'))} />)
    expect(preview(container)).toBeNull()

    await act(async () => {
      fireEvent.mouseEnter(cards(container)[0])
    })
    expect(container.querySelector('.floating-card-img')?.getAttribute('alt')).toBe('Giant Growth')
  })

  it('STK-5: a card entering the stack does not close the preview of the one being read', () => {
    const bolt = spell('spell-1', 'Lightning Bolt')
    const { container, rerender } = render(<StackZone stack={stackOf(bolt)} />)
    fireEvent.mouseEnter(cards(container)[0])
    expect(preview(container)).not.toBeNull()

    rerender(<StackZone stack={stackOf(spell('spell-2', 'Counterspell'), bolt)} />)
    expect(preview(container)).not.toBeNull()
  })
})

describe('StackZone, the whole stack in the zone viewer', () => {
  beforeEach(cleanup)
  afterEach(cleanup)
  const three = () => stackOf(
    spell('spell-3', 'Fireball'),
    spell('spell-2', 'Counterspell'),
    spell('spell-1', 'Lightning Bolt'),
  )
  const viewer = () => document.body.querySelector<HTMLElement>('[data-testid="stack-viewer"]')
  const items = () => [...document.body.querySelectorAll<HTMLElement>('[data-testid="stack-viewer"] .zone-fan-item')]

  it('STK-11: a button beside the stack opens every object in the zone viewer, in the cascade order with the one resolving next at the right', () => {
    const { getByTestId } = render(<StackZone stack={three()} />)
    const button = getByTestId('stack-open-viewer')
    expect(button.textContent).toContain('3')
    expect(viewer()).toBeNull()
    fireEvent.click(button)
    expect(viewer()).not.toBeNull()
    expect(items().map((el) => el.getAttribute('data-card-id'))).toEqual(['spell-1', 'spell-2', 'spell-3'])
    expect(items()[2].textContent).toContain('#1')
    expect(items()[2].classList.contains('is-top-card')).toBe(true)
    expect(items()[0].textContent).toContain('#3')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(viewer()).toBeNull()
  })

  it('STK-11: an object the prompt can target is chosen from the viewer too', () => {
    const onCardClick = vi.fn()
    const { getByTestId } = render(<StackZone stack={three()} targetIds={new Set(['spell-2'])} onCardClick={onCardClick} />)
    fireEvent.click(getByTestId('stack-open-viewer'))
    const target = items()[1].querySelector<HTMLElement>('.stack-viewer-card')!
    expect(target.classList.contains('targetable')).toBe(true)
    fireEvent.click(target)
    expect(onCardClick).toHaveBeenCalledWith('spell-2')
  })

  it('STK-11: the viewer button stays reachable while the stack is pushed aside', () => {
    const { getByTestId } = render(<StackZone stack={three()} />)
    fireEvent.click(getByTestId('stack-push'))
    fireEvent.click(getByTestId('stack-open-viewer'))
    expect(viewer()).not.toBeNull()
  })
})

describe('StackZone, a stack longer than the viewer fan', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('STK-11: the viewer opens on the object about to resolve, even when the fan cannot hold every object', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('zone-fan-item') ? 100 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('zone-fan-item') ? 140 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('zone-fan') ? 500 : 0
    })
    const many = stackOf(...Array.from({ length: 14 }, (_, i) => spell(`s-${i}`, `Spell ${i}`)))
    const { getByTestId } = render(<StackZone stack={many} />)
    fireEvent.click(getByTestId('stack-open-viewer'))
    const fanItems = [...document.body.querySelectorAll<HTMLElement>('[data-testid="stack-viewer"] .zone-fan-item')]
    const first = fanItems.find((el) => el.getAttribute('data-card-id') === 's-0')!
    const last = fanItems.find((el) => el.getAttribute('data-card-id') === 's-13')!
    expect(first.classList.contains('is-piled') || first.classList.contains('is-off-fan'), 'the object about to resolve is on the fan').toBe(false)
    expect(last.classList.contains('is-piled') || last.classList.contains('is-off-fan'), 'the one resolving last waits in the left pile').toBe(true)
  })
})

describe('StackZone viewer, what the object being read does and what it aims at', () => {
  afterEach(() => {
    cleanup()
    setState({ game: null })
  })

  const elf = makePermanent({ name: 'Elvish Mystic', parentId: 'perm-elf' })
  const bolt = spell('spell-bolt', 'Lightning Bolt', { rules: ['Lightning Bolt deals 3 damage to any target.'], targets: ['p-bob'] })
  const path = spell('spell-path', 'Path to Exile', { rules: ['Exile target creature.'], targets: ['perm-elf'] })
  const counter = spell('spell-counter', 'Counterspell', { rules: ['Counter target spell.'], targets: ['spell-path'] })
  const stack = stackOf(counter, path, bolt)
  const seat = () => setState({
    game: makeGameView({
      players: [
        makePlayer({ playerId: 'p-me', name: 'Alice', controlled: true, battlefield: { 'perm-elf': elf } }),
        makePlayer({ playerId: 'p-bob', name: 'Bob' }),
      ],
      stack,
    }),
  })
  const panel = () => document.body.querySelector<HTMLElement>('[data-testid="stack-viewer-aside"]')!
  const item = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="stack-viewer"] .zone-fan-item[data-card-id="${id}"]`)!
  const open = () => {
    seat()
    const view = render(<StackZone stack={stack} />)
    fireEvent.click(view.getByTestId('stack-open-viewer'))
    return view
  }

  it('STK-12: it opens reading the object about to resolve, its text beside the fan', () => {
    open()
    expect(panel().textContent).toContain('Counterspell')
    expect(panel().textContent).toContain('Counter target spell.')
  })

  it('STK-12: a target on the stack is ringed in the fan and named by its place', () => {
    open()
    expect(item('spell-path').classList.contains('is-targeted')).toBe(true)
    expect(item('spell-bolt').classList.contains('is-targeted')).toBe(false)
    expect(panel().querySelector('[data-testid="stack-viewer-target"]')?.textContent).toContain('#2')
  })

  it('STK-12: pointing at another object reads it, and a target elsewhere is drawn as its card beside the fan', () => {
    open()
    fireEvent.mouseEnter(item('spell-path'))
    expect(panel().textContent).toContain('Exile target creature.')
    expect(panel().querySelector('[data-card-id="perm-elf"]'), 'the targeted creature is drawn as a card').not.toBeNull()
    expect(item('spell-path').classList.contains('is-targeted')).toBe(false)
  })

  it('STK-12: a player target is named', () => {
    open()
    fireEvent.mouseEnter(item('spell-bolt'))
    expect(panel().querySelector('[data-testid="stack-viewer-target"]')?.textContent).toContain('Bob')
  })
})
