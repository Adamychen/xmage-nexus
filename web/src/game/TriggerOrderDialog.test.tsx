import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, fireEvent } from '@testing-library/react'
import TriggerOrderDialog from './TriggerOrderDialog'
import type { FeedbackPrompt } from './feedback'
import { clearTriggerOrderPlan } from './triggerOrderPlan'
import { getState, setState } from '../state/store'

const sendPlayerUUID = vi.fn().mockResolvedValue({ ok: true })
const sendTriggerAutoOrder = vi.fn().mockResolvedValue({ ok: true })

vi.mock('../net/commands', () => ({
  sendPlayerUUID: (...args: unknown[]) => sendPlayerUUID(...args),
  sendTriggerAutoOrder: (...args: unknown[]) => sendTriggerAutoOrder(...args),
}))

const T1 = '11111111-1111-1111-1111-111111111111'
const T2 = '22222222-2222-2222-2222-222222222222'

function prompt(): FeedbackPrompt {
  return {
    method: 'GAME_TARGET',
    gameId: 'g1',
    title: 'Trigger order',
    message: 'Pick triggered ability (goes to the stack first)',
    mode: 'uuid',
    options: [
      { id: T1, label: 'Soul Warden', value: T1 },
      { id: T2, label: 'Blood Artist', value: T2 },
    ],
    min: 1,
    max: 1,
    cards: [
      { id: T1, name: 'Soul Warden', rules: ['Whenever another creature enters the battlefield, you gain 1 life.'] },
      { id: T2, name: 'Blood Artist', rules: ['Whenever Blood Artist or another creature dies, target player loses 1 life.'] },
    ],
    isTriggerOrder: true,
  }
}

/** jsdom has no PointerEvent: a pointerdown that reports a touch, as a phone sends it. */
function touchDown(el: Element) {
  const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'pointerType', { value: 'touch' })
  act(() => { el.dispatchEvent(event) })
}

function makeSend() {
  return vi.fn((action: () => Promise<unknown>) => { void action() })
}

function makeSendNow() {
  return vi.fn(async (action: () => Promise<unknown>) => { await action(); return true })
}

function renderDialog(p: FeedbackPrompt, overrides: { sendNow?: ReturnType<typeof makeSendNow> } = {}) {
  const send = makeSend()
  const sendNow = overrides.sendNow ?? makeSendNow()
  const view = render(<TriggerOrderDialog prompt={p} send={send as never} sendNow={sendNow as never} busy={false} />)
  return { ...view, send, sendNow }
}

beforeEach(() => {
  clearTriggerOrderPlan()
  sendPlayerUUID.mockClear()
  sendTriggerAutoOrder.mockClear()
  setState({
    game: {
      players: [
        {
          playerId: 'p-opp',
          name: 'Rival',
          battlefield: { 'perm-9': { id: 'perm-9', name: 'Grizzly Bears', displayName: 'Grizzly Bears' } },
        },
      ],
      stack: {},
      myHand: {},
      myHelperEmblems: {},
    },
  } as never)
})

describe('TriggerOrderDialog', () => {
  it('renders one row per trigger with resolution numbers and actions', () => {
    const { container } = renderDialog(prompt())
    expect(container.querySelectorAll('.trigger-row').length).toBe(2)
    expect(container.textContent).toContain('Soul Warden')
    expect(container.textContent).toContain('Whenever another creature enters')
    expect([...container.querySelectorAll('.trigger-index')].map((el) => el.textContent)).toEqual(['1', '2'])
  })

  it('answers a manual pick with the trigger uuid', () => {
    const { container } = renderDialog(prompt())
    const firstRow = container.querySelector(`[data-testid="trigger-row-${T1}"]`) as Element
    fireEvent.click(firstRow.querySelector('.ui-btn--primary') as Element)
    expect(sendPlayerUUID).toHaveBeenCalledWith(T1, 'g1')
  })

  it('apply sends the bottom of the stack first (reverse resolution order)', async () => {
    const { container } = renderDialog(prompt())
    fireEvent.click(container.querySelector('.trigger-apply') as Element)
    await vi.waitFor(() => {
      expect(sendPlayerUUID.mock.calls.map((call) => call[0])).toEqual([T2])
    })
  })

  it('move down changes the first applied pick', async () => {
    const { container } = renderDialog(prompt())
    const firstRow = container.querySelector(`[data-testid="trigger-row-${T1}"]`) as Element
    const moveDown = firstRow.querySelectorAll('.trigger-move button')[1] as Element
    fireEvent.click(moveDown)
    fireEvent.click(container.querySelector('.trigger-apply') as Element)
    await vi.waitFor(() => {
      expect(sendPlayerUUID.mock.calls.map((call) => call[0])).toEqual([T1])
    })
  })

  it('chains the remaining picks automatically across prompts', async () => {
    const sendNow = makeSendNow()
    const { container, rerender } = renderDialog(prompt(), { sendNow })
    fireEvent.click(container.querySelector('.trigger-apply') as Element)
    await vi.waitFor(() => expect(sendPlayerUUID).toHaveBeenCalledWith(T2, 'g1'))

    const remaining = (prompt().cards ?? [])[0]
    const second = { ...prompt(), cards: [remaining], options: [prompt().options[0]] }
    rerender(<TriggerOrderDialog prompt={second} send={makeSend() as never} sendNow={sendNow as never} busy={false} />)
    await vi.waitFor(() => expect(sendPlayerUUID).toHaveBeenCalledWith(T1, 'g1'))
  })

  it('shows the plan order with sent rows marked while chaining', async () => {
    const { container } = renderDialog(prompt())
    fireEvent.click(container.querySelector('.trigger-apply') as Element)
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.trigger-row').length).toBe(2)
      expect(container.querySelector('.trigger-row.is-sent, .trigger-row.is-next')).not.toBeNull()
    })
  })

  it('denies a plan whose next pick vanished (falls back to manual)', async () => {
    const sendNow = makeSendNow()
    const { container, rerender } = renderDialog(prompt(), { sendNow })
    fireEvent.click(container.querySelector('.trigger-apply') as Element)
    await vi.waitFor(() => expect(sendPlayerUUID).toHaveBeenCalled())

    const stranger = { ...prompt(), cards: [{ id: 'other', name: 'Other', rules: ['Whenever X, draw a card.'] }], options: [{ id: 'other', label: 'Other', value: 'other' }] }
    sendPlayerUUID.mockClear()
    rerender(<TriggerOrderDialog prompt={stranger} send={makeSend() as never} sendNow={sendNow as never} busy={false} />)
    expect(sendPlayerUUID).not.toHaveBeenCalled()
    expect(container.querySelector('.trigger-apply')).not.toBeNull()
  })

  it('pin buttons remember a rule without placing the trigger', async () => {
    const { container, send, sendNow } = renderDialog(prompt())
    const firstRow = container.querySelector(`[data-testid="trigger-row-${T1}"]`) as Element
    const btns = firstRow.querySelectorAll('.trigger-actions button')
    fireEvent.click(btns[1] as Element)
    await vi.waitFor(() => {
      expect(sendTriggerAutoOrder).toHaveBeenCalledWith('TRIGGER_AUTO_ORDER_ABILITY_FIRST', 'g1', T1)
    })
    expect(sendPlayerUUID).not.toHaveBeenCalled()
    fireEvent.click(btns[2] as Element)
    await vi.waitFor(() => {
      expect(sendTriggerAutoOrder).toHaveBeenCalledWith('TRIGGER_AUTO_ORDER_ABILITY_LAST', 'g1', T1)
    })
    expect(sendPlayerUUID).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(sendNow).not.toHaveBeenCalled()
  })

  it('name scope sends the rule text instead of the uuid', async () => {
    const { container } = renderDialog(prompt())
    const scopeBtns = container.querySelectorAll('.trigger-scope [role="tab"]')
    fireEvent.click(scopeBtns[1] as Element)
    const firstRow = container.querySelector(`[data-testid="trigger-row-${T1}"]`) as Element
    fireEvent.click(firstRow.querySelectorAll('.trigger-actions button')[1] as Element)
    await vi.waitFor(() => {
      expect(sendTriggerAutoOrder).toHaveBeenCalledWith(
        'TRIGGER_AUTO_ORDER_NAME_FIRST',
        'g1',
        'Whenever another creature enters the battlefield, you gain 1 life.',
      )
    })
  })

  it('reset sends RESET_ALL without answering', async () => {
    const { container, send, sendNow } = renderDialog(prompt())
    fireEvent.click(container.querySelector('.trigger-footer button') as Element)
    await vi.waitFor(() => {
      expect(sendTriggerAutoOrder).toHaveBeenCalledWith('TRIGGER_AUTO_ORDER_RESET_ALL', 'g1')
    })
    expect(send).not.toHaveBeenCalled()
    expect(sendNow).not.toHaveBeenCalled()
  })

  it('a rejected rule is reported and leaves the pin unset', async () => {
    sendTriggerAutoOrder.mockResolvedValueOnce({ ok: false, error: 'rejected' })
    const { container } = renderDialog(prompt())
    const firstRow = container.querySelector(`[data-testid="trigger-row-${T1}"]`) as Element
    fireEvent.click(firstRow.querySelectorAll('.trigger-actions button')[1] as Element)
    await vi.waitFor(() => expect(getState().error).toBe('rejected'))
  })

  it('hides the rule line when it is just the card name', () => {
    const p = prompt()
    p.cards = [
      ...(p.cards ?? []),
      { id: 't3', name: 'Forest', displayName: 'Forest', rules: [] },
    ]
    p.options = [...p.options, { id: 't3', label: 'Forest', value: 't3' }]
    const { container } = renderDialog(p)
    const row = container.querySelector('[data-testid="trigger-row-t3"]') as Element
    expect(row.querySelector('.trigger-rule')).toBeNull()
    expect(row.textContent).toContain('Forest')
  })

  it('PRM-14: shows the card each trigger points at, wherever it is now', () => {
    const p = prompt()
    p.cards = [{ ...(p.cards ?? [])[0], targets: ['perm-9'] }]
    p.options = [p.options[0]]
    const { container } = renderDialog(p)
    const object = container.querySelector('.trigger-object')
    expect(object?.textContent).toContain('Grizzly Bears')
    expect(object?.textContent).toContain('Rival')
    expect(container.querySelector('.trigger-object-art [data-card-name="Grizzly Bears"]')).not.toBeNull()
  })

  describe('PRM-14: Tergrid-like triggers of one source', () => {
    const tergrid = (id: string, cardId: string, cardName: string) => ({
      id,
      name: 'Tergrid, God of Fright',
      sourceCard: { id: 'perm-tergrid', name: 'Tergrid, God of Fright', manaValue: 5 },
      rules: [
        'Whenever an opponent sacrifices a nontoken permanent or discards a permanent card, you may put that card from a graveyard onto the battlefield under your control.',
        `<i>Related objects: [${cardName}]</i>`,
      ],
      targets: [cardId],
    })
    const tergridPrompt = (): FeedbackPrompt => ({
      ...prompt(),
      cards: [tergrid(T1, 'grave-elves', 'Llanowar Elves'), tergrid(T2, 'grave-ring', 'Sol Ring')],
    })

    beforeEach(() => {
      setState({
        inspectedCard: null,
        game: {
          players: [
            {
              playerId: 'p-me', name: 'Me', controlled: true,
              battlefield: { 'perm-tergrid': { id: 'perm-tergrid', name: 'Tergrid, God of Fright', power: '4', toughness: '5' } },
            },
            {
              playerId: 'p-opp', name: 'Rival', battlefield: {},
              graveyard: {
                'grave-elves': { id: 'grave-elves', name: 'Llanowar Elves' },
                'grave-ring': { id: 'grave-ring', name: 'Sol Ring' },
              },
            },
          ],
          stack: {},
          myHand: {},
          myHelperEmblems: {},
        },
      } as never)
    })

    it('PRM-14: rows of one source are told apart by the graveyard card each one points at', () => {
      const { container } = renderDialog(tergridPrompt())
      const rows = [...container.querySelectorAll('.trigger-row')]
      expect(rows.every((row) => row.classList.contains('is-sibling'))).toBe(true)
      expect(rows.map((row) => row.querySelector('.trigger-object-name')?.textContent)).toEqual(['Llanowar Elves', 'Sol Ring'])
      expect(rows[0].querySelector('.trigger-object-zone')?.textContent).toContain('Rival')
      // The object chips already name the card: the server's "Related objects" line is not repeated.
      expect(container.querySelector('.trigger-related')).toBeNull()
    })

    it('PRM-14: the source thumbnail opens the live permanent in the inspector', () => {
      const { container } = renderDialog(tergridPrompt())
      const source = container.querySelector(`[data-testid="trigger-row-${T1}"] .trigger-art`) as Element
      fireEvent.contextMenu(source)
      expect((getState().inspectedCard as { power?: string } | null)?.power).toBe('4')
    })

    it('PRM-14: pointing at the object card previews it and a right click opens it in the inspector', () => {
      const { container } = renderDialog(tergridPrompt())
      const thumb = container.querySelector(`[data-testid="trigger-row-${T1}"] .trigger-object-art`) as Element
      fireEvent.mouseEnter(thumb)
      expect(thumb.classList.contains('is-previewing')).toBe(true)
      fireEvent.mouseLeave(thumb)
      expect(thumb.classList.contains('is-previewing')).toBe(false)
      fireEvent.contextMenu(thumb)
      expect((getState().inspectedCard as { id?: string } | null)?.id).toBe('grave-elves')
      expect(sendPlayerUUID).not.toHaveBeenCalled()
    })

    it('PRM-14: a touch previews the card without choosing the trigger and stays until the next touch', () => {
      const { container } = renderDialog(tergridPrompt())
      const thumb = container.querySelector(`[data-testid="trigger-row-${T1}"] .trigger-object-art`) as Element
      touchDown(thumb)
      fireEvent.mouseLeave(thumb)
      fireEvent.click(thumb)
      expect(thumb.classList.contains('is-previewing')).toBe(true)
      expect(sendPlayerUUID).not.toHaveBeenCalled()
      touchDown(container.querySelector('.trigger-name') as Element)
      expect(thumb.classList.contains('is-previewing')).toBe(false)
    })

    it('PRM-14: keeps the "Related objects" line when the object is not in the view', () => {
      const p = tergridPrompt()
      p.cards = [tergrid(T1, 'gone-card', 'Mox Opal')]
      const { container } = renderDialog(p)
      expect(container.querySelector('.trigger-related')?.textContent).toContain('Mox Opal')
      expect(container.querySelector('.trigger-object-art')).toBeNull()
    })
  })

  it('has no Cancel button (the server only re-asks)', () => {
    const { container } = renderDialog(prompt())
    expect(container.textContent).not.toContain('Cancelar')
    expect(container.querySelectorAll('.trigger-footer button').length).toBe(2)
  })
})
