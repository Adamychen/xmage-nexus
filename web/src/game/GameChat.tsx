import { useState, useRef, useEffect, useMemo, useCallback, useContext } from 'react'
import { createPortal } from 'react-dom'
import IconButton from '../ui/IconButton'
import EmptyState from '../ui/EmptyState'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import Toggle, { Switch } from '../ui/Toggle'
import QuickReactions from './QuickReactions'
import FormattedText from './FormattedText'
import FloatingCardPreview from '../board/FloatingCardPreview'
import { formatChatTime } from '../lobby/ChatBox'
import { seatColorVar, seatIndexOf } from '../board/seatColor'
import { DrawerHeadSlotContext } from './drawerHeadSlot'
import type { CardView } from '../net/types'
import { useTranslation } from '../i18n'
import './GameChat.css'

// System senders at the code level (addLog and the event handlers write them, not the UI locale):
// they are never player chat messages. Includes 'torneo'/'replay', which used to slip into the Chat tab.
const SYSTEM_SENDERS = new Set(['partida', 'servidor', 'error', 'conexión', 'mesa', 'tú', 'torneo', 'replay'])

// Short emoji set for the chat picker (the 😊 icon left of the input, spec section 61.3).
// It is not a full picker: the emojis most used in a game are enough.
const EMOJI_PICKS = ['😊', '😂', '😮', '👀', '🙏', '😅', '🤔', '🔥']

export function isGameChatEntry(e: { channel?: string | null; from?: string | null }): boolean {
  if (e.channel === 'chat') return true
  if (e.channel) return false
  // Legacy entries without a channel: keep everything that does not come from a known system
  // sender (case-insensitive comparison: nicks are case-sensitive, but system senders are not).
  return !!e.from && !SYSTEM_SENDERS.has(e.from.toLowerCase())
}

const LOBBY_PREF_KEY = 'nexus.gameChat.showLobby'
const NEUTRAL_SENDER = 'var(--fg-2)'

function loadShowLobby(): boolean {
  try { return localStorage.getItem(LOBBY_PREF_KEY) === '1' } catch { return false }
}

export default function GameChat() {
  const { t } = useTranslation()
  const myName = useStore((s) => s.conn?.username)
  const gameChatId = useStore((s) => s.gameChatId)
  const roomChatId = useStore((s) => s.roomChatId)
  const log = useStore((s) => s.log)
  const players = useStore((s) => s.game?.players)
  const headSlot = useContext(DrawerHeadSlotContext)
  const [showLobby, setShowLobby] = useState(loadShowLobby)
  const [input, setInput] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const chatId = gameChatId || roomChatId

  const handleHover = useCallback((card: CardView | null, rect?: DOMRect) => {
    setHoverCard(card)
    setHoverRect(rect ?? null)
  }, [])

  const seatColorOf = useCallback((from: string | null | undefined) => {
    if (!from) return NEUTRAL_SENDER
    const key = from.toLowerCase()
    const player = players?.find((p) => p.name.toLowerCase() === key)
    return player ? seatColorVar(seatIndexOf(players, player.playerId)) : NEUTRAL_SENDER
  }, [players])

  // Only show real player/user chat messages in the Chat tab (not engine inform
  // lines, lobby join/leave, or game-log lines — those are routed to other channels).
  const chatEntries = useMemo(() => {
    const mine = myName?.toLowerCase()
    return log.filter((e) => isGameChatEntry(e) && (showLobby || !e.fromRoom || (!!mine && e.from?.toLowerCase() === mine)))
  }, [log, showLobby, myName])

  const toggleLobby = (next: boolean) => {
    setShowLobby(next)
    try { localStorage.setItem(LOBBY_PREF_KEY, next ? '1' : '0') } catch {}
  }

  useEffect(() => {
    const box = endRef.current?.parentElement
    if (box && typeof box.scrollTo === 'function') box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
  }, [chatEntries.length])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !chatId) return
    await cmds.sendChatMessage(chatId, text)
    setInput('')
  }

  const insertEmoji = (emoji: string) => {
    setInput((v) => `${v}${emoji} `)
    setPickerOpen(false)
    inputRef.current?.focus()
  }

  const lobbySwitch = (
    <label className="game-chat-lobby" title={t('game', 'chat_show_lobby_hint')}>
      <span className="game-chat-lobby-label">{t('game', 'chat_lobby_short')}</span>
      <Switch checked={showLobby} onChange={toggleLobby} />
    </label>
  )

  return (
    <div className="game-chat">
      {headSlot ? createPortal(lobbySwitch, headSlot) : (
        <div className="game-chat-filter">
          <Toggle label={t('game', 'chat_show_lobby')} title={t('game', 'chat_show_lobby_hint')}
            checked={showLobby} onChange={toggleLobby} />
        </div>
      )}
      <div className="game-chat-messages">
        {chatEntries.length === 0 ? (
          <EmptyState fill italic icon="chat" iconSize={16}>{t('game', 'chat_empty')}</EmptyState>
        ) : (
          chatEntries.map((entry) => {
            const own = !!myName && !!entry.from && entry.from.toLowerCase() === myName.toLowerCase()
            return (
              <div key={entry.id} className={`game-chat-entry${own ? ' own-msg' : ''}`}
                style={{ ['--seat' as string]: seatColorOf(entry.from) }}>
                <div className="game-chat-head">
                  {entry.from && <span className="game-chat-player">{entry.from}</span>}
                  <span className="game-chat-time">{formatChatTime(entry.time)}</span>
                </div>
                <div className="game-chat-bubble">
                  <FormattedText text={entry.text} onHover={handleHover} />
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Floating Card Preview when hovering over card names in chat */}
      <FloatingCardPreview
        card={hoverCard}
        anchorRect={hoverRect}
        fixedSide="left"
      />

      <form className="game-chat-input" onSubmit={send}>
        <div className="game-chat-emoji-wrap">
          <IconButton label={t('game', 'insert_emoji')} icon="smile" variant="ghost"
            onClick={() => setPickerOpen((v) => !v)} />
          {pickerOpen && (
            <div className="game-chat-emoji-picker">
              {EMOJI_PICKS.map((emoji) => (
                <button type="button" key={emoji} onClick={() => insertEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('game', 'chat_placeholder')}
          maxLength={500}
        />
        <IconButton label={t('game', 'chat_send')} variant="primary" size="lg" type="submit" disabled={!input.trim() || !chatId}>▸</IconButton>
      </form>

      <QuickReactions />
    </div>
  )
}
