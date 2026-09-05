import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import TriggerOrderDialog from './TriggerOrderDialog'
import type { FeedbackPrompt } from './feedback'

const sendPlayerUUID = vi.fn().mockResolvedValue({ ok: true })
const sendTriggerAutoOrder = vi.fn().mockResolvedValue({ ok: true })

vi.mock('../net/commands', () => ({
  sendPlayerUUID: (...args: unknown[]) => sendPlayerUUID(...args),
  sendTriggerAutoOrder: (...args: unknown[]) => sendTriggerAutoOrder(...args),
}))

function prompt(): FeedbackPrompt {
  return {
    method: 'GAME_TARGET',
    gameId: 'g1',
    title: 'Trigger order',
    message: 'Pick triggered ability (goes to the stack first)',
    mode: 'uuid',
    options: [
      { id: 't1', label: 'Soul Warden', value: 't1' },
      { id: 't2', label: 'Blood Artist', value: 't2' },
    ],
    min: 1,
    max: 1,
    cards: [
      { id: 't1', name: 'Soul Warden', rules: ['Whenever another creature enters the battlefield, you gain 1 life.'] },
      { id: 't2', name: 'Blood Artist', rules: ['Whenever Blood Artist or another creature dies, target player loses 1 life.'] },
    ],
    isTriggerOrder: true,
  }
}

describe('TriggerOrderDialog', () => {
  it('renders one row per trigger with choose + first/last actions', () => {
    const send = vi.fn((action: () => Promise<unknown>) => { void action(); })
    const { container } = render(<TriggerOrderDialog prompt={prompt()} send={send as never} cancel={() => {}} busy={false} />)
    expect(container.querySelectorAll('.trigger-row').length).toBe(2)
    expect(container.textContent).toContain('Soul Warden')
    expect(container.textContent).toContain('Whenever another creature enters')
  })

  it('choose answers with the trigger uuid', () => {
    const send = vi.fn((action: () => Promise<unknown>) => { void action(); })
    const { container } = render(<TriggerOrderDialog prompt={prompt()} send={send as never} cancel={() => {}} busy={false} />)
    const firstRow = container.querySelector('[data-testid="trigger-row-t1"]') as Element
    fireEvent.click(firstRow.querySelector('.trigger-btn.primary') as Element)
    expect(sendPlayerUUID).toHaveBeenCalledWith('t1', 'g1')
  })

  it('first remembers ability-first and answers with the trigger', async () => {
    const send = vi.fn((action: () => Promise<unknown>) => { void action(); })
    const { container } = render(<TriggerOrderDialog prompt={prompt()} send={send as never} cancel={() => {}} busy={false} />)
    const firstRow = container.querySelector('[data-testid="trigger-row-t1"]') as Element
    const btns = firstRow.querySelectorAll('.trigger-btn')
    fireEvent.click(btns[1] as Element)
    await vi.waitFor(() => {
      expect(sendTriggerAutoOrder).toHaveBeenCalledWith('TRIGGER_AUTO_ORDER_ABILITY_FIRST', 'g1', 't1')
      expect(sendPlayerUUID).toHaveBeenCalledWith('t1', 'g1')
    })
  })

  it('last remembers ability-last and refreshes with null uuid', async () => {
    const send = vi.fn((action: () => Promise<unknown>) => { void action(); })
    const { container } = render(<TriggerOrderDialog prompt={prompt()} send={send as never} cancel={() => {}} busy={false} />)
    const firstRow = container.querySelector('[data-testid="trigger-row-t1"]') as Element
    const btns = firstRow.querySelectorAll('.trigger-btn')
    fireEvent.click(btns[2] as Element)
    await vi.waitFor(() => {
      expect(sendTriggerAutoOrder).toHaveBeenCalledWith('TRIGGER_AUTO_ORDER_ABILITY_LAST', 'g1', 't1')
      expect(sendPlayerUUID).toHaveBeenCalledWith(null, 'g1')
    })
  })

  it('name scope sends the rule text instead of the uuid', async () => {
    const send = vi.fn((action: () => Promise<unknown>) => { void action(); })
    const { container } = render(<TriggerOrderDialog prompt={prompt()} send={send as never} cancel={() => {}} busy={false} />)
    const scopeBtns = container.querySelectorAll('.trigger-scope-btn')
    fireEvent.click(scopeBtns[1] as Element)
    const firstRow = container.querySelector('[data-testid="trigger-row-t1"]') as Element
    fireEvent.click(firstRow.querySelectorAll('.trigger-btn')[1] as Element)
    await vi.waitFor(() => {
      expect(sendTriggerAutoOrder).toHaveBeenCalledWith(
        'TRIGGER_AUTO_ORDER_NAME_FIRST',
        'g1',
        'Whenever another creature enters the battlefield, you gain 1 life.',
      )
    })
  })

  it('reset sends RESET_ALL without answering', async () => {
    const send = vi.fn((action: () => Promise<unknown>) => { void action(); })
    const { container } = render(<TriggerOrderDialog prompt={prompt()} send={send as never} cancel={() => {}} busy={false} />)
    fireEvent.click(container.querySelector('.trigger-footer .trigger-btn') as Element)
    await vi.waitFor(() => {
      expect(sendTriggerAutoOrder).toHaveBeenCalledWith('TRIGGER_AUTO_ORDER_RESET_ALL', 'g1')
    })
  })
})
