import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import CardSlot from './CardSlot'
import type { PermanentView } from '../net/types'
import { perfClear, perfEntries } from '../system/perfProbe'

vi.mock('./cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

vi.mock('../cards/cardImages', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../cards/cardImages')>()
  return { ...mod, awaitImageUrl: vi.fn(async () => 'https://img.test/art.jpg') }
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
    expect(badge?.getAttribute('title')).toContain('Grizzly Bears')
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

  it('inside the game region Space does not activate the card (Space passes priority), Enter does', () => {
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
    expect(badge?.getAttribute('title')).toContain('2/3')
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
    expect(badge?.getAttribute('title')).toContain('6')
    expect(badge?.getAttribute('title')).toContain('9')
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
    expect(badge?.getAttribute('title')).toContain('Grizzly Bears')
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
    expect(badge.getAttribute('title')).toContain('Enfermedad de invocación')
    expect(badge.getAttribute('aria-label')).toBe(badge.getAttribute('title'))
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

  it('pinta is-chosen-pending al elegir objetivo, no reenvía el mismo target y reconcilia con isChosen', () => {
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
