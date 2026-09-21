import { cleanup, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import GameDock, { DockPrompt, PromptSlotProvider } from './GameDock'

function Harness({ withDock = true }: { withDock?: boolean }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return (
    <PromptSlotProvider value={slot}>
      {withDock && <GameDock action={<span data-testid="action" />} onPromptSlot={setSlot} />}
      <DockPrompt>
        <div data-testid="bar" />
      </DockPrompt>
    </PromptSlotProvider>
  )
}

describe('GameDock', () => {
  afterEach(() => {
    cleanup()
  })

  it('monta la barra de prompt en la columna del dock', () => {
    const { getByTestId } = render(<Harness />)
    expect(getByTestId('bar').parentElement?.className).toContain('game-dock-prompt')
    expect(getByTestId('bar').closest('[data-testid="game-dock"]')).not.toBeNull()
  })

  it('ordena de arriba abajo: prompt y botón principal', () => {
    const { getByTestId } = render(<Harness />)
    const children = Array.from(getByTestId('game-dock').children)
    const index = (el: Element) => children.findIndex((c) => c === el || c.contains(el))
    expect(index(getByTestId('bar'))).toBeLessThan(index(getByTestId('action')))
  })

  it('sin dock la barra se pinta en su sitio', () => {
    const { getByTestId, queryByTestId } = render(<Harness withDock={false} />)
    expect(queryByTestId('game-dock')).toBeNull()
    expect(getByTestId('bar')).toBeDefined()
  })
})
