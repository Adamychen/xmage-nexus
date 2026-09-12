import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import QuickReactions from './QuickReactions'
import FormattedText from './FormattedText'
import FloatingCardPreview from '../board/FloatingCardPreview'
import Icon from '../ui/Icon'
import { formatChatTime } from '../lobby/ChatBox'
import type { CardView } from '../net/types'
import { useTranslation } from '../i18n'
import './GameChat.css'

// Remitentes de sistema a nivel de código (los escribe addLog y los handlers de
// eventos, no el locale de la UI): nunca son mensajes de chat de jugadores.
// Incluye 'torneo'/'replay', que antes faltaban y se colaban en la pestaña Chat.
const SYSTEM_SENDERS = new Set(['partida', 'servidor', 'error', 'conexión', 'mesa', 'tú', 'torneo', 'replay'])

// Set corto para el selector de emoji del chat (icono 😊 a la izquierda del input,
// spec sección 61.3). No es un picker completo: basta con los más usados en partida.
const EMOJI_PICKS = ['😊', '😂', '😮', '👀', '🙏', '😅', '🤔', '🔥']

export function isGameChatEntry(e: { channel?: string | null; from?: string | null }): boolean {
  if (e.channel === 'chat') return true
  if (e.channel) return false
  // Entradas legacy sin canal: se queda todo lo que no venga de un remitente
  // de sistema conocido (comparación insensible a mayúsculas: los nicks sí importan).
  return !!e.from && !SYSTEM_SENDERS.has(e.from.toLowerCase())
}

export default function GameChat() {
  const { t } = useTranslation()
  const myName = useStore((s) => s.conn?.username)
  const gameChatId = useStore((s) => s.gameChatId)
  const roomChatId = useStore((s) => s.roomChatId)
  const log = useStore((s) => s.log)
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

  // Only show real player/user chat messages in the Chat tab (not engine inform
  // lines, lobby join/leave, or game-log lines — those are routed to other channels).
  const chatEntries = useMemo(() => {
    return log.filter((e) => isGameChatEntry(e))
  }, [log])

  useEffect(() => {
    if (endRef.current && typeof endRef.current.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
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

  return (
    <div className="game-chat">
      <div className="game-chat-messages">
        {chatEntries.length === 0 ? (
          <div className="game-chat-empty">
            <Icon name="chat" size={16} /> {t('game', 'chat_empty')}
          </div>
        ) : (
          chatEntries.map((entry) => (
            <div key={entry.id} className={`game-chat-entry${myName && entry.from && entry.from.toLowerCase() === myName.toLowerCase() ? ' own-msg' : ''}`}>
              <span className="game-chat-time">{formatChatTime(entry.time)}</span>
              {entry.from && <span className="game-chat-player">{entry.from}:</span>}
              <span className="game-chat-text">
                <FormattedText text={entry.text} onHover={handleHover} />
              </span>
            </div>
          ))
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
          <button
            type="button"
            className="game-chat-emoji-btn"
            title={t('game', 'insert_emoji')}
            onClick={() => setPickerOpen((v) => !v)}
          >
            <Icon name="smile" size={15} />
          </button>
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
        <button type="submit" className="game-chat-send" disabled={!input.trim() || !chatId} aria-label={t('game', 'chat_send')}>▸</button>
      </form>

      <QuickReactions />
    </div>
  )
}
