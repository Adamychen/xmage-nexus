import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatBox, { formatChatTime, MAX_CHAT_MESSAGE_SIZE } from './ChatBox'
import * as cmds from '../net/commands'
import { setState } from '../state/state'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  setState({
    conn: null,
    roomChatId: 'chat-123',
    chatMessages: [
      { chatId: 'chat-123', username: 'Alice', message: 'Hello everyone!' },
      { chatId: 'chat-123', username: '', message: 'di2aco has joined' },
      { chatId: 'chat-123', username: 'server', message: 'cardzigger has lost connection' },
      { chatId: 'chat-123', username: 'Bob', message: 'Good luck!' },
    ],
  })
})

describe('ChatBox component', () => {
  it('renders user chat and formatted system notices without orphan colons', () => {
    const { getByText, queryByText } = render(<ChatBox />)

    // User messages
    expect(getByText('Alice:')).not.toBeNull()
    expect(getByText('Hello everyone!')).not.toBeNull()
    expect(getByText('Bob:')).not.toBeNull()
    expect(getByText('Good luck!')).not.toBeNull()

    // System notifications cleanly translated
    expect(getByText('di2aco se ha conectado')).not.toBeNull()
    expect(getByText('cardzigger ha perdido la conexión')).not.toBeNull()

    // Ensure no lonely colon
    expect(queryByText(':')).toBeNull()
  })

  it('toggles visibility of connection/disconnection notices', () => {
    const { getByText, queryByText } = render(<ChatBox />)

    expect(getByText('di2aco se ha conectado')).not.toBeNull()

    const toggleBtn = getByText('Avisos visibles')
    fireEvent.click(toggleBtn)

    expect(getByText('Avisos ocultos')).not.toBeNull()
    expect(queryByText('di2aco se ha conectado')).toBeNull()
    expect(queryByText('cardzigger ha perdido la conexión')).toBeNull()
    expect(getByText('Hello everyone!')).not.toBeNull()
  })

  it('sends message via sendChatMessage', () => {
    const sendSpy = vi.spyOn(cmds, 'sendChatMessage').mockResolvedValue({ type: 'result', ok: true, action: 'sendChatMessage' })
    const { getByPlaceholderText, getByText } = render(<ChatBox />)

    const input = getByPlaceholderText(/Mensaje/)
    fireEvent.change(input, { target: { value: 'Testing message' } })

    const sendBtn = getByText('Enviar')
    fireEvent.click(sendBtn)

    expect(sendSpy).toHaveBeenCalledWith('chat-123', 'Testing message')
  })

  it('formatea eventos de preparación [NEXUS_READY] y [NEXUS_NOT_READY] como avisos de sistema', () => {
    setState({
      chatMessages: [
        { chatId: 'chat-123', username: 'Alice', message: '[NEXUS_READY] Alice' },
        { chatId: 'chat-123', username: 'Bob', message: '[NEXUS_NOT_READY] Bob' },
      ],
      roomChatId: 'chat-123',
    })
    const { getByText } = render(<ChatBox />)

    expect(getByText(/Alice está listo para jugar\./i)).not.toBeNull()
    expect(getByText(/Bob aún no está listo/i)).not.toBeNull()
  })

  it('muestra la hora de cada mensaje y resalta los propios (U5-2/U5-4)', () => {
    setState({
      conn: { username: 'Alice' } as never,
      chatMessages: [
        { chatId: 'chat-123', username: 'Alice', message: 'mío', time: new Date(2026, 8, 7, 10, 5).getTime() },
        { chatId: 'chat-123', username: 'Bob', message: 'ajeno', time: new Date(2026, 8, 7, 10, 6).getTime() },
      ],
      roomChatId: 'chat-123',
    })
    const { container } = render(<ChatBox />)
    const times = container.querySelectorAll('.chat-time')
    expect(times.length).toBe(2)
    expect(times[0].textContent).toMatch(/\d{1,2}:\d{2}/)
    const own = container.querySelectorAll('.user-msg.own-msg')
    expect(own.length).toBe(1)
    expect(own[0].textContent).toContain('mío')
  })

  it('bloquea el envío de más de 500 caracteres con aviso (U5-3)', () => {
    const sendSpy = vi.spyOn(cmds, 'sendChatMessage').mockResolvedValue({ type: 'result', ok: true, action: 'sendChatMessage' })
    const { getByPlaceholderText, getByText, queryByText } = render(<ChatBox />)
    fireEvent.change(getByPlaceholderText(/Mensaje/), { target: { value: 'x'.repeat(MAX_CHAT_MESSAGE_SIZE + 1) } })
    fireEvent.click(getByText('Enviar'))
    expect(sendSpy).not.toHaveBeenCalled()
    expect(queryByText(/demasiado largo|too long/i)).not.toBeNull()
  })

  it('formatChatTime devuelve hora corta HH:MM', () => {
    expect(formatChatTime(new Date(2026, 8, 7, 9, 4).getTime())).toMatch(/0?9:04/)
    expect(formatChatTime()).toMatch(/\d{1,2}:\d{2}/)
  })
})
