import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StackZone from './StackZone'
import { DrawerHeadSlotContext } from '../game/drawerHeadSlot'
import type { CardView, PlayerView } from '../net/types'

vi.mock('../cards/cardImages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cards/cardImages')>()),
  awaitImageUrl: vi.fn().mockResolvedValue('https://img.test/card.jpg'),
  isAbilityCard: vi.fn().mockImplementation((card: CardView) => {
    const t = card.mageObjectType ?? ''
    return t.includes('Ability') || t.includes('ABILITY')
  }),
  getSourceCardName: vi.fn().mockImplementation((card: CardView) => {
    if (card.rules?.[0]?.includes('Cloud, Midgar Mercenary')) return 'Cloud, Midgar Mercenary'
    if (card.displayName && card.displayName !== 'Ability') return card.displayName
    if (card.name && card.name !== 'Ability') return card.name
    return 'Habilidad'
  }),
  cardName: vi.fn().mockImplementation((card: CardView) => {
    if (card.rules?.[0]?.includes('Cloud, Midgar Mercenary')) return 'Cloud, Midgar Mercenary'
    if (card.displayName && card.displayName !== 'Ability') return card.displayName
    if (card.name && card.name !== 'Ability') return card.name
    return 'Habilidad'
  }),
}))

describe('StackZone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty when stack is null or empty', () => {
    const { container } = render(<StackZone stack={null} />)
    expect(container.querySelector('.ui-empty')).toBeTruthy()
  })

  it('renders single spell on the stack as top item', () => {
    const stack: Record<string, CardView> = {
      'spell-1': {
        name: 'Lightning Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
        rules: ['Lightning Bolt deals 3 damage to any target.'],
      },
    }

    const { container } = render(
      <StackZone stack={stack} canResolve={true} onResolveClick={vi.fn()} />,
    )

    expect(container.textContent).toContain('Pila (1)')
    expect(container.textContent).toContain('Lightning Bolt')
    expect(container.textContent).toContain('Instantáneo')
    expect(container.querySelector('[data-testid="stack-resolve-header-btn"]')).toBeTruthy()
  })

  it('dentro del drawer las acciones (Resolver + alternador) van al hueco de su cabecera y no hay fila propia', () => {
    const slot = document.createElement('div')
    document.body.appendChild(slot)
    const stack: Record<string, CardView> = {
      'spell-1': { name: 'Lightning Bolt', cardTypes: ['INSTANT'], manaValue: 1 },
    }
    const { container } = render(
      <DrawerHeadSlotContext.Provider value={slot}>
        <StackZone stack={stack} canResolve={true} onResolveClick={vi.fn()} />
      </DrawerHeadSlotContext.Provider>,
    )
    expect(slot.querySelector('[data-testid="stack-resolve-header-btn"]')).toBeTruthy()
    expect(slot.querySelector('.ui-tabs, [role="tablist"]')).toBeTruthy()
    expect(container.querySelector('.stack-header')).toBeNull()
    expect(container.querySelector('.stack-timeline')).toBeTruthy()
    slot.remove()
  })

  it('cada entrada lleva posición, nombre y controlador en una sola fila compacta', () => {
    const stack: Record<string, CardView> = {
      'spell-1': { name: 'Lightning Bolt', cardTypes: ['INSTANT'], manaValue: 1 },
    }
    const { container } = render(<StackZone stack={stack} />)
    const entry = container.querySelector('.stack-tl-entry') as HTMLElement
    expect(entry.querySelector('.stack-tl-name-row .stack-tl-pos')?.textContent).toContain('#1')
    expect(entry.querySelector('.stack-tl-type-row .stack-controller-pill')).toBeTruthy()
    expect(entry.querySelector('.stack-tl-pos-row')).toBeNull()
  })

  it('renders multiple spells in timeline with newest on top', () => {
    const stack: Record<string, CardView> = {
      'spell-2': {
        name: 'Counterspell',
        cardTypes: ['INSTANT'],
        manaValue: 2,
        rules: ['Counter target spell.'],
      },
      'spell-1': {
        name: 'Lightning Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
    }

    const { container } = render(<StackZone stack={stack} canResolve={true} />)

    expect(container.textContent).toContain('Pila (2)')
    const entries = container.querySelectorAll('.stack-tl-entry')
    expect(entries.length).toBe(2)
    expect(entries[0].classList.contains('is-top')).toBe(true)
    expect(entries[0].textContent).toContain('Counterspell')
    expect(entries[1].textContent).toContain('Lightning Bolt')
  })

  it('triggers onCardClick and onHover when interacting with stack items', () => {
    const onCardClick = vi.fn()
    const onHover = vi.fn()

    const stack: Record<string, CardView> = {
      'spell-2': {
        name: 'Counterspell',
        cardTypes: ['INSTANT'],
        manaValue: 2,
      },
      'spell-1': {
        name: 'Lightning Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
    }

    const { container } = render(
      <StackZone stack={stack} onCardClick={onCardClick} onHover={onHover} />,
    )

    const entries = container.querySelectorAll('.stack-tl-entry')
    fireEvent.click(entries[1])
    expect(onCardClick).toHaveBeenCalledWith('spell-1')

    fireEvent.mouseEnter(entries[1])
    expect(onHover).toHaveBeenCalledWith(stack['spell-1'], expect.anything())
  })

  it('renders ability capsules with resolved source name', () => {
    const stack: Record<string, CardView> = {
      'ab-1': {
        name: 'Ability',
        mageObjectType: 'TRIGGERED_ABILITY',
        abilityType: 'Triggered',
        manaValue: 0,
        rules: ['When Cloud, Midgar Mercenary enters, search your library for an Equipment card...'],
      },
    }

    const { container } = render(<StackZone stack={stack} />)
    expect(container.textContent).toContain('Cloud, Midgar Mercenary')
    expect(container.textContent).toContain('Disparada')
    expect(container.querySelector('.stack-tl-entry.is-ability')).toBeTruthy()
  })

  it('muestra las reglas de una habilidad también en modo compacto, y no las de un hechizo', () => {
    const stack: Record<string, CardView> = {
      'ab-1': {
        name: 'Ability',
        mageObjectType: 'TRIGGERED_ABILITY',
        abilityType: 'Triggered',
        manaValue: 0,
        rules: ['Whenever a creature dies, draw a card.'],
      },
      'spell-1': {
        name: 'Counterspell',
        cardTypes: ['INSTANT'],
        manaValue: 2,
        rules: ['Counter target spell.'],
      },
    }

    const { container } = render(<StackZone stack={stack} />)
    const rules = container.querySelectorAll('.stack-tl-rules')
    expect(rules.length).toBe(1)
    expect(rules[0].classList.contains('is-clamped')).toBe(true)
    expect(rules[0].getAttribute('title')).toBe('Whenever a creature dies, draw a card.')

    fireEvent.click(container.querySelectorAll('.stack-zone [role="tab"]')[1] as HTMLButtonElement)
    const expanded = container.querySelectorAll('.stack-tl-rules')
    expect(expanded.length).toBe(2)
    expect(container.querySelector('.stack-tl-rules.is-clamped')).toBeNull()
  })

  it('el icono de la habilidad depende de su tipo, no del idioma', () => {
    const stack: Record<string, CardView> = {
      trig: { name: 'Ability', mageObjectType: 'TRIGGERED_ABILITY', abilityType: 'Triggered', manaValue: 0 },
      act: { name: 'Ability', mageObjectType: 'ACTIVATED_ABILITY', abilityType: 'Activated', manaValue: 0 },
    }

    const { container } = render(<StackZone stack={stack} />)
    const badges = container.querySelectorAll('.stack-tl-type-badge')
    const trigIcon = badges[0].querySelector('svg')?.outerHTML
    const actIcon = badges[1].querySelector('svg')?.outerHTML
    expect(trigIcon).toBeTruthy()
    expect(actIcon).toBeTruthy()
    expect(trigIcon).not.toBe(actIcon)
  })

  const trigger = (rule: string, extra: Partial<CardView> = {}): CardView => ({
    name: 'Ability',
    mageObjectType: 'TRIGGERED_ABILITY',
    abilityType: 'Triggered',
    manaValue: 0,
    rules: [rule],
    sourceCard: { name: 'Soul Warden', controllerName: 'Yo' } as CardView,
    controllerName: 'Yo',
    ...extra,
  })

  it('agrupa habilidades idénticas consecutivas en una fila con ×N y rango de posición', () => {
    const stack: Record<string, CardView> = {
      t1: trigger('You gain 1 life.'),
      t2: trigger('You gain 1 life.'),
      t3: trigger('You gain 1 life.'),
      bolt: { name: 'Lightning Bolt', cardTypes: ['INSTANT'], manaValue: 1 },
    }

    const { container } = render(<StackZone stack={stack} />)
    const entries = container.querySelectorAll('.stack-tl-entry')
    expect(entries.length).toBe(2)
    expect(container.textContent).toContain('Pila (4)')
    expect(entries[0].getAttribute('data-card-id')).toBe('t1')
    expect(entries[0].querySelector('[data-testid="stack-group-count"]')?.textContent).toBe('×3')
    expect(entries[0].querySelector('.stack-tl-pos')?.textContent).toContain('#1–3')
    expect(entries[1].querySelector('.stack-tl-pos')?.textContent).toContain('#4')
    expect(entries[1].querySelector('[data-testid="stack-group-count"]')).toBeNull()
  })

  it('no agrupa habilidades no consecutivas, con distintas reglas ni hechizos iguales', () => {
    const stack: Record<string, CardView> = {
      a1: trigger('You gain 1 life.'),
      s1: { name: 'Shock', cardTypes: ['INSTANT'], manaValue: 1 },
      a2: trigger('You gain 1 life.'),
      b1: trigger('Draw a card.'),
      s2: { name: 'Shock', cardTypes: ['INSTANT'], manaValue: 1 },
      s3: { name: 'Shock', cardTypes: ['INSTANT'], manaValue: 1 },
    }

    const { container } = render(<StackZone stack={stack} />)
    expect(container.querySelectorAll('.stack-tl-entry').length).toBe(6)
    expect(container.querySelector('[data-testid="stack-group-count"]')).toBeNull()
  })

  it('no agrupa entradas que son objetivo elegible, para poder elegir una concreta', () => {
    const stack: Record<string, CardView> = {
      t1: trigger('You gain 1 life.'),
      t2: trigger('You gain 1 life.'),
    }

    const { container } = render(<StackZone stack={stack} targetIds={new Set(['t2'])} />)
    expect(container.querySelectorAll('.stack-tl-entry').length).toBe(2)
  })

  it('no agrupa habilidades de controladores distintos', () => {
    const stack: Record<string, CardView> = {
      t1: trigger('You gain 1 life.', { controllerName: 'Yo' }),
      t2: trigger('You gain 1 life.', { controllerName: 'Rival' }),
    }
    const players = [
      { playerId: 'p1', name: 'Yo', controlled: true },
      { playerId: 'p2', name: 'Rival', controlled: false },
    ] as unknown as PlayerView[]

    const { container } = render(<StackZone stack={stack} players={players} />)
    expect(container.querySelectorAll('.stack-tl-entry').length).toBe(2)
  })

  it('mantiene la fila del grupo al resolverse la habilidad del tope (sin remontarla)', () => {
    const three: Record<string, CardView> = {
      t1: trigger('You gain 1 life.'),
      t2: trigger('You gain 1 life.'),
      t3: trigger('You gain 1 life.'),
    }
    const { container, rerender } = render(<StackZone stack={three} />)
    const row = container.querySelector('.stack-tl-entry')
    expect(row?.getAttribute('data-card-id')).toBe('t1')

    rerender(<StackZone stack={{ t2: three.t2, t3: three.t3 }} />)
    const after = container.querySelector('.stack-tl-entry')
    expect(after).toBe(row)
    expect(after?.getAttribute('data-card-id')).toBe('t2')
    expect(after?.querySelector('[data-testid="stack-group-count"]')?.textContent).toBe('×2')

    rerender(<StackZone stack={{ t3: three.t3 }} />)
    expect(container.querySelector('.stack-tl-entry')).toBe(row)
    expect(container.querySelector('[data-testid="stack-group-count"]')).toBeNull()
  })

  it('renders storm copy badges and allows toggling view mode', () => {
    const stack: Record<string, CardView> = {
      'storm-1': {
        name: 'Grapeshot [Copia 1]',
        cardTypes: ['SORCERY'],
        manaValue: 2,
      },
    }

    const { container } = render(<StackZone stack={stack} />)
    expect(container.querySelector('.stack-tl-copy-badge')).toBeTruthy()
    expect(container.textContent).toContain('Copia')

    const expandedBtn = container.querySelectorAll('.stack-zone [role="tab"]')[1] as HTMLButtonElement
    expect(expandedBtn).toBeTruthy()
    fireEvent.click(expandedBtn)
    expect(container.querySelector('.view-mode-expanded')).toBeTruthy()
  })

  it('shows timeline rail with green top node', () => {
    const stack: Record<string, CardView> = {
      'spell-1': {
        name: 'Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
      'spell-2': {
        name: 'Giant Growth',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
    }

    const { container } = render(<StackZone stack={stack} />)
    const nodes = container.querySelectorAll('.stack-tl-node')
    expect(nodes.length).toBe(2)
    expect(nodes[0].classList.contains('node-top')).toBe(true)
    expect(nodes[1].classList.contains('node-top')).toBe(false)

    const lines = container.querySelectorAll('.stack-tl-line')
    expect(lines.length).toBe(1)
    expect(lines[0].classList.contains('line-top')).toBe(true)
  })

  it('renders resolve button in header when canResolve is true', () => {
    const onResolveClick = vi.fn()
    const stack: Record<string, CardView> = {
      'spell-1': {
        name: 'Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
    }

    const { container } = render(
      <StackZone stack={stack} canResolve={true} onResolveClick={onResolveClick} />,
    )

    const btn = container.querySelector('[data-testid="stack-resolve-header-btn"]') as HTMLButtonElement
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onResolveClick).toHaveBeenCalled()
  })

  it('renders controller pill distinguishing human player vs opponent', () => {
    const players: PlayerView[] = [
      {
        playerId: 'p-human',
        name: 'Mage Web',
        life: 20,
        controlled: true,
        isHuman: true,
      } as PlayerView,
      {
        playerId: 'p-opp',
        name: 'SimBot',
        life: 20,
        controlled: false,
        isHuman: false,
      } as PlayerView,
    ]

    const stack: Record<string, CardView> = {
      'spell-mine': {
        name: 'Lightning Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
        controllerId: 'p-human',
      } as any,
      'spell-opp': {
        name: 'Counterspell',
        cardTypes: ['INSTANT'],
        manaValue: 2,
        controllerId: 'p-opp',
      } as any,
    }

    const { container } = render(
      <StackZone stack={stack} players={players} myPlayerId="p-human" />,
    )

    const pills = container.querySelectorAll('.stack-controller-pill')
    expect(pills.length).toBe(2)
    expect(pills[0].classList.contains('is-me')).toBe(true)
    expect(pills[0].textContent).toContain('Tú')
    expect(pills[1].classList.contains('is-opp')).toBe(true)
    expect(pills[1].textContent).toContain('SimBot')
  })

  it('no labels an unknown controller as "Tú" when spectating', () => {
    const players: PlayerView[] = [
      { playerId: 'p-opp', name: 'SimBot', life: 20, controlled: false, isHuman: false } as PlayerView,
    ]

    const stack: Record<string, CardView> = {
      'spell-unknown': {
        name: 'Mystic Remora',
        cardTypes: ['ENCHANTMENT'],
        manaValue: 2,
      } as any,
    }

    const { container } = render(<StackZone stack={stack} players={players} />)

    const pill = container.querySelector('.stack-controller-pill')
    expect(pill).not.toBeNull()
    expect(pill!.classList.contains('is-me')).toBe(false)
    expect(pill!.textContent).not.toContain('Tú')
    expect(pill!.textContent).toContain('Desconocido')
  })

  it('attributes a watched spell to its controller via controllerId (no "Tú" for spectators)', () => {
    const players: PlayerView[] = [
      { playerId: 'p-opp', name: 'SimBot', life: 20, controlled: false, isHuman: false } as PlayerView,
    ]

    const stack: Record<string, CardView> = {
      'spell-watched': {
        name: 'Counterspell',
        cardTypes: ['INSTANT'],
        manaValue: 2,
        controllerId: 'p-opp',
      } as any,
    }

    const { container } = render(<StackZone stack={stack} players={players} />)

    const pill = container.querySelector('.stack-controller-pill')
    expect(pill).not.toBeNull()
    expect(pill!.classList.contains('is-me')).toBe(false)
    expect(pill!.classList.contains('is-opp')).toBe(true)
    expect(pill!.textContent).toContain('SimBot')
    expect(pill!.textContent).not.toContain('Tú')
  })

  it('falls back to sourceCard.controllerId for stack abilities (no "Desconocido")', () => {    const players: PlayerView[] = [
      { playerId: 'p-opp', name: 'SimBot', life: 20, controlled: false, isHuman: false } as PlayerView,
    ]

    const stack: Record<string, CardView> = {
      'ability-watched': {
        name: 'Ability',
        sourceCard: { controllerId: 'p-opp', controllerName: 'SimBot' },
      } as any,
    }

    const { container } = render(<StackZone stack={stack} players={players} />)

    const pill = container.querySelector('.stack-controller-pill')
    expect(pill).not.toBeNull()
    expect(pill!.classList.contains('is-me')).toBe(false)
    expect(pill!.classList.contains('is-opp')).toBe(true)
    expect(pill!.textContent).toContain('SimBot')
    expect(pill!.textContent).not.toContain('Desconocido')
  })

  it('shows the target names inline (permanent + player)', () => {
    const players: PlayerView[] = [
      { playerId: 'p-me', name: 'Yo', life: 20, controlled: true, isHuman: true } as PlayerView,
      {
        playerId: 'p-opp',
        name: 'SimBot',
        life: 20,
        controlled: false,
        isHuman: false,
        battlefield: {
          'perm-acer': { id: 'perm-acer', name: 'Acererak, el Archiliche', manaValue: 3 },
        },
      } as unknown as PlayerView,
    ]

    const stack: Record<string, CardView> = {
      'spell-1': {
        name: 'Lightning Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
        targets: ['perm-acer', 'p-opp'],
      } as any,
    }

    const { container } = render(<StackZone stack={stack} players={players} myPlayerId="p-me" />)

    const line = container.querySelector('[data-testid="stack-targets"]')
    expect(line).not.toBeNull()
    expect(line?.textContent).toContain('Acererak, el Archiliche')
    expect(line?.textContent).toContain('SimBot')
  })

  it('exposes the full target list on a focusable labelled element (ellipsis is structural)', () => {
    const players: PlayerView[] = [
      { playerId: 'p-me', name: 'Yo', life: 20, controlled: true, isHuman: true } as PlayerView,
      {
        playerId: 'p-opp',
        name: 'SimBot',
        life: 20,
        controlled: false,
        isHuman: false,
        battlefield: {
          'perm-acer': { id: 'perm-acer', name: 'Acererak, el Archiliche', manaValue: 3 },
        },
      } as unknown as PlayerView,
    ]

    const stack: Record<string, CardView> = {
      'spell-1': {
        name: 'Lightning Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
        targets: ['perm-acer', 'p-opp'],
      } as any,
    }

    const { container } = render(<StackZone stack={stack} players={players} myPlayerId="p-me" />)

    const line = container.querySelector('[data-testid="stack-targets"]') as HTMLElement
    expect(line).not.toBeNull()
    expect(line.tabIndex).toBe(0)
    expect(line.getAttribute('aria-label')).toContain('Acererak, el Archiliche')
    expect(line.getAttribute('aria-label')).toContain('SimBot')
  })

  it('hides the target line when the spell has no targets', () => {
    const stack: Record<string, CardView> = {
      'spell-1': { name: 'Lightning Bolt', cardTypes: ['INSTANT'], manaValue: 1 },
    }
    const { container } = render(<StackZone stack={stack} />)
    expect(container.querySelector('[data-testid="stack-targets"]')).toBeNull()
  })

  it('clears the hover preview when the hovered card leaves the stack', () => {
    const onHover = vi.fn()
    const stack: Record<string, CardView> = {
      'spell-2': { id: 'spell-2', name: 'Counterspell', cardTypes: ['INSTANT'], manaValue: 2 },
      'spell-1': { id: 'spell-1', name: 'Lightning Bolt', cardTypes: ['INSTANT'], manaValue: 1 },
    }

    const { container, rerender } = render(<StackZone stack={stack} onHover={onHover} />)
    fireEvent.mouseEnter(container.querySelectorAll('.stack-tl-entry')[0])
    expect(container.querySelector('.floating-card-preview')).toBeTruthy()

    // Counterspell se resuelve: la pila sigue viva pero sin spell-2
    rerender(<StackZone stack={{ 'spell-1': stack['spell-1'] }} onHover={onHover} />)
    expect(container.querySelector('.floating-card-preview')).toBeNull()
    expect(onHover).toHaveBeenCalledWith(null)
  })

  it('does not resurrect the stale card when the stack empties and refills', async () => {
    const stack: Record<string, CardView> = {
      'spell-1': { id: 'spell-1', name: 'Lightning Bolt', cardTypes: ['INSTANT'], manaValue: 1 },
    }

    const { container, rerender } = render(<StackZone stack={stack} />)
    fireEvent.mouseEnter(container.querySelectorAll('.stack-tl-entry')[0])
    expect(container.querySelector('.floating-card-preview')).toBeTruthy()

    // La pila se resuelve por completo...
    rerender(<StackZone stack={{}} />)
    expect(container.querySelector('.ui-empty')).toBeTruthy()

    // ...y una carta NUEVA abre una pila fresca: el Bolt resuelto no debe reaparecer
    rerender(
      <StackZone
        stack={{
          'spell-9': { id: 'spell-9', name: 'Giant Growth', cardTypes: ['INSTANT'], manaValue: 1 },
        }}
      />,
    )
    expect(container.querySelector('.floating-card-preview')).toBeNull()

    // Hover sobre la nueva carta muestra la carta nueva (no el Bolt viejo)
    await act(async () => {
      fireEvent.mouseEnter(container.querySelectorAll('.stack-tl-entry')[0])
    })
    const img = container.querySelector('.floating-card-img')
    expect(img?.getAttribute('alt')).toBe('Giant Growth')
  })

  it('keeps the preview when the hovered card stays while a new card enters', () => {
    const stack1: Record<string, CardView> = {
      'spell-1': { id: 'spell-1', name: 'Lightning Bolt', cardTypes: ['INSTANT'], manaValue: 1 },
    }
    const { container, rerender } = render(<StackZone stack={stack1} />)
    fireEvent.mouseEnter(container.querySelectorAll('.stack-tl-entry')[0])
    expect(container.querySelector('.floating-card-preview')).toBeTruthy()

    // Entra una nueva carta: el Bolt sigue en pila → el preview no debe cerrarse
    rerender(
      <StackZone
        stack={{
          'spell-2': { id: 'spell-2', name: 'Counterspell', cardTypes: ['INSTANT'], manaValue: 2 },
          'spell-1': stack1['spell-1'],
        }}
      />,
    )
    expect(container.querySelector('.floating-card-preview')).toBeTruthy()
  })
})
