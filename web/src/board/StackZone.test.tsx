import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StackZone from './StackZone'
import type { CardView, PlayerView } from '../net/types'

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

  it('STK-1: an ability reads its rules on the card; a spell does not repeat what its card already prints', () => {
    const ability = spell('ability-1', 'Soul Warden', {
      mageObjectType: 'TRIGGERED_ABILITY',
      rules: ['You gain 1 life.'],
    })
    const instant = spell('spell-1', 'Lightning Bolt', { rules: ['Lightning Bolt deals 3 damage to any target.'] })

    const { container, rerender } = render(<StackZone stack={stackOf(ability)} />)
    expect(container.querySelector('.stack-card')!.classList.contains('is-ability')).toBe(true)
    expect(container.querySelector('.stack-tl-rules')?.textContent).toContain('You gain 1 life.')

    rerender(<StackZone stack={stackOf(instant)} />)
    expect(container.querySelector('.stack-card')!.classList.contains('is-spell')).toBe(true)
    expect(container.querySelector('.stack-tl-rules')).toBeNull()
  })
})

describe('StackZone, who controls each object', () => {
  const me = { playerId: 'p-human', name: 'Mage Web', life: 20, controlled: true, isHuman: true } as PlayerView
  const opponent = { playerId: 'p-opp', name: 'SimBot', life: 20, controlled: false, isHuman: false } as PlayerView
  const pill = (container: HTMLElement) => container.querySelector<HTMLElement>('.stack-controller-pill')!

  it('STK-6: each card says whose it is, mine apart from theirs', () => {
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
    const pills = container.querySelectorAll('.stack-controller-pill')
    expect(pills.length).toBe(2)
    expect(pills[0].classList.contains('is-me')).toBe(true)
    expect(pills[0].textContent).toContain('Tú')
    expect(pills[1].classList.contains('is-opp')).toBe(true)
    expect(pills[1].textContent).toContain('SimBot')
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
