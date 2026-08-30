import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import QuickReactions from './QuickReactions'
import FormattedText from './FormattedText'
import FloatingCardPreview from '../board/FloatingCardPreview'
import type { CardView } from '../net/types'
import { useTranslation } from '../i18n'
import './GameChat.css'

// Set corto para el selector de emoji del chat (icono 😊 a la izquierda del input,
// spec sección 61.3). No es un picker completo: basta con los más usados en partida.
const EMOJI_PICKS = ['😊', '😂', '😮', '👀', '🙏', '😅', '🤔', '🔥']

export default function GameChat() {
  const { t } = useTranslation()
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
    return log.filter((e) => {
      if (e.channel === 'chat') return true
      if (e.channel) return false
      // Legacy entries without a channel: keep anything that isn't a known
      // game/system source (best-effort fallback for older sessions).
      return !!e.from && !['partida', 'servidor', 'error', 'conexión', 'mesa', 'tú'].includes(e.from)
    })
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
            💬 {t('game', 'chat_empty')}
          </div>
        ) : (
          chatEntries.map((entry) => (
            <div key={entry.id} className="game-chat-entry">
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
            😊
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
        <button type="submit" className="game-chat-send" disabled={!input.trim() || !chatId}>▸</button>
      </form>

      <QuickReactions />
    </div>
  )
}
