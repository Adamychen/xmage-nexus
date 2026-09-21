import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GameDrawer, { DrawerToggles, type DrawerTab } from './GameDrawer'
import { setState } from '../state/store'
import { useState } from 'react'

function Harness({ commanders = false, mechanics = false, stackCount = 0 }: { commanders?: boolean; mechanics?: boolean; stackCount?: number }) {
  const [tab, setTab] = useState<DrawerTab | null>(null)
  return (
    <>
      <DrawerToggles
        active={tab}
        stackCount={stackCount}
        onToggle={(next) => setTab((cur) => (cur === next ? null : next))}
        hasCommanders={commanders}
        hasActiveMechanics={mechanics}
      />
      {tab && <GameDrawer tab={tab} stackCount={stackCount} stack={<div data-testid="stack-content" />} onClose={() => setTab(null)} />}
    </>
  )
}

const chat = (id: number, text = 'hola') => ({ id, time: 0, from: 'Bob', text, channel: 'chat' as const })

describe('GameDrawer', () => {
  beforeEach(() => {
    setState({ log: [], game: null })
  })

  afterEach(() => {
    cleanup()
  })

  it('arranca cerrado y alterna al pulsar el mismo botón', () => {
    const { getByTestId, queryByTestId } = render(<Harness />)
    expect(queryByTestId('game-drawer')).toBeNull()
    fireEvent.click(getByTestId('drawer-tab-log'))
    expect(getByTestId('game-drawer').getAttribute('data-tab')).toBe('log')
    expect(getByTestId('drawer-tab-log').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(getByTestId('drawer-tab-log'))
    expect(queryByTestId('game-drawer')).toBeNull()
  })

  it('cambia de pestaña sin cerrar y el botón de cierre lo oculta', () => {
    const { getByTestId, queryByTestId, getByRole } = render(<Harness />)
    fireEvent.click(getByTestId('drawer-tab-log'))
    fireEvent.click(getByTestId('drawer-tab-chat'))
    expect(getByTestId('game-drawer').getAttribute('data-tab')).toBe('chat')
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

  it('el icono de la pila muestra el contador y abre su contenido', () => {
    const empty = render(<Harness />)
    expect(empty.queryByTestId('stack-count')).toBeNull()
    empty.unmount()
    const { getByTestId } = render(<Harness stackCount={3} />)
    expect(getByTestId('stack-count').textContent).toBe('3')
    fireEvent.click(getByTestId('drawer-tab-stack'))
    expect(getByTestId('game-drawer').getAttribute('data-tab')).toBe('stack')
    expect(getByTestId('stack-content')).toBeDefined()
    expect(getByTestId('game-drawer').textContent).toContain('(3)')
  })

  it('marca las mecánicas activas con una estrella', () => {
    const { getByTestId } = render(<Harness mechanics />)
    expect(getByTestId('drawer-tab-mechanics').querySelector('.active-mechanics')).not.toBeNull()
  })

  it('cuenta los mensajes de chat no leídos y los limpia al abrir el chat', () => {
    const { getByTestId, queryByTestId } = render(<Harness />)
    expect(queryByTestId('chat-unread')).toBeNull()
    act(() => setState({ log: [chat(1), chat(2)] }))
    expect(getByTestId('chat-unread').textContent).toBe('2')
    fireEvent.click(getByTestId('drawer-tab-chat'))
    expect(queryByTestId('chat-unread')).toBeNull()
    act(() => setState({ log: [chat(1), chat(2), chat(3)] }))
    expect(queryByTestId('chat-unread')).toBeNull()
  })

  it('las líneas del sistema no cuentan como chat no leído', () => {
    const { queryByTestId } = render(<Harness />)
    act(() => setState({ log: [{ id: 1, time: 0, from: 'partida', text: 'Turno 3', channel: 'game' as const }] }))
    expect(queryByTestId('chat-unread')).toBeNull()
  })
})
