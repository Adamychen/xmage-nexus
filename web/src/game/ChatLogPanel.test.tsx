import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatLogPanel, { ChatLogToggles } from './ChatLogPanel'
import { setState } from '../state/store'

const chat = (id: number, text = 'hola') => ({ id, time: 0, from: 'Bob', text, channel: 'chat' as const })

describe('ChatLogPanel', () => {
  beforeEach(() => {
    setState({ log: [], game: null })
  })

  afterEach(() => {
    cleanup()
  })

  it('PNL-10: the panel shows the log or the chat, and a tab switches between them', () => {
    const onTabChange = vi.fn()
    const { getByTestId, rerender } = render(<ChatLogPanel tab="log" onTabChange={onTabChange} onClose={() => {}} />)
    expect(getByTestId('chatlog-panel').getAttribute('data-tab')).toBe('log')
    expect(getByTestId('chatlog-tab-log').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(getByTestId('chatlog-tab-chat'))
    expect(onTabChange).toHaveBeenCalledWith('chat')
    rerender(<ChatLogPanel tab="chat" onTabChange={onTabChange} onClose={() => {}} />)
    expect(getByTestId('chatlog-panel').getAttribute('data-tab')).toBe('chat')
    expect(getByTestId('chatlog-tab-chat').getAttribute('aria-selected')).toBe('true')
  })

  it('PNL-10: the panel starts under the phase strip, so it never covers it', () => {
    const wrap = document.createElement('div')
    wrap.className = 'board-wrap'
    const strip = document.createElement('div')
    strip.setAttribute('data-testid', 'game-strip')
    const host = document.createElement('div')
    wrap.append(strip, host)
    document.body.appendChild(wrap)
    const box = (top: number, bottom: number) => () => ({ top, bottom, left: 0, right: 800, width: 800, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
    wrap.getBoundingClientRect = box(100, 900)
    strip.getBoundingClientRect = box(440, 480)
    const { getByTestId } = render(<ChatLogPanel tab="log" onTabChange={() => {}} onClose={() => {}} />, { container: host })
    expect(getByTestId('chatlog-panel').style.getPropertyValue('--chatlog-top')).toBe('388px')
    wrap.remove()
  })

  it('PNL-10: Escape closes the panel', () => {
    const onClose = vi.fn()
    render(<ChatLogPanel tab="log" onTabChange={() => {}} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('PNL-10: the chat toggle counts unread messages while the chat is closed', () => {
    const { getByTestId, queryByTestId, rerender } = render(<ChatLogToggles active={null} onToggle={() => {}} />)
    expect(queryByTestId('chat-unread')).toBeNull()
    act(() => setState({ log: [chat(1)] as never }))
    expect(getByTestId('chat-unread').textContent).toBe('1')
    rerender(<ChatLogToggles active="chat" onToggle={() => {}} />)
    expect(queryByTestId('chat-unread')).toBeNull()
  })

  it('PNL-10: system lines do not count as unread chat', () => {
    const { queryByTestId } = render(<ChatLogToggles active={null} onToggle={() => {}} />)
    act(() => setState({ log: [{ id: 1, time: 0, from: 'partida', text: 'Turno 3', channel: 'game' as const }] as never }))
    expect(queryByTestId('chat-unread')).toBeNull()
  })

  it('PNL-10: each toggle names its panel and reports which one is open', () => {
    const onToggle = vi.fn()
    const { getByTestId } = render(<ChatLogToggles active="log" onToggle={onToggle} />)
    expect(getByTestId('chatlog-toggle-log').getAttribute('aria-pressed')).toBe('true')
    expect(getByTestId('chatlog-toggle-chat').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(getByTestId('chatlog-toggle-chat'))
    expect(onToggle).toHaveBeenCalledWith('chat')
  })
})
