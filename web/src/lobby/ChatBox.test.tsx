import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatBox, { formatChatTime, MAX_CHAT_MESSAGE_SIZE, sanitizeOutgoingChatText } from './ChatBox'
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

  it('sanea el tag [NEXUS_READY]/[NEXUS_NOT_READY] escrito a mano antes de mandar el mensaje libre (no falsificable)', () => {
    const sendSpy = vi.spyOn(cmds, 'sendChatMessage').mockResolvedValue({ type: 'result', ok: true, action: 'sendChatMessage' })
    const { getByPlaceholderText, getByText } = render(<ChatBox />)

    const input = getByPlaceholderText(/Mensaje/)
    fireEvent.change(input, { target: { value: '[NEXUS_READY] hola a todos' } })
    fireEvent.click(getByText('Enviar'))

    expect(sendSpy).toHaveBeenCalledTimes(1)
    const [, sentText] = sendSpy.mock.calls[0]
    expect(sentText).not.toContain('[NEXUS_READY]')
    expect(sentText).toBe('hola a todos')
  })

  it('no manda nada si el mensaje libre es SOLO el tag saneado (queda vacío)', () => {
    const sendSpy = vi.spyOn(cmds, 'sendChatMessage').mockResolvedValue({ type: 'result', ok: true, action: 'sendChatMessage' })
    const { getByPlaceholderText, getByText } = render(<ChatBox />)

    const input = getByPlaceholderText(/Mensaje/)
    fireEvent.change(input, { target: { value: '[nexus_ready]' } })
    fireEvent.click(getByText('Enviar'))

    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('sanitizeOutgoingChatText elimina variantes de mayúsculas/espacios sin tocar texto normal', () => {
    expect(sanitizeOutgoingChatText('[NEXUS_READY] Alice')).toBe('Alice')
    expect(sanitizeOutgoingChatText('[ nexus_not_ready ] Bob')).toBe('Bob')
    expect(sanitizeOutgoingChatText('hola [algo] normal')).toBe('hola [algo] normal')
    expect(sanitizeOutgoingChatText('  espacios  ')).toBe('espacios')
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

  it('un marcador a mitad de mensaje NO se formatea como aviso de sistema', () => {
    setState({
      chatMessages: [
        { chatId: 'chat-123', username: 'Alice', message: 'hola [NEXUS_READY] Alice' },
      ],
      roomChatId: 'chat-123',
    })
    const { getByText, queryByText } = render(<ChatBox />)

    expect(getByText('Alice:')).not.toBeNull()
    expect(getByText('hola [NEXUS_READY] Alice')).not.toBeNull()
    expect(queryByText(/está listo para jugar/i)).toBeNull()
  })

  it('acepta el marcador anclado con espacios dentro de los corchetes', () => {
    setState({
      chatMessages: [
        { chatId: 'chat-123', username: 'Alice', message: '[ NEXUS_READY ] Alice' },
      ],
      roomChatId: 'chat-123',
    })
    const { getByText } = render(<ChatBox />)

    expect(getByText(/Alice está listo para jugar\./i)).not.toBeNull()
  })

  it('un marcador con usuario embebido distinto del remitente no es aviso de sistema (anti-spoof)', () => {
    setState({
      chatMessages: [
        { chatId: 'chat-123', username: 'Bob', message: '[NEXUS_NOT_READY] Alice' },
      ],
      roomChatId: 'chat-123',
    })
    const { getByText, queryByText } = render(<ChatBox />)

    expect(getByText('Bob:')).not.toBeNull()
    expect(getByText('[NEXUS_NOT_READY] Alice')).not.toBeNull()
    expect(queryByText(/aún no está listo/i)).toBeNull()
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

  it('formatChatTime usa el idioma del juego (zhs mapea a zh)', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleTimeString')
    try {
      formatChatTime(1700000000000, 'zhs')
      expect(spy).toHaveBeenCalledWith('zh', expect.anything())
      spy.mockClear()
      formatChatTime(1700000000000, 'ja')
      expect(spy).toHaveBeenCalledWith('ja', expect.anything())
    } finally {
      spy.mockRestore()
    }
  })

  it.each([
    'I think he has joined the table',
    'I think he has left the building',
    'my cat has lost connection to my wifi',
    'honestly he has disconnected, cheater',
  ])('a player writing "%s" keeps their author and text', (phrase) => {
    setState({
      chatMessages: [{ chatId: 'chat-123', username: 'Alice', message: phrase, messageType: 'TALK' }],
      roomChatId: 'chat-123',
    })
    const { container, getByText } = render(<ChatBox />)

    expect(container.querySelectorAll('.system-msg').length).toBe(0)
    expect(getByText('Alice:')).not.toBeNull()
    expect(getByText(phrase)).not.toBeNull()
  })

  it('a player with those phrases keeps their message when system notices are hidden', () => {
    setState({
      chatMessages: [
        { chatId: 'chat-123', username: 'Alice', message: 'I think he has left the building', messageType: 'TALK' },
        { chatId: 'chat-123', username: '', message: 'di2aco has left' },
      ],
      roomChatId: 'chat-123',
    })
    const { getByText, queryByText } = render(<ChatBox />)
    fireEvent.click(getByText('Avisos visibles'))

    expect(getByText('I think he has left the building')).not.toBeNull()
    expect(queryByText('di2aco has left')).toBeNull()
  })

  describe('chat history scrolling', () => {
    function fakeScrollBox(box: HTMLElement, client = 200) {
      let top = 0
      let height = 1000
      Object.defineProperties(box, {
        scrollTop: { get: () => top, set: (v: number) => { top = Math.min(v, Math.max(0, height - client)) }, configurable: true },
        scrollHeight: { get: () => height, configurable: true },
        clientHeight: { get: () => client, configurable: true },
        scrollTo: { value: (opts: { top: number }) => { box.scrollTop = opts.top }, configurable: true },
      })
      return {
        grow: (h: number) => { height = h },
        get top() { return top },
      }
    }

    const talk = (n: number) => ({ chatId: 'chat-123', username: 'Bob', message: `msg ${n}`, messageType: 'TALK' })

    it('follows the bottom when the reader is at the bottom', () => {
      setState({ chatMessages: [talk(1), talk(2), talk(3)], roomChatId: 'chat-123' })
      const { container } = render(<ChatBox />)
      const box = fakeScrollBox(container.querySelector<HTMLElement>('.chat-list')!)

      box.grow(1200)
      act(() => setState({ chatMessages: [talk(1), talk(2), talk(3), talk(4)] }))
      expect(box.top).toBe(1000)
    })

    it('does not drag a reader who scrolled up when a message arrives', () => {
      setState({ chatMessages: [talk(1), talk(2), talk(3)], roomChatId: 'chat-123' })
      const { container } = render(<ChatBox />)
      const list = container.querySelector<HTMLElement>('.chat-list')!
      const box = fakeScrollBox(list)

      box.grow(1200)
      act(() => setState({ chatMessages: [talk(1), talk(2), talk(3), talk(4)] }))
      expect(box.top).toBe(1000)

      list.scrollTop = 0
      fireEvent.scroll(list)
      box.grow(1400)
      act(() => setState({ chatMessages: [talk(1), talk(2), talk(3), talk(4), talk(5)] }))
      expect(box.top).toBe(0)
    })
  })
})
