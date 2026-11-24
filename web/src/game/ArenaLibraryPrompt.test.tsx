import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import ArenaLibraryPrompt from './ArenaLibraryPrompt'
import FeedbackDialog from './FeedbackDialog'
import { parseFeedback } from './feedback'
import type { FeedbackPrompt } from './feedback'
import { createLibraryPlan } from './feedback/libraryPlan'
import { setState } from '../state/state'
import { t } from '../i18n'
import { startLibraryPlan } from '../state/libraryPlanRunner'

vi.mock('../board/cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

vi.mock('../state/libraryPlanRunner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/libraryPlanRunner')>()),
  startLibraryPlan: vi.fn(),
}))

const start = vi.mocked(startLibraryPlan)

const SURVEIL = 'Select card(s) to PUT into your GRAVEYARD (Surveil)'
const SCRY = 'Select up to 3 cards to PUT on the BOTTOM of your library (Scry)'
const ZONE_X: Record<string, number> = { away: 0, top: 1200 }

class TestPointerEvent extends MouseEvent {
  pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
  }
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

function rectOf(el: Element): DOMRect {
  const zone = el.closest('[data-arena-zone]')?.getAttribute('data-arena-zone')
  const x = zone ? ZONE_X[zone] : 0
  if (el.classList.contains('arena-fan') || el.classList.contains('arena-fan-lane')) return rect(x, 0, 1000, 400)
  const slot = el.closest('[data-arena-card]')
  if (slot) {
    const ids = [...slot.parentElement!.querySelectorAll('[data-arena-card]')]
    return rect(x + 300 + ids.indexOf(slot) * 100, 100, 100, 139)
  }
  return rect(0, 0, 0, 0)
}

function promptOf(ids: string[], message = SURVEIL, gameId = 'g1'): FeedbackPrompt {
  const prompt = parseFeedback('GAME_TARGET', gameId, {
    message,
    targets: ids,
    cardsView1: Object.fromEntries(ids.map((id) => [id, { id, name: `Card ${id}` }])),
    min: 0,
    max: ids.length,
  })
  if (!prompt) throw new Error('library pick did not parse')
  prompt.sourceName = 'Nightveil Sprite'
  return prompt
}

function zoneIds(zone: string): string[] {
  const fan = document.querySelector(`[data-arena-zone="${zone}"]`)!
  return [...fan.querySelectorAll('.arena-fan-lane > [data-arena-card]')].map((el) => el.getAttribute('data-arena-card')!)
}

function face(id: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-arena-card="${id}"] .arena-fan-card`)!
}

function clickCard(id: string) {
  act(() => {
    fireEvent.pointerDown(face(id), { button: 0, pointerId: 1, clientX: 10, clientY: 10 })
  })
  act(() => {
    fireEvent.pointerUp(face(id), { pointerId: 1, clientX: 10, clientY: 10 })
  })
}

function doneButton(): HTMLButtonElement {
  return screen.getByTestId('arena-library-done') as HTMLButtonElement
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectOf(this)
  })
  start.mockClear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  setState({ feedback: null, libraryPlan: null, libraryPrompt: null })
})

describe('ArenaLibraryPrompt', () => {
  it('PRM-20: all prompt cards start in the library box in prompt order behind the deck back', () => {
    render(<ArenaLibraryPrompt prompt={promptOf(['a', 'b', 'c'])} sending={false} />)
    expect(screen.getByRole('dialog', { name: t('dialogs', 'arena_surveil_title') }).getAttribute('data-testid')).toBe('arena-library-prompt')
    expect(zoneIds('top')).toEqual(['a', 'b', 'c'])
    expect(zoneIds('away')).toEqual([])
    const lane = document.querySelector('[data-arena-zone="top"] .arena-fan-lane')!
    expect(lane.firstElementChild?.classList.contains('arena-fan-back')).toBe(true)
    expect(document.querySelector('[data-arena-zone="away"] .arena-fan-back')).toBeNull()
    expect(screen.getByText(t('dialogs', 'arena_zone_library'))).not.toBeNull()
    expect(screen.getByText(t('dialogs', 'arena_zone_graveyard'))).not.toBeNull()
    expect(screen.getByText(t('dialogs', 'arena_surveil_hint'))).not.toBeNull()
  })

  it('shows the source card by name beside the boxes', () => {
    render(<ArenaLibraryPrompt prompt={promptOf(['a'])} sending={false} />)
    expect(document.querySelector('.arena-prompt-aside [data-card-name="Nightveil Sprite"]')).not.toBeNull()
  })

  it('PRM-20: clicking a card moves it to the other box', () => {
    render(<ArenaLibraryPrompt prompt={promptOf(['a', 'b', 'c'])} sending={false} />)
    clickCard('b')
    expect(zoneIds('top')).toEqual(['a', 'c'])
    expect(zoneIds('away')).toEqual(['b'])
    clickCard('b')
    expect(zoneIds('top')).toEqual(['a', 'c', 'b'])
    expect(zoneIds('away')).toEqual([])
  })

  it('PRM-20: a card dropped on a box lands at the hovered slot', () => {
    render(<ArenaLibraryPrompt prompt={promptOf(['a', 'b', 'c'])} sending={false} />)
    const root = document.querySelector('.arena-library')!
    act(() => {
      fireEvent.pointerDown(face('a'), { button: 0, pointerId: 1, clientX: 1550, clientY: 150 })
    })
    act(() => {
      fireEvent.pointerMove(root, { pointerId: 1, clientX: 500, clientY: 200 })
    })
    expect(document.querySelector('[data-arena-zone="away"]')!.classList.contains('is-hot')).toBe(true)
    expect(zoneIds('top')).toEqual(['b', 'c'])
    act(() => {
      fireEvent.pointerUp(root, { pointerId: 1, clientX: 500, clientY: 200 })
    })
    expect(zoneIds('top')).toEqual(['b', 'c'])
    expect(zoneIds('away')).toEqual(['a'])
  })

  it('PRM-20: Done starts the plan with both boxes read left to right', () => {
    const prompt = promptOf(['a', 'b', 'c', 'd'])
    render(<ArenaLibraryPrompt prompt={prompt} sending={false} />)
    clickCard('c')
    clickCard('b')
    fireEvent.click(doneButton())
    expect(start).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith(prompt, { mode: 'surveil', top: ['a', 'd'], away: ['c', 'b'] })
  })

  it('PRM-20: while sending the cards take no pointer events and Done is disabled', () => {
    const prompt = promptOf(['a', 'b'])
    render(<ArenaLibraryPrompt prompt={prompt} sending />)
    expect(document.querySelector('.arena-library')!.classList.contains('is-sending')).toBe(true)
    clickCard('a')
    expect(zoneIds('top')).toEqual(['a', 'b'])
    expect(doneButton().disabled).toBe(true)
    expect(doneButton().textContent).toBe(t('dialogs', 'arena_sending'))
    fireEvent.click(doneButton())
    expect(start).not.toHaveBeenCalled()
  })

  it('PRM-20: a scry labels the boxes top and bottom of library', () => {
    const prompt = promptOf(['a', 'b'], SCRY)
    render(<ArenaLibraryPrompt prompt={prompt} sending={false} />)
    expect(screen.getByRole('dialog', { name: t('dialogs', 'arena_scry_title') })).not.toBeNull()
    expect(screen.getByText(t('dialogs', 'arena_zone_top'))).not.toBeNull()
    expect(screen.getByText(t('dialogs', 'arena_zone_bottom'))).not.toBeNull()
    expect(screen.getByText(t('dialogs', 'arena_scry_hint'))).not.toBeNull()
    clickCard('a')
    fireEvent.click(doneButton())
    expect(start).toHaveBeenCalledWith(prompt, { mode: 'scry', top: ['b'], away: ['a'] })
  })
})

describe('FeedbackDialog routing of a surveil or scry', () => {
  it('PRM-20: a surveil pick opens the Arena overlay instead of the card grid', () => {
    setState({ feedback: promptOf(['a', 'b']) })
    render(<FeedbackDialog />)
    expect(screen.getByTestId('arena-library-prompt')).not.toBeNull()
    expect(doneButton().disabled).toBe(false)
  })

  it('PRM-20: a scry pick opens the Arena overlay', () => {
    setState({ feedback: promptOf(['a', 'b'], SCRY) })
    render(<FeedbackDialog />)
    expect(screen.getByRole('dialog', { name: t('dialogs', 'arena_scry_title') })).not.toBeNull()
  })

  it('PRM-20: the overlay keeps its arrangement and shows sending while the plan runs', () => {
    const prompt = promptOf(['a', 'b', 'c'])
    setState({ feedback: prompt })
    render(<FeedbackDialog />)
    clickCard('b')
    act(() => {
      setState({ feedback: null, libraryPrompt: prompt, libraryPlan: createLibraryPlan('g1', ['a', 'b', 'c'], { mode: 'surveil', top: ['a', 'c'], away: ['b'] }) })
    })
    expect(zoneIds('top')).toEqual(['a', 'c'])
    expect(zoneIds('away')).toEqual(['b'])
    expect(doneButton().disabled).toBe(true)
    expect(document.querySelector('[data-prompt-method]')).toBeNull()
    expect(document.querySelector('[data-library-plan]')).not.toBeNull()
    act(() => {
      setState({ libraryPlan: null, libraryPrompt: null })
    })
    expect(screen.queryByTestId('arena-library-prompt')).toBeNull()
  })

  it('PRM-20: a re-sent pick opens with its already chosen cards in the graveyard box', () => {
    const prompt = promptOf(['a', 'b', 'c'])
    prompt.chosenTargets = ['c', 'a']
    render(<ArenaLibraryPrompt prompt={prompt} sending={false} />)
    expect(zoneIds('top')).toEqual(['b'])
    expect(zoneIds('away')).toEqual(['a', 'c'])
    fireEvent.click(doneButton())
    expect(start).toHaveBeenCalledWith(prompt, { mode: 'surveil', top: ['b'], away: ['a', 'c'] })
  })

  it('PRM-20: a new surveil pick opens with a fresh arrangement', () => {
    setState({ feedback: promptOf(['a', 'b']) })
    render(<FeedbackDialog />)
    clickCard('a')
    expect(zoneIds('away')).toEqual(['a'])
    act(() => {
      setState({ feedback: promptOf(['a', 'b']) })
    })
    expect(zoneIds('top')).toEqual(['a', 'b'])
    expect(zoneIds('away')).toEqual([])
  })
})
