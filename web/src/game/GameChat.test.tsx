import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import GameChat, { isGameChatEntry } from './GameChat'
import { DrawerHeadSlotContext } from './drawerHeadSlot'
import { setState, type LogEntry } from '../state/store'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

function line(id: number, from: string, text: string): LogEntry {
  return { id, time: Date.now(), from, text, channel: 'chat' }
}

function seatedGame() {
  return makeGameView({
    players: [
      makePlayer({ playerId: 'a', name: 'Adam', controlled: true }),
      makePlayer({ playerId: 'm', name: 'Mira' }),
      makePlayer({ playerId: 't', name: 'Tobias' }),
    ],
  })
}

function entryOf(container: HTMLElement, from: string): HTMLElement {
  const name = Array.from(container.querySelectorAll<HTMLElement>('.game-chat-player')).find((el) => el.textContent === from)
  const entry = name?.closest<HTMLElement>('.game-chat-entry')
  if (!entry) throw new Error(`no chat entry from ${from}`)
  return entry
}

describe('isGameChatEntry (AUDIT)', () => {
  it('filtra por canal cuando existe', () => {
    expect(isGameChatEntry({ channel: 'chat', from: 'Bob' })).toBe(true)
    expect(isGameChatEntry({ channel: 'game', from: 'Bob' })).toBe(false)
    expect(isGameChatEntry({ channel: 'system', from: 'Bob' })).toBe(false)
  })

  it('excluye remitentes de sistema legacy sin canal, sin importar mayúsculas', () => {
    for (const from of ['partida', 'servidor', 'error', 'mesa', 'tú', 'torneo', 'replay', 'Torneo', 'SERVIDOR']) {
      expect(isGameChatEntry({ from })).toBe(false)
    }
  })

  it('conserva mensajes de jugadores legacy sin canal', () => {
    expect(isGameChatEntry({ from: 'Bob' })).toBe(true)
    expect(isGameChatEntry({ from: 'qa-ui-1345' })).toBe(true)
  })

  it('descarta entradas vacías', () => {
    expect(isGameChatEntry({})).toBe(false)
    expect(isGameChatEntry({ from: '' })).toBe(false)
  })
})

describe('GameChat bubbles', () => {
  beforeEach(() => {
    setState({ game: seatedGame() as never, conn: { username: 'Adam' } as never })
  })
  afterEach(() => {
    cleanup()
    setState({ game: null, log: [], conn: null as never })
  })

  it('PNL-4: each message is a bubble under its sender name and time, with the text inside it', () => {
    setState({ log: [line(1, 'Mira', 'Nice play, Tobias')] })
    const { container } = render(<GameChat />)
    const entry = entryOf(container, 'Mira')
    expect(entry.querySelector('.game-chat-head .game-chat-time')?.textContent).toBeTruthy()
    expect(entry.querySelector('.game-chat-head + .game-chat-bubble')?.textContent).toContain('Nice play, Tobias')
  })

  it('PNL-4: my messages carry own-msg and the other players stay on the left', () => {
    setState({ log: [line(1, 'Adam', 'gg'), line(2, 'Mira', 'hi')] })
    const { container } = render(<GameChat />)
    expect(entryOf(container, 'Adam').classList.contains('own-msg')).toBe(true)
    expect(entryOf(container, 'Mira').classList.contains('own-msg')).toBe(false)
  })

  it('PNL-4: the own sender matches case-insensitively', () => {
    setState({ log: [line(1, 'adam', 'lower case me')] })
    const { container } = render(<GameChat />)
    expect(container.querySelector('.game-chat-entry')?.classList.contains('own-msg')).toBe(true)
  })

  it('PNL-4: the lobby switch moves into the drawer head slot and stays inline without one', () => {
    const slot = document.createElement('div')
    document.body.appendChild(slot)
    const inSlot = render(
      <DrawerHeadSlotContext.Provider value={slot}>
        <GameChat />
      </DrawerHeadSlotContext.Provider>,
    )
    expect(slot.querySelector('.game-chat-lobby [role="switch"]')).not.toBeNull()
    expect(inSlot.container.querySelector('.game-chat-filter')).toBeNull()
    inSlot.unmount()
    slot.remove()

    const inline = render(<GameChat />)
    expect(inline.container.querySelector('.game-chat-filter [role="switch"]')).not.toBeNull()
  })

  it('PNL-2: a sender name takes the seat colour of that player', () => {
    setState({ log: [line(1, 'Adam', 'a'), line(2, 'Mira', 'b'), line(3, 'Tobias', 'c')] })
    const { container } = render(<GameChat />)
    const colour = (from: string) => entryOf(container, from).style.getPropertyValue('--seat')
    expect(colour('Adam')).toBe('var(--seat-0)')
    expect(colour('Mira')).toBe('var(--seat-1)')
    expect(colour('Tobias')).toBe('var(--seat-2)')
  })

  it('PNL-2: two different players never share a colour, and a non-player sender uses the neutral colour', () => {
    setState({ log: [line(1, 'Mira', 'x'), line(2, 'Tobias', 'y'), line(3, 'Spectator', 'z')] })
    const { container } = render(<GameChat />)
    const mira = entryOf(container, 'Mira').style.getPropertyValue('--seat')
    const tobias = entryOf(container, 'Tobias').style.getPropertyValue('--seat')
    expect(mira).not.toBe(tobias)
    expect(entryOf(container, 'Spectator').style.getPropertyValue('--seat')).toBe('var(--fg-2)')
  })
})
