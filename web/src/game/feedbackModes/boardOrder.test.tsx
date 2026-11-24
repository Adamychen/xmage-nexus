import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEffect, useState, type ReactNode } from 'react'
import { announceBanner, clearFeedbackFx } from '../../board/feedbackFx'
import { OrderSlot } from '../GameDock'
import CombatBar from './CombatBar'
import ManaBar from './ManaBar'
import TargetBar from './TargetBar'
import { PromptSlotProvider } from '../GameDock'
import type { UseFeedbackForm } from '../useFeedbackForm'
import type { FeedbackPrompt } from '../feedback/types'

function stubForm(prompt: FeedbackPrompt): UseFeedbackForm {
  return {
    prompt,
    busy: false,
    amount: 0,
    setAmount: () => {},
    selected: [],
    setSelected: () => {},
    multiAmounts: {},
    setMultiAmounts: () => {},
    textValue: '',
    setTextValue: () => {},
    filteredStringOptions: [],
    send: () => Promise.resolve(),
    sendNow: () => Promise.resolve(true),
    cancel: () => {},
    finishOptionalTarget: () => {},
    selectOption: () => {},
    confirmSelected: () => {},
    confirmAmount: () => {},
    confirmMultiAmount: () => {},
  }
}

/** The board publishes its slots; this stands in for it: dock, middle of the board, big button. */
function Board({ children, withOrder = true }: { children: ReactNode; withOrder?: boolean }) {
  const [dock, setDock] = useState<HTMLElement | null>(null)
  const [order, setOrder] = useState<HTMLElement | null>(null)
  const [action, setAction] = useState<HTMLElement | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return (
    <div>
      <div data-testid="order-slot" ref={withOrder ? setOrder : undefined} />
      <div data-testid="action-slot" ref={setAction} />
      <div data-testid="dock-slot" ref={setDock} />
      {ready && (
        <PromptSlotProvider value={dock} order={withOrder ? order : null} actionSlot={action}>
          {children}
        </PromptSlotProvider>
      )}
    </div>
  )
}

const combat: FeedbackPrompt = {
  method: 'GAME_SELECT', gameId: 'g1', title: 'Combat', message: 'Select attackers',
  mode: 'combat', options: [], min: 0, max: 0, isDeclaringAttackers: true, special: true,
} as FeedbackPrompt

const mana: FeedbackPrompt = {
  method: 'GAME_PLAY_MANA', gameId: 'g1', title: 'Mana', message: 'Pay {1}{U}',
  mode: 'mana', options: [], min: 0, max: 0,
} as FeedbackPrompt

const target: FeedbackPrompt = {
  method: 'GAME_TARGET', gameId: 'g1', title: 'Target', message: 'Choose a target',
  mode: 'uuid', options: [], min: 0, max: 1, sourceName: 'Lightning Bolt',
} as FeedbackPrompt

describe('the order the player is being given', () => {
  const slots = (container: HTMLElement) => ({
    order: container.querySelector('[data-testid="order-slot"]')!,
    dock: container.querySelector('[data-testid="dock-slot"]')!,
  })

  it('PRM-18: the combat order is read over the board, and the controls stay in the dock', () => {
    const { container } = render(<Board><CombatBar form={stubForm(combat)} /></Board>)
    const { order, dock } = slots(container)
    expect(order.querySelector('[data-testid="board-order"]')?.textContent).toContain('atacantes')
    expect(dock.querySelector('[data-testid="board-order"]'), 'and not in the dock as well').toBeNull()
    expect(dock.querySelector('.action-prompt-actions'), 'which keeps what answers it').not.toBeNull()
    expect(dock.querySelector('.action-prompt-hint'), 'and nothing it explains with').toBeNull()
  })

  it('PRM-18: the mana order is the cost the server asked for, not the name of the bar', () => {
    const { container } = render(<Board><ManaBar form={stubForm(mana)} /></Board>)
    const { order, dock } = slots(container)
    const text = order.querySelector('[data-testid="board-order"]')?.textContent ?? ''
    expect(text).toContain('1')
    expect(dock.querySelector('.action-prompt-title'), 'the dock no longer repeats it').toBeNull()
  })

  it('PRM-18: the target order says what to do, in the words the server sent', () => {
    const { container } = render(<Board><TargetBar form={stubForm(target)} /></Board>)
    const { order, dock } = slots(container)
    const text = order.querySelector('[data-testid="board-order"]')?.textContent ?? ''
    // the card's name on its own is a noun, not an order: what the server says is the order
    expect(text).not.toBe('Lightning Bolt')
    expect(text.length).toBeGreaterThan(0)
    expect(dock.querySelector('.action-prompt-hint'), 'and the dock explains nothing').toBeNull()
  })

  it('PRM-18: when the server names the card in its order, the board reads that', () => {
    const named = { ...target, message: 'Select a target for Lightning Bolt' } as FeedbackPrompt
    const { container } = render(<Board><TargetBar form={stubForm(named)} /></Board>)
    const { order } = slots(container)
    expect(order.querySelector('[data-testid="board-order"]')?.textContent).toContain('Lightning Bolt')
  })

  it('PRM-18: with no board to lay it over, the order falls back into the dock', () => {
    const { container } = render(<Board withOrder={false}><CombatBar form={stubForm(combat)} /></Board>)
    const { dock } = slots(container)
    expect(dock.querySelector('[data-testid="board-order"]'), 'nothing of the order is lost').not.toBeNull()
  })
})

describe('the order and the turn banner share the rail', () => {
  it('PRM-18, FX-10: the order yields while the banner is up, and takes the rail back after it', () => {
    clearFeedbackFx()
    const { getByTestId, rerender } = render(<OrderSlot onSlot={() => {}} />)
    expect(getByTestId('board-order-slot').hasAttribute('data-yielding'), 'nothing to yield to').toBe(false)
    announceBanner('Pablo', 'Turno de')
    rerender(<OrderSlot onSlot={() => {}} />)
    expect(getByTestId('board-order-slot').getAttribute('data-yielding')).toBe('1')
    clearFeedbackFx()
    rerender(<OrderSlot onSlot={() => {}} />)
    expect(getByTestId('board-order-slot').hasAttribute('data-yielding')).toBe(false)
  })
})

describe('the one action that answers the prompt', () => {
  const slotOf = (container: HTMLElement, name: string) => container.querySelector(`[data-testid="${name}"]`)!

  it('PRM-19: leaving a mana payment stands where the big button stands, not in the bar', () => {
    const { container } = render(<Board><ManaBar form={stubForm(mana)} /></Board>)
    const action = slotOf(container, 'action-slot').querySelector<HTMLButtonElement>('[data-testid="prompt-action"]')
    expect(action, 'the prompt took the button').not.toBeNull()
    expect(action?.textContent).toContain('Cancelar')
    expect(slotOf(container, 'dock-slot').querySelector('.cancel-btn'), 'and the bar does not keep it too').toBeNull()
    expect(slotOf(container, 'dock-slot').textContent, 'what the button cannot do stays there').toContain('especial')
  })

  it('PRM-19: a finished optional target is the same one button, never two', () => {
    const optional = { ...target, required: false, cancelable: false } as FeedbackPrompt
    const { container } = render(<Board><TargetBar form={stubForm(optional)} /></Board>)
    const buttons = container.querySelectorAll('[data-testid="prompt-action"]')
    expect(buttons.length).toBe(1)
    expect(buttons[0].textContent).toContain('Terminar')
  })

  it('PRM-19, CMB-13: combat puts going forward on the big button and stepping back above it', () => {
    const { container } = render(<Board><CombatBar form={stubForm(combat)} /></Board>)
    const primary = slotOf(container, 'action-slot').querySelector('[data-testid="prompt-action"]')
    const second = slotOf(container, 'dock-slot').querySelector('[data-testid="prompt-second"]')
    // nothing declared: forward is declaring everything, stepping out is "no attacks"
    expect(primary?.textContent).toMatch(/todos/i)
    expect(second?.textContent).toMatch(/Sin ataques/i)
    expect(slotOf(container, 'dock-slot').textContent, 'and the confirm is not repeated here').not.toMatch(/Confirmar/i)
  })

  it('CMB-13: with no attack-all to offer, the big button is the only way out and nothing sits above it', () => {
    const plain = { ...combat, special: false } as FeedbackPrompt
    const { container } = render(<Board><CombatBar form={stubForm(plain)} /></Board>)
    expect(slotOf(container, 'action-slot').querySelector('[data-testid="prompt-action"]')?.textContent).toMatch(/Sin ataques/i)
    expect(slotOf(container, 'dock-slot').querySelector('[data-testid="prompt-second"]')).toBeNull()
  })
})
