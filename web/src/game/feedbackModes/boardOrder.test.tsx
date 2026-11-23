import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEffect, useState, type ReactNode } from 'react'
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

/** The board publishes its two slots; this stands in for it, dock and middle of the board. */
function Board({ children, withOrder = true }: { children: ReactNode; withOrder?: boolean }) {
  const [dock, setDock] = useState<HTMLElement | null>(null)
  const [order, setOrder] = useState<HTMLElement | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return (
    <div>
      <div data-testid="order-slot" ref={withOrder ? setOrder : undefined} />
      <div data-testid="dock-slot" ref={setDock} />
      {ready && (
        <PromptSlotProvider value={dock} order={withOrder ? order : null}>
          {children}
        </PromptSlotProvider>
      )}
    </div>
  )
}

const combat: FeedbackPrompt = {
  method: 'GAME_SELECT', gameId: 'g1', title: 'Combat', message: 'Select attackers',
  mode: 'combat', options: [], min: 0, max: 0, isDeclaringAttackers: true,
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
    expect(dock.textContent, 'and the hint that says how').toContain('clic')
  })

  it('PRM-18: the mana order is the cost the server asked for, not the name of the bar', () => {
    const { container } = render(<Board><ManaBar form={stubForm(mana)} /></Board>)
    const { order, dock } = slots(container)
    const text = order.querySelector('[data-testid="board-order"]')?.textContent ?? ''
    expect(text).toContain('1')
    expect(dock.querySelector('.action-prompt-title'), 'the dock no longer repeats it').toBeNull()
  })

  it('PRM-18: the target order names the card that is asking', () => {
    const { container } = render(<Board><TargetBar form={stubForm(target)} /></Board>)
    const { order } = slots(container)
    expect(order.querySelector('[data-testid="board-order"]')?.textContent).toContain('Lightning Bolt')
  })

  it('PRM-18: with no board to lay it over, the order falls back into the dock', () => {
    const { container } = render(<Board withOrder={false}><CombatBar form={stubForm(combat)} /></Board>)
    const { dock } = slots(container)
    expect(dock.querySelector('[data-testid="board-order"]'), 'nothing of the order is lost').not.toBeNull()
  })
})
