import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
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

  it('shows the targets that distinguish duplicate triggers', () => {
    const p = prompt()
    p.cards = [{ ...(p.cards ?? [])[0], targets: ['perm-9'] }]
    p.options = [p.options[0]]
    const { container } = renderDialog(p)
    expect(container.querySelector('.trigger-targets')?.textContent).toContain('Grizzly Bears')
  })

  it('has no Cancel button (the server only re-asks)', () => {
    const { container } = renderDialog(prompt())
    expect(container.textContent).not.toContain('Cancelar')
    expect(container.querySelectorAll('.trigger-footer button').length).toBe(2)
  })
})
