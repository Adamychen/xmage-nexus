import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, StrictMode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CardSlot from './CardSlot'
import type { PermanentView } from '../net/types'
import type { FeedbackPrompt } from '../game/feedback'
import { getState, setState, setSetting } from '../state/store'
import { perfClear, perfEntries } from '../system/perfProbe'
import { MTG_KEYWORDS } from '../data/mtgKeywords'

vi.mock('./cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

vi.mock('../cards/cardImages', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../cards/cardImages')>()
  return { ...mod, awaitImageUrl: vi.fn(async () => 'https://img.test/art.jpg') }
})

afterEach(() => {
  cleanup()
})

describe('CardSlot face-down permanents', () => {
  const morph = (over: Record<string, unknown> = {}) =>
    ({
      id: 'm1',
      name: 'Morph: Den Protector',
      faceDown: true,
      morphed: true,
      expansionSetCode: 'XMAGE',
      cardNumber: '0',
      imageFileName: 'Morph',
      imageNumber: 2,
      cardTypes: ['Creature'],
      power: '2',
      toughness: '2',
      ...over,
    }) as unknown as PermanentView

  it('paints the engine face-down art with the Morph badge instead of a text rectangle', async () => {
    const { container } = render(<CardSlot card={morph()} showPt />)
    await act(async () => {})
    expect(container.querySelector('img.card-image')?.getAttribute('src')).toBe('https://img.test/art.jpg')
    expect(container.querySelector('.card-placeholder')).toBeNull()
    expect(container.querySelector('.facedown-type-badge.morph')).not.toBeNull()
    expect(container.querySelector('.pt-badge')?.textContent).toBe('2/2')
  })

  it('falls back to the sleeve back (never the text placeholder) when the engine sends no art', () => {
    const { container } = render(
      <CardSlot card={morph({ expansionSetCode: '', imageFileName: '', name: '', morphed: false, manifested: true })} />,
    )
    expect(container.querySelector('.card-placeholder')).toBeNull()
    expect(container.querySelector('[data-sleeve-id]')).not.toBeNull()
    expect(container.querySelector('.facedown-type-badge.manifest')).not.toBeNull()
  })
})

describe('CardSlot', () => {
  it('renders loyalty badge for planeswalker with loyalty', () => {
    const card = {
      id: 'pw1',
      name: 'Jace, the Mind Sculptor',
      cardTypes: ['Planeswalker'],
      loyalty: '3',
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.loyalty-badge')).not.toBeNull()
    expect(container.querySelector('.loyalty-badge')?.textContent).toContain('3')
  })

  it('renders keyword badges for Flying/Deathtouch/Trample/Haste', () => {
    const card = {
      id: 'c1',
      name: 'Keyword Beast',
      cardTypes: ['Creature'],
      power: '4',
      toughness: '4',
      rules: ['Flying, deathtouch, trample, haste'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const badges = container.querySelectorAll('.keyword-badge')
    expect(badges.length).toBeGreaterThanOrEqual(3)
    expect(container.querySelector('.keyword-badges')).not.toBeNull()
  })

  it('does not render keyword badges when no keywords', () => {
    const card = {
      id: 'c2',
      name: 'Vanilla',
      cardTypes: ['Creature'],
      rules: ['Vanilla creature'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.keyword-badges')).toBeNull()
  })

  it('renders designation badges for live monstrous/renowned hints', () => {
    const card = {
      id: 'c3',
      name: 'Polukranos, World Eater',
      cardTypes: ['Creature'],
      rules: ['Trample', '<br/><hintstart/>', 'ICON_GOOD{this} is monstrous'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge.is-monstrous')).not.toBeNull()
    expect(container.querySelector('.designation-badge.is-renowned')).toBeNull()
  })

  it('renders no designation badge for the negative hint branch', () => {
    const card = {
      id: 'c4',
      name: "Consul's Lieutenant",
      cardTypes: ['Creature'],
      rules: ['First strike', 'Renown 1', "ICON_BAD{this} isn't renowned"],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge')).toBeNull()
  })

  it('renders suspected badge from the engine info line', () => {
    const card = {
      id: 'c5',
      name: 'Shady Informant',
      cardTypes: ['Creature'],
      rules: ['Deathtouch', "<font color = 'blue'>Suspected (has menace and can't block)</font>"],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge.is-suspected')).not.toBeNull()
  })

  it('renders paired badge with partner name in title', () => {
    const card = {
      id: 'c6',
      name: 'Silverblade Paladin',
      cardTypes: ['Creature'],
      rules: ['Soulbond', "Paired with <font color='#B0C4DE'>Grizzly Bears [a1b]</font>"],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const badge = container.querySelector('.designation-badge.is-paired')
    expect(badge).not.toBeNull()
    expect(badge?.getAttribute('aria-label')).toContain('Grizzly Bears')
  })

  it('is keyboard operable when clickable: Tab + Enter triggers the same action as click', () => {
    const onClick = vi.fn()
    const card = {
      id: 'kb1',
      name: 'Lightning Bolt',
      cardTypes: ['Instant'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} onClick={onClick} />)
    const slot = container.querySelector('.card-slot')!
    expect(slot.getAttribute('role')).toBe('button')
    expect(slot.getAttribute('tabindex')).toBe('0')
    fireEvent.click(slot)
    expect(onClick).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(slot, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(slot, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('is not focusable without onClick', () => {
    const card = {
      id: 'kb2',
      name: 'Grizzly Bears',
      cardTypes: ['Creature'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const slot = container.querySelector('.card-slot')!
    expect(slot.getAttribute('role')).toBeNull()
    expect(slot.getAttribute('tabindex')).toBeNull()
  })

  it('KEY-2: inside the game region Space does not activate the card (Space passes priority), Enter does', () => {
    const onClick = vi.fn()
    const card = {
      id: 'kb3',
      name: 'Forest',
      cardTypes: ['Land'],
    } as unknown as PermanentView
    const { container } = render(
      <div data-space-passes-priority="true">
        <CardSlot card={card} onClick={onClick} />
      </div>,
    )
    const slot = container.querySelector('.card-slot')!
    fireEvent.keyDown(slot, { key: ' ' })
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.keyDown(slot, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders class level badge with the live level', () => {
    const card = {
      id: 'c7',
      name: 'Bard Class',
      cardTypes: ['Enchantment'],
      rules: ['Level 2 — Whenever you cast a legendary spell, ...', 'Class level: 2'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const badge = container.querySelector('.designation-badge.is-classlevel')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toContain('2')
    expect(badge?.getAttribute('aria-label')).toContain('2/3')
  })

  it('renders case solved and prepared badges from live engine lines', () => {
    const card = {
      id: 'c8',
      name: 'Case of the Crimson Pulse',
      cardTypes: ['Enchantment'],
      rules: ['<br/><hintstart/>', 'ICON_GOODCase is solved.', "<font color = 'blue'>Prepared</font>"],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge.is-casesolved')).not.toBeNull()
    expect(container.querySelector('.designation-badge.is-prepared')).not.toBeNull()
    expect(container.querySelector('.designation-badge.is-evidence')).toBeNull()
  })

  it('renders evidence badge with need/can collect detail in title', () => {
    const card = {
      id: 'c9',
      name: 'Analyze the Pollen',
      cardTypes: ['Sorcery'],
      rules: ['ICON_GOODEvidence was used (need: 6, can collect: 9)'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const badge = container.querySelector('.designation-badge.is-evidence')
    expect(badge).not.toBeNull()
    expect(badge?.getAttribute('aria-label')).toContain('6')
    expect(badge?.getAttribute('aria-label')).toContain('9')
  })

  it('renders harnessed and protector badges with the protector name in title', () => {
    const card = {
      id: 'c10',
      name: 'Saddle Beast',
      cardTypes: ['Creature'],
      rules: ['ICON_GOOD{this} is harnessed', 'Protected by Grizzly Bears'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge.is-harnessed')).not.toBeNull()
    const badge = container.querySelector('.designation-badge.is-protector')
    expect(badge).not.toBeNull()
    expect(badge?.getAttribute('aria-label')).toContain('Grizzly Bears')
  })

  it('renders a room-door badge from sniffed unlock broadcasts', () => {
    const card = {
      id: 'r1',
      name: 'Dollhouse of Horrors',
      cardTypes: ['Enchantment'],
      subTypes: ['Room'],
    } as unknown as PermanentView
    setState({ gameId: 'g-room', roomDoors: {} })
    const { container, rerender } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge.is-room')).toBeNull()
    act(() => {
      setState({ roomDoors: { 'g-room‖dollhouse of horrors': { left: true, right: false } } })
    })
    rerender(<CardSlot card={card} />)
    const badge = container.querySelector('.designation-badge.is-room')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toBe('L')
    expect(badge?.getAttribute('aria-label')).toContain('L')
  })

  it('renders no room-door badge on non-Room cards with a colliding name', () => {
    const card = {
      id: 'r2',
      name: 'Dollhouse of Horrors',
      cardTypes: ['Enchantment'],
      subTypes: ['Saga'],
    } as unknown as PermanentView
    setState({ gameId: 'g-room', roomDoors: { 'g-room‖dollhouse of horrors': { left: true, right: true } } })
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge.is-room')).toBeNull()
  })

  it('expone data-attrs de fidelidad (P2): P/T, girado, contadores y daño', () => {
    const card = {
      id: 'fid1',
      name: 'Walking Ballista',
      cardTypes: ['Creature', 'Artifact'],
      power: '2',
      toughness: '2',
      damage: 1,
      tapped: true,
      counters: [{ name: '+1/+1', count: 2 }],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} showPt showCounters showDamage tapped />)
    const slot = container.querySelector('.card-slot')!
    expect(slot.getAttribute('data-pt')).toBe('2/2')
    expect(slot.getAttribute('data-tapped')).toBe('1')
    expect(slot.getAttribute('data-damage')).toBe('1')
    expect(slot.getAttribute('data-counters')).toBe('+1/+1:2')
  })

  it('no expone data-pt/data-counters cuando el badge no se pinta', () => {
    const card = {
      id: 'fid2',
      name: 'Grizzly Bears',
      cardTypes: ['Creature'],
      power: '2',
      toughness: '2',
      counters: [{ name: '+1/+1', count: 1 }],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const slot = container.querySelector('.card-slot')!
    expect(slot.getAttribute('data-pt')).toBeNull()
    expect(slot.getAttribute('data-counters')).toBeNull()
    expect(slot.getAttribute('data-tapped')).toBe('0')
  })

  it('el badge de enfermedad de invocación usa su propio texto accesible (no "Girar para maná")', () => {
    const card = {
      id: 'sick1',
      name: 'Elvish Mystic',
      cardTypes: ['Creature'],
      power: '1',
      toughness: '1',
      summoningSickness: true,
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const badge = container.querySelector('.sickness-badge') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.getAttribute('aria-label')).toContain('Enfermedad de invocación')
    expect(badge.getAttribute('title')).toBeNull()
  })

  it('no pinta el badge de enfermedad de invocación si la criatura está girada', () => {
    const card = {
      id: 'sick2',
      name: 'Elvish Mystic',
      cardTypes: ['Creature'],
      power: '1',
      toughness: '1',
      summoningSickness: true,
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} tapped />)
    expect(container.querySelector('.sickness-badge')).toBeNull()
  })
})

describe('CardSlot entering lifecycle', () => {
  const realRect = Element.prototype.getBoundingClientRect

  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.getBoundingClientRect = function () {
      return { x: 8, y: 8, width: 100, height: 140, top: 8, left: 8, right: 108, bottom: 148, toJSON: () => ({}) }
    } as typeof Element.prototype.getBoundingClientRect
  })

  afterEach(() => {
    Element.prototype.getBoundingClientRect = realRect
    vi.useRealTimers()
  })

  const tappedCard = (id: string) =>
    ({ id, name: 'Bear', cardTypes: ['Creature'], power: '2', toughness: '2' }) as unknown as PermanentView
  const slot = (view: { container: HTMLElement }) => view.container.querySelector('.card-slot')!

  it('clears entering after 250ms even when the card prop changes (nuevo objeto por GAME_UPDATE)', () => {
    const view = render(<CardSlot card={tappedCard('enter-1')} tapped />)
    expect(slot(view).className).toContain('entering')

    view.rerender(<CardSlot card={tappedCard('enter-1')} tapped />)
    act(() => { vi.advanceTimersByTime(300) })

    expect(slot(view).className, 'entering no debe quedarse clavado: el cleanup del efecto no puede anular su timer').not.toContain('entering')
    expect(slot(view).className).toContain('tapped')
  })

  it('clears entering under StrictMode double mount (dev)', () => {
    const view = render(
      <StrictMode>
        <CardSlot card={tappedCard('enter-2')} tapped />
      </StrictMode>,
    )
    expect(slot(view).className).toContain('entering')

    act(() => { vi.advanceTimersByTime(300) })

    expect(slot(view).className).not.toContain('entering')
    expect(slot(view).className).toContain('tapped')
  })
})

const animationEnd = (el: Element, animationName: string) => {
  const ev = new Event('animationend', { bubbles: true })
  Object.defineProperty(ev, 'animationName', { value: animationName })
  fireEvent(el, ev)
}

describe('CardSlot target feedback (C1)', () => {
  const choice = (required: boolean) =>
    ({
      method: 'GAME_TARGET',
      gameId: 'g-target',
      title: 'Choose target',
      message: 'Choose target',
      mode: 'uuid',
      options: [],
      min: 1,
      max: 1,
      required,
    }) as unknown as FeedbackPrompt
  const target = { id: 'tgt-1', name: 'Grizzly Bears', cardTypes: ['Creature'] } as unknown as PermanentView

  afterEach(() => setState({ feedback: null }))

  it('TGT-2: a required target gets the beacon and no optional class', () => {
    setState({ feedback: choice(true) })
    const slot = render(<CardSlot card={target} isTarget />).container.querySelector('.card-slot')!
    expect(slot.classList.contains('targetable')).toBe(true)
    expect(slot.classList.contains('target-beacon')).toBe(true)
    expect(slot.classList.contains('target-optional')).toBe(false)
  })

  it('TGT-2: an optional target keeps the static border: no beacon', () => {
    setState({ feedback: choice(false) })
    const slot = render(<CardSlot card={target} isTarget />).container.querySelector('.card-slot')!
    expect(slot.classList.contains('targetable')).toBe(true)
    expect(slot.classList.contains('target-optional')).toBe(true)
    expect(slot.classList.contains('target-beacon')).toBe(false)
  })

  it('TGT-2: a chosen target drops the beacon and gets the chosen class', () => {
    setState({ feedback: choice(true) })
    const slot = render(<CardSlot card={target} isTarget isChosen />).container.querySelector('.card-slot')!
    expect(slot.classList.contains('chosen')).toBe(true)
    expect(slot.classList.contains('target-beacon')).toBe(false)
    expect(slot.classList.contains('target-optional')).toBe(false)
  })

  it('TGT-2, TGT-3: a click on a required target stops the beacon while the echo is pending', () => {
    setState({ feedback: choice(true) })
    const view = render(<CardSlot card={target} isTarget onClick={vi.fn()} />)
    const slot = view.container.querySelector('.card-slot')!
    expect(slot.classList.contains('target-beacon')).toBe(true)
    fireEvent.click(slot)
    expect(slot.classList.contains('is-chosen-pending')).toBe(true)
    expect(slot.classList.contains('target-beacon')).toBe(false)
  })

  it('TGT-2: a target without a GAME_TARGET prompt counts as required', () => {
    const slot = render(<CardSlot card={target} isTarget />).container.querySelector('.card-slot')!
    expect(slot.classList.contains('target-beacon')).toBe(true)
  })
})

describe('CardSlot acuse optimista (plan4 §5.4)', () => {
  const makeSlotCard = (id: string) =>
    ({ id, name: 'Lightning Bolt', cardTypes: ['Instant'] }) as unknown as PermanentView

  beforeEach(() => perfClear())

  it('pinta is-pending al clicar una carta jugable y lo limpia con el siguiente GAME_UPDATE', () => {
    const onClick = vi.fn()
    const view = render(<CardSlot card={makeSlotCard('ack-1')} isPlayable onClick={onClick} />)
    const slot = () => view.container.querySelector('.card-slot')!

    fireEvent.click(slot())
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(slot().className).toContain('is-pending')
    expect(
      perfEntries().some((e) => e.kind === 'ack' && e.name === 'pending' && (e.extra as { cardId?: string })?.cardId === 'ack-1'),
    ).toBe(true)

    // eco del servidor: el GAME_UPDATE trae un card nuevo (objeto fresco)
    view.rerender(<CardSlot card={makeSlotCard('ack-1')} isPlayable onClick={onClick} />)
    expect(slot().className).not.toContain('is-pending')
  })

  it('un clic en carta jugable pinta casting-press y pasa a casting-pop al terminar el press', () => {
    const view = render(<CardSlot card={makeSlotCard('cast-1')} isPlayable onClick={vi.fn()} />)
    const slot = () => view.container.querySelector('.card-slot')!

    fireEvent.click(slot())
    expect(slot().className).toContain('casting-press')

    animationEnd(slot(), 'cardAppear')
    expect(slot().className).toContain('casting-press')

    animationEnd(slot(), 'castPress')
    expect(slot().className).toContain('casting-pop')
    expect(slot().className).not.toContain('casting-press')

    animationEnd(slot(), 'castPop')
    expect(slot().className).not.toContain('casting-pop')
  })

  it('un clic en carta no jugable no pinta casting-press', () => {
    const view = render(<CardSlot card={makeSlotCard('cast-2')} onClick={vi.fn()} />)
    fireEvent.click(view.container.querySelector('.card-slot')!)
    expect(view.container.querySelector('.card-slot')!.className).not.toContain('casting-press')
  })

  it('TGT-3: marks is-chosen-pending on a target click, does not resend the same target and reconciles with isChosen', () => {
    const onClick = vi.fn()
    const card = makeSlotCard('ack-2')
    const view = render(<CardSlot card={card} isTarget onClick={onClick} />)
    const slot = () => view.container.querySelector('.card-slot')!

    fireEvent.click(slot())
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(slot().className).toContain('is-chosen-pending')

    fireEvent.click(slot())
    expect(onClick, 'doble envío del mismo objetivo').toHaveBeenCalledTimes(1)

    // eco: el servidor confirma el objetivo (mismo card, chosenTargets)
    view.rerender(<CardSlot card={card} isTarget isChosen onClick={onClick} />)
    expect(slot().className).not.toContain('is-chosen-pending')
    expect(slot().className).toContain('chosen')

    // ya confirmado, se permite des-seleccionar
    fireEvent.click(slot())
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('si el eco nunca llega, el acuse se limpia solo a los ~3s', () => {
    vi.useFakeTimers()
    try {
      const view = render(<CardSlot card={makeSlotCard('ack-3')} isPlayable onClick={vi.fn()} />)
      const slot = () => view.container.querySelector('.card-slot')!
      fireEvent.click(slot())
      expect(slot().className).toContain('is-pending')
      act(() => { vi.advanceTimersByTime(3100) })
      expect(slot().className).not.toContain('is-pending')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('CardSlot pending bar (A4) and mana tap pulse (A2)', () => {
  const makeCard = (id: string, over: Record<string, unknown> = {}) =>
    ({ id, name: 'Lightning Bolt', cardTypes: ['Instant'], ...over }) as unknown as PermanentView
  const land = (id: string, over: Record<string, unknown> = {}) =>
    ({ id, name: 'Forest', cardTypes: ['Land'], subTypes: ['Forest'], rules: [], ...over }) as unknown as PermanentView

  beforeEach(() => perfClear())

  it('is-pending renders the ack bar; is-chosen-pending does not', () => {
    const view = render(<CardSlot card={makeCard('bar-1')} isPlayable onClick={vi.fn()} />)
    const slot = () => view.container.querySelector('.card-slot')!
    expect(slot().querySelector('.pending-ack-bar')).toBeNull()

    fireEvent.click(slot())
    expect(slot().classList.contains('is-pending')).toBe(true)
    expect(slot().querySelector<HTMLElement>('.pending-ack-bar')?.style.animationDuration).toBe('3000ms')

    view.rerender(<CardSlot card={makeCard('bar-1')} isPlayable onClick={vi.fn()} />)
    expect(slot().querySelector('.pending-ack-bar')).toBeNull()
  })

  it('is-chosen-pending has no ack bar', () => {
    const view = render(<CardSlot card={makeCard('bar-2')} isTarget onClick={vi.fn()} />)
    fireEvent.click(view.container.querySelector('.card-slot')!)
    expect(view.container.querySelector('.card-slot')!.classList.contains('is-chosen-pending')).toBe(true)
    expect(view.container.querySelector('.pending-ack-bar')).toBeNull()
  })

  it('the bar and is-pending clear at 3 s when the echo never arrives', () => {
    vi.useFakeTimers()
    try {
      const view = render(<CardSlot card={makeCard('bar-3')} isPlayable onClick={vi.fn()} />)
      const slot = () => view.container.querySelector('.card-slot')!
      fireEvent.click(slot())
      expect(slot().querySelector('.pending-ack-bar')).not.toBeNull()
      act(() => { vi.advanceTimersByTime(3100) })
      expect(slot().classList.contains('is-pending')).toBe(false)
      expect(slot().querySelector('.pending-ack-bar')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a land that goes from untapped to tapped gets mana-<color> once', () => {
    vi.useFakeTimers()
    try {
      const view = render(<CardSlot card={land('tap-1')} tapped={false} />)
      const slot = () => view.container.querySelector('.card-slot')!
      expect(slot().className).not.toMatch(/mana-/)

      view.rerender(<CardSlot card={land('tap-1')} tapped />)
      expect(slot().classList.contains('mana-G')).toBe(true)

      act(() => { vi.advanceTimersByTime(1100) })
      expect(slot().classList.contains('mana-G')).toBe(false)

      view.rerender(<CardSlot card={land('tap-1')} tapped />)
      expect(slot().classList.contains('mana-G')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a land that is born tapped gets no pulse', () => {
    const view = render(<CardSlot card={land('tap-2')} tapped />)
    expect(view.container.querySelector('.card-slot')!.className).not.toMatch(/mana-/)
  })

  it('only lands with a known color pulse: no creatures, no any-color sources', () => {
    vi.useFakeTimers()
    try {
      const creature = makeCard('tap-3', { cardTypes: ['Creature'] })
      const any = land('tap-4', { subTypes: [], rules: ['{T}: Add one mana of any color.'] })
      const view = render(<CardSlot card={creature} tapped={false} />)
      view.rerender(<CardSlot card={creature} tapped />)
      expect(view.container.querySelector('.card-slot')!.className).not.toMatch(/mana-/)

      const second = render(<CardSlot card={any} tapped={false} />)
      second.rerender(<CardSlot card={any} tapped />)
      expect(second.container.querySelector('.card-slot')!.className).not.toMatch(/mana-/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a dual land uses its first color', () => {
    const view = render(<CardSlot card={land('tap-5', { subTypes: [], rules: ['{T}: Add {U} or {B}.'] })} tapped={false} />)
    view.rerender(<CardSlot card={land('tap-5', { subTypes: [], rules: ['{T}: Add {U} or {B}.'] })} tapped />)
    expect(view.container.querySelector('.card-slot')!.classList.contains('mana-U')).toBe(true)
  })
})

describe('CardSlot right-click inspect', () => {
  afterEach(() => {
    act(() => setState({ inspectedCard: null }))
  })

  it('opens the inspector with the card on right click', () => {
    const card = { id: 'ring1', name: 'The One Ring', cardTypes: ['Artifact'] } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    fireEvent.contextMenu(container.querySelector('.card-slot')!)
    expect(getState().inspectedCard).toBe(card)
  })

  it('does not open the inspector for a face-down card with no known name', () => {
    const card = { id: 'fd1', name: '', faceDown: true, cardTypes: ['Creature'] } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} faceDown />)
    fireEvent.contextMenu(container.querySelector('.card-slot')!)
    expect(getState().inspectedCard).toBeNull()
  })

  it('opens the inspector for an own face-down card the engine reveals', () => {
    const card = { id: 'fd2', name: 'Morph: Den Protector', displayName: 'Morph: Den Protector', faceDown: true, cardTypes: ['Creature'] } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} faceDown />)
    fireEvent.contextMenu(container.querySelector('.card-slot')!)
    expect(getState().inspectedCard).toBe(card)
  })
})

describe('CardSlot hidden name (art branch)', () => {
  it('keeps the stable English name as hidden text when art loads', async () => {
    const card = {
      id: 'art1',
      name: 'Invasion of Zendikar',
      displayName: 'Invasión de Zendikar',
      cardTypes: ['Battle'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const hidden = await screen.findByText('Invasion of Zendikar', { selector: '.visually-hidden' })
    expect(hidden).not.toBeNull()
    expect(container.querySelector('img.card-image')).not.toBeNull()
  })

  it('does not leak the name when face-down', () => {
    const card = { id: 'fd1', name: 'Secret Plans' } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} faceDown />)
    expect(container.querySelector('.visually-hidden')).toBeNull()
  })
})

describe('CardSlot ptBadgeMode (issue #12)', () => {
  const creature = (over: Record<string, unknown> = {}) =>
    ({
      id: 'pt1',
      name: 'Grizzly Bears',
      cardTypes: ['Creature'],
      power: '2',
      toughness: '2',
      originalPower: '2',
      originalToughness: '2',
      ...over,
    }) as unknown as PermanentView

  const withMode = (mode: 'always' | 'changed' | 'hidden', card: PermanentView) => {
    setSetting('ptBadgeMode', mode)
    try {
      return render(<CardSlot card={card} showPt />)
    } finally {
      setSetting('ptBadgeMode', 'always')
    }
  }

  const buffed = creature({ power: '4', toughness: '4' })

  it('always: shows the badge for base and buffed P/T', () => {
    expect(withMode('always', creature()).container.querySelector('.pt-badge')).not.toBeNull()
    expect(withMode('always', buffed).container.querySelector('.pt-badge')).not.toBeNull()
  })

  it('changed: hides the badge at base P/T and shows it when buffed', () => {
    expect(withMode('changed', creature()).container.querySelector('.pt-badge')).toBeNull()
    const buffedBadge = withMode('changed', buffed).container.querySelector('.pt-badge')
    expect(buffedBadge).not.toBeNull()
    expect(buffedBadge?.getAttribute('data-trend')).toBe('changed')
  })

  it('hidden: never shows the badge', () => {
    expect(withMode('hidden', creature()).container.querySelector('.pt-badge')).toBeNull()
    expect(withMode('hidden', buffed).container.querySelector('.pt-badge')).toBeNull()
  })

  // Review focus: el modo "changed" no debe dejar un badge con data-trend
  // pegado cuando la criatura vuelve a sus valores impresos.
  it('changed: drops the badge again once the creature returns to base P/T', () => {
    const { container, rerender } = withMode('changed', buffed)
    expect(container.querySelector('.pt-badge')).not.toBeNull()

    setSetting('ptBadgeMode', 'changed')
    try {
      rerender(<CardSlot card={creature()} showPt />)
      expect(container.querySelector('.pt-badge')).toBeNull()
      expect(container.querySelector('[data-trend="changed"]')).toBeNull()
    } finally {
      setSetting('ptBadgeMode', 'always')
    }
  })

  it('changed: reads a base P/T sent as a mage object', () => {
    const objBase = creature({ originalPower: { cardValue: '2' }, originalToughness: { baseValue: 2 } })
    expect(withMode('changed', objBase).container.querySelector('.pt-badge')).toBeNull()
    expect(withMode('changed', buffed).container.querySelector('.pt-badge')).not.toBeNull()
  })
})

describe('CardSlot sicknessStyle (issue #12)', () => {
  const sick = (over: Record<string, unknown> = {}) =>
    ({
      id: 'sk1',
      name: 'Elvish Mystic',
      cardTypes: ['Creature'],
      power: '1',
      toughness: '1',
      summoningSickness: true,
      ...over,
    }) as unknown as PermanentView

  const withStyle = (style: 'badge' | 'veil', card: PermanentView, tapped = false) => {
    setSetting('sicknessStyle', style)
    try {
      return render(<CardSlot card={card} showPt tapped={tapped} />)
    } finally {
      setSetting('sicknessStyle', 'badge')
    }
  }

  it('badge (default): keeps the corner clock and no veil', () => {
    const { container } = withStyle('badge', sick())
    expect(container.querySelector('.sickness-badge')).not.toBeNull()
    expect(container.querySelector('.sickness-veil')).toBeNull()
  })

  // The reporter asked for the clock over the whole card, like the classic
  // XMage hourglass.
  it('veil: covers the whole card instead of the corner', () => {
    const { container } = withStyle('veil', sick())
    const veil = container.querySelector('.sickness-veil') as HTMLElement
    expect(veil).not.toBeNull()
    expect(container.querySelector('.sickness-badge')).toBeNull()
    // Geometry is not measured here: jsdom returns zero rects. The "covers the
    // whole card" contract lives in `cardOverlayCss.test.ts` (`inset: 0`) and was
    // checked in a real browser (elementFromPoint returns the card).
    expect(veil.querySelector('.sickness-veil-icon')?.getAttribute('aria-label')).toContain('Enfermedad de invocación')
    expect(veil.querySelector('svg')).not.toBeNull()
  })

  // Review focus: el velo no puede saltarse el `!tapped` del disparador.
  it('veil: stays hidden on a tapped sick creature', () => {
    const { container } = withStyle('veil', sick(), true)
    expect(container.querySelector('.sickness-veil')).toBeNull()
    expect(container.querySelector('.sickness-badge')).toBeNull()
  })

  it('veil: does not hide the P/T badge underneath it', () => {
    const { container } = withStyle('veil', sick())
    expect(container.querySelector('.pt-badge')?.textContent).toBe('1/1')
  })
})

describe('CardSlot ptBadgeMode con base desconocida', () => {
  // Tokens, cloaked and disguised cards arrive without `originalPower`: there is
  // no way to prove their P/T has not changed, so "only when changed" must not
  // hide the numbers.
  it('changed: muestra el badge cuando no se conoce el P/T impreso', () => {
    setSetting('ptBadgeMode', 'changed')
    try {
      const unknownBase = {
        id: 'tok1',
        name: 'Soldier Token',
        cardTypes: ['Creature'],
        power: '1',
        toughness: '1',
      } as unknown as PermanentView
      expect(render(<CardSlot card={unknownBase} showPt />).container.querySelector('.pt-badge')).not.toBeNull()
    } finally {
      setSetting('ptBadgeMode', 'always')
    }
  })

  it('changed: sigue mostrando el badge cuando el P/T impreso sí coincide', () => {
    setSetting('ptBadgeMode', 'changed')
    try {
      const known = {
        id: 'k1',
        name: 'Grizzly Bears',
        cardTypes: ['Creature'],
        power: '2',
        toughness: '2',
        originalPower: '2',
        originalToughness: '2',
      } as unknown as PermanentView
      expect(render(<CardSlot card={known} showPt />).container.querySelector('.pt-badge')).toBeNull()
    } finally {
      setSetting('ptBadgeMode', 'always')
    }
  })
})

describe('CardSlot keywordIcons', () => {
  const beast = (rules: string[]) =>
    ({ id: 'kw1', name: 'Keyword Beast', cardTypes: ['Creature'], power: '4', toughness: '4', rules }) as unknown as PermanentView

  const withSet = (set: 'coins' | 'outline' | 'emoji', card: PermanentView) => {
    setSetting('keywordIcons', set)
    try {
      return render(<CardSlot card={card} showPt />)
    } finally {
      setSetting('keywordIcons', 'coins')
    }
  }

  it('coins (default): draws the seven keywords as solid glyphs instead of emoji', () => {
    const { container } = withSet('coins', beast(['Flying, deathtouch, lifelink, haste']))
    const badges = [...container.querySelectorAll('.keyword-badge')]
    expect(badges).toHaveLength(4)
    for (const b of badges) {
      expect(b.classList.contains('icons-coins')).toBe(true)
      expect(b.querySelector('svg')).not.toBeNull()
    }
    expect(container.querySelector('.keyword-badge.kw-flying')).not.toBeNull()
  })

  it('outline: switches the same badges to the line set', () => {
    const { container } = withSet('outline', beast(['Trample, hexproof, indestructible']))
    const badges = [...container.querySelectorAll('.keyword-badge')]
    expect(badges).toHaveLength(3)
    for (const b of badges) expect(b.classList.contains('icons-outline')).toBe(true)
  })

  it('draws a glyph for every badge keyword and never an emoji', () => {
    const { container } = withSet('outline', beast(['Menace, shadow, ward {2}']))
    const badges = [...container.querySelectorAll('.keyword-badge')]
    expect(badges.length).toBeGreaterThanOrEqual(2)
    for (const b of badges) {
      expect(b.classList.contains('is-glyph')).toBe(true)
      expect(b.querySelector('svg')).not.toBeNull()
    }
  })

  it('emoji: shows the keyword emoji instead of a glyph', () => {
    const { container } = withSet('emoji', beast(['Flying, menace']))
    const badges = [...container.querySelectorAll('.keyword-badge')]
    expect(badges).toHaveLength(2)
    for (const b of badges) {
      expect(b.classList.contains('icons-emoji')).toBe(true)
      expect(b.querySelector('svg')).toBeNull()
      expect(b.querySelector('.kw-coin-emoji')).not.toBeNull()
    }
    const flyingEmoji = MTG_KEYWORDS.find((k) => k.id === 'flying')?.icon
    expect(flyingEmoji).toBeTruthy()
    expect(container.querySelector('.keyword-badge.kw-flying .kw-coin-emoji')?.textContent).toBe(flyingEmoji)
  })

  it('shows one badge when the server icon and the rules both say Flying', () => {
    const card = { ...beast(['Flying']), cardIcons: [{ cardIconType: 'ABILITY_FLYING', text: '', hint: 'Flying' }] } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} showPt />)
    expect(container.querySelectorAll('.keyword-badge.kw-flying')).toHaveLength(1)
    expect(container.querySelector('.card-icon.ability')).toBeNull()
  })

  it('draws mutate as a glyph badge with its own tooltip instead of a separate mutated badge', () => {
    const card = { ...beast(['Flying']), mutated: true } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} showPt />)
    const badge = container.querySelector('.keyword-badge.mutated-badge') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.querySelector('svg')).not.toBeNull()
    expect(container.querySelectorAll('.mutated-badge')).toHaveLength(1)
    fireEvent.pointerEnter(badge)
    const title = document.querySelector('.badge-tip-title')?.textContent
    fireEvent.pointerLeave(badge)
    expect(title).toMatch(/Mut/)
  })

  it('shows a tooltip with the keyword name and rules summary on hover', () => {
    const { container } = render(<CardSlot card={beast(['Flying'])} showPt />)
    const badge = container.querySelector('.keyword-badge.kw-flying') as HTMLElement
    fireEvent.pointerEnter(badge)
    const tip = document.querySelector('.badge-tip')
    expect(tip).not.toBeNull()
    expect(tip?.querySelector('.badge-tip-title')?.textContent).toBeTruthy()
    fireEvent.pointerLeave(badge)
    expect(document.querySelector('.badge-tip')).toBeNull()
  })
})

describe('CardSlot designation gained', () => {
  const NOT_MONSTROUS = "ICON_BAD{this} isn't monstrous"
  const MONSTROUS = 'ICON_GOOD{this} is monstrous'
  const SUSPECTED = "Suspected (has menace and can't block)"
  const card = (rules: string[]) =>
    ({ id: 'g1', name: 'Polukranos, World Eater', cardTypes: ['Creature'], rules }) as unknown as PermanentView

  it('does not animate a designation on the first render', () => {
    const { container } = render(<CardSlot card={card(['Trample', MONSTROUS])} />)
    const badge = container.querySelector('.designation-badge.is-monstrous')
    expect(badge).not.toBeNull()
    expect(badge?.classList.contains('designation-gained')).toBe(false)
    expect(container.querySelector('.card-slot')?.classList.contains('fx-designation-swell')).toBe(false)
  })

  it('pops and swells when a card becomes monstrous', () => {
    const { container, rerender } = render(<CardSlot card={card(['Trample', NOT_MONSTROUS])} />)
    rerender(<CardSlot card={card(['Trample', MONSTROUS])} />)
    const badge = container.querySelector('.designation-badge.is-monstrous')
    expect(badge?.classList.contains('designation-gained')).toBe(true)
    expect(badge?.classList.contains('designation-gained--monstrous')).toBe(true)
    expect(container.querySelector('.card-slot')?.classList.contains('fx-designation-swell')).toBe(true)
  })

  it('pops a newly added suspected badge without swelling', () => {
    const { container, rerender } = render(<CardSlot card={card(['Deathtouch'])} />)
    rerender(<CardSlot card={card(['Deathtouch', SUSPECTED])} />)
    const badge = container.querySelector('.designation-badge.is-suspected')
    expect(badge?.classList.contains('designation-gained--suspected')).toBe(true)
    expect(container.querySelector('.card-slot')?.classList.contains('fx-designation-swell')).toBe(false)
  })
})

describe('CardSlot keyword aura', () => {
  const creature = (over: Record<string, unknown> = {}) =>
    ({
      id: 'ka1',
      name: 'Aura Beast',
      cardTypes: ['Creature'],
      power: '3',
      toughness: '3',
      rules: ['Flying, trample'],
      ...over,
    }) as unknown as PermanentView

  it('draws the aura of the main keyword on a battlefield permanent', () => {
    const { container } = render(<CardSlot card={creature()} keywordAura />)
    expect(container.querySelectorAll('.kw-aura.kw-aura--flying[data-kw-aura="flying"]')).toHaveLength(1)
  })

  it('draws no aura unless the battlefield asks for one', () => {
    const { container } = render(<CardSlot card={creature()} />)
    expect(container.querySelector('.kw-aura')).toBeNull()
  })

  it('draws no aura when the setting is off, and marks it vivid when set to vivid', () => {
    setSetting('keywordAura', 'off')
    try {
      const off = render(<CardSlot card={creature()} keywordAura />)
      expect(off.container.querySelector('.kw-aura')).toBeNull()
      off.unmount()
    } finally {
      setSetting('keywordAura', 'subtle')
    }
    setSetting('keywordAura', 'vivid')
    try {
      const vivid = render(<CardSlot card={creature()} keywordAura />)
      expect(vivid.container.querySelector('.kw-aura.is-vivid')).not.toBeNull()
    } finally {
      setSetting('keywordAura', 'subtle')
    }
  })

  it('honours a per-demo override of the setting', () => {
    const { container } = render(<CardSlot card={creature()} keywordAura demo={{ artUrl: null, keywordAura: 'off' }} />)
    expect(container.querySelector('.kw-aura')).toBeNull()
  })

  it('picks the highest-priority aura keyword', () => {
    const { container } = render(<CardSlot card={creature({ rules: ['Hexproof, indestructible'] })} keywordAura />)
    expect(container.querySelector('[data-kw-aura]')?.getAttribute('data-kw-aura')).toBe('indestructible')
  })

  it('draws the indestructible aura even when it is beyond the visible badge cap', () => {
    const icon = (cardIconType: string) => ({ cardIconType, text: '', hint: cardIconType })
    const card = creature({
      rules: ['Indestructible'],
      cardIcons: [
        icon('ABILITY_FLYING'),
        icon('ABILITY_FIRST_STRIKE'),
        icon('ABILITY_VIGILANCE'),
        icon('ABILITY_REACH'),
        icon('ABILITY_DEFENDER'),
      ],
    })
    const { container } = render(<CardSlot card={card} keywordAura />)
    expect(container.querySelectorAll('.keyword-badge:not(.keyword-badge-more)')).toHaveLength(5)
    expect(container.querySelector('.keyword-badge-more')?.textContent).toBe('+1')
    expect(container.querySelector('[data-kw-aura]')?.getAttribute('data-kw-aura')).toBe('indestructible')
  })

  it('draws no aura on a face-down card', () => {
    const { container } = render(<CardSlot card={creature({ faceDown: true })} keywordAura faceDown />)
    expect(container.querySelector('.kw-aura')).toBeNull()
  })

  it('does not pop a keyword the card already has on its first render', () => {
    const { container } = render(<CardSlot card={creature()} keywordAura />)
    expect(container.querySelector('.kw-coin.kw-flying')?.classList.contains('kw-gained')).toBe(false)
    expect(container.querySelector('.kw-aura-flare')).toBeNull()
  })

  it('pops the gained coin and flares the aura when a card gains flying', () => {
    const { container, rerender } = render(<CardSlot card={creature({ rules: [] })} keywordAura />)
    expect(container.querySelector('.kw-aura')).toBeNull()
    rerender(<CardSlot card={creature({ rules: ['Flying'] })} keywordAura />)
    expect(container.querySelector('.kw-coin.kw-flying')?.classList.contains('kw-gained')).toBe(true)
    expect(container.querySelector('.kw-aura-flare.kw-aura-flare--flying')).not.toBeNull()
  })
})

describe('CardSlot keyword overflow', () => {
  it('counts every keyword past the five badges shown in the +N badge', () => {
    const icons = ['ABILITY_FLYING', 'ABILITY_DEATHTOUCH', 'ABILITY_LIFELINK', 'ABILITY_DOUBLE_STRIKE', 'ABILITY_FIRST_STRIKE', 'ABILITY_TRAMPLE', 'ABILITY_HEXPROOF']
    const card = {
      id: 'k7',
      name: 'Many Keywords',
      cardTypes: ['Creature'],
      power: '2',
      toughness: '2',
      cardIcons: icons.map((cardIconType) => ({ cardIconType, hint: cardIconType })),
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelectorAll('.keyword-badge:not(.keyword-badge-more)')).toHaveLength(5)
    expect(container.querySelector('.keyword-badge-more')?.textContent).toBe('+2')
  })
})
