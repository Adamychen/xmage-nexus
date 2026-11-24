import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GameDrawer, { DrawerToggles, type DrawerTab } from './GameDrawer'
import { setState } from '../state/store'
import { useState } from 'react'

function Harness({ commanders = false, mechanics = false }: { commanders?: boolean; mechanics?: boolean }) {
  const [tab, setTab] = useState<DrawerTab | null>(null)
  return (
    <>
      <DrawerToggles
        active={tab}
        onToggle={(next) => setTab((cur) => (cur === next ? null : next))}
        hasCommanders={commanders}
        hasActiveMechanics={mechanics}
      />
      {tab && <GameDrawer tab={tab} onClose={() => setTab(null)} />}
    </>
  )
}

describe('GameDrawer', () => {
  beforeEach(() => {
    setState({ log: [], game: null })
  })

  afterEach(() => {
    cleanup()
  })

  it('starts closed and the same button toggles it', () => {
    const { getByTestId, queryByTestId } = render(<Harness />)
    expect(queryByTestId('game-drawer')).toBeNull()
    fireEvent.click(getByTestId('drawer-tab-mechanics'))
    expect(getByTestId('game-drawer').getAttribute('data-tab')).toBe('mechanics')
    expect(getByTestId('drawer-tab-mechanics').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(getByTestId('drawer-tab-mechanics'))
    expect(queryByTestId('game-drawer')).toBeNull()
  })

  it('switches tab without closing, and its close button hides it', () => {
    const { getByTestId, queryByTestId, getByRole } = render(<Harness commanders />)
    fireEvent.click(getByTestId('drawer-tab-mechanics'))
    fireEvent.click(getByTestId('drawer-tab-commander'))
    expect(getByTestId('game-drawer').getAttribute('data-tab')).toBe('commander')
    fireEvent.click(getByRole('button', { name: /close|cerrar/i }))
    expect(queryByTestId('game-drawer')).toBeNull()
  })

  it('el botón de comandante solo existe con comandantes en la partida', () => {
    const without = render(<Harness />)
    expect(without.queryByTestId('drawer-tab-commander')).toBeNull()
    without.unmount()
    const withCommanders = render(<Harness commanders />)
    expect(withCommanders.queryByTestId('drawer-tab-commander')).not.toBeNull()
  })

  it('STK-2: the drawer has no tab for the stack: the stack is on the board', () => {
    const { queryByTestId } = render(<Harness />)
    expect(queryByTestId('drawer-tab-stack')).toBeNull()
    expect(queryByTestId('stack-count')).toBeNull()
  })

  it('marca las mecánicas activas con una estrella', () => {
    const { getByTestId } = render(<Harness mechanics />)
    expect(getByTestId('drawer-tab-mechanics').querySelector('.active-mechanics')).not.toBeNull()
  })

})
