import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as cmds from '../net/commands'
import { useStore, appendLocalChatMessage } from '../state/store'
import FormattedText from '../game/FormattedText'
import FloatingCardPreview from '../board/FloatingCardPreview'
import { handleIgnoreCommand, isUserIgnored } from './ignoreList'
import Icon, { type IconName } from '../ui/Icon'
import type { CardView, ChatMessageEvent } from '../net/types'
import { useTranslation, getLanguage, toBcp47Locale, type SupportedLanguage } from '../i18n'
import './ChatBox.css'
import Button from '../ui/Button'

export interface ReadyMarker {
  ready: boolean
  user?: string
}

/**
 * El marcador de listo SOLO cuenta anclado al inicio del mensaje (variantes de
 * mayúsculas y espacios dentro de los corchetes incluidas). Un texto cualquiera
 * que contenga el tag a mitad NO es una señal — mismo criterio en
 * `SpectatorStagingScreen` y en `ChatBox`.
 */
export function parseReadyMarker(text: string): ReadyMarker | null {
  const match = /^\s*\[\s*NEXUS_(NOT_)?READY\s*\]\s*(.*)$/i.exec(text)
  if (!match) return null
  const user = match[2].trim()
  return { ready: !match[1], user: user || undefined }
}

function readyMarkerOf(m: ChatMessageEvent): ReadyMarker | null {
  const marker = parseReadyMarker(m.message ?? '')
  if (!marker) return null
  if (marker.user && m.username && marker.user.toLowerCase() !== m.username.toLowerCase()) return null
  return marker
}

function parseSystemEvent(text: string, t: (cat: any, key: any) => string): { icon: IconName; text: string } {
  const marker = parseReadyMarker(text)
  if (marker) {
    return {
      icon: marker.ready ? 'userCheck' : 'clock',
      text: `${marker.user ?? ''} ${t('lobby', marker.ready ? 'staging_chat_ready' : 'staging_chat_not_ready')}`.trim(),
    }
  }
  if (text.includes('has joined')) {
    const user = text.replace(/\s+has joined.*$/i, '').trim()
    return { icon: 'userCheck', text: `${user} ${t('lobby', 'user_joined')}` }
  }
  if (text.includes('has lost connection')) {
    const user = text.replace(/\s+has lost connection.*$/i, '').trim()
    return { icon: 'error', text: `${user} ${t('lobby', 'user_lost_connection')}` }
  }
  if (text.includes('has disconnected')) {
    const user = text.replace(/\s+has disconnected.*$/i, '').trim()
    return { icon: 'logout', text: `${user} ${t('lobby', 'user_disconnected')}` }
  }
  if (text.includes('has left')) {
    const user = text.replace(/\s+has left.*$/i, '').trim()
    return { icon: 'logout', text: `${user} ${t('lobby', 'user_left')}` }
  }
  return { icon: 'info', text }
}

function isSystemMessage(m: ChatMessageEvent): boolean {
  if (!m.username || m.username === 'server' || m.messageType === 'SYSTEM') return true
  if (readyMarkerOf(m)) return true
  return (
    m.message.includes('has joined') ||
    m.message.includes('has lost connection') ||
    m.message.includes('has disconnected') ||
    m.message.includes('has left')
  )
}

function isConnectionEvent(text: string): boolean {
  return (
    text.includes('has joined') ||
    text.includes('has lost connection') ||
    text.includes('has disconnected') ||
    text.includes('has left')
  )
}

export const MAX_CHAT_MESSAGE_SIZE = 500

/**
 * El estado "listo" de la sala de espera se señaliza abusando del canal de
 * chat (XMage no tiene un campo de protocolo para esto, ver
 * `SpectatorStagingScreen.handleToggleReady`): manda `[NEXUS_READY] <user>` /
 * `[NEXUS_NOT_READY] <user>` y el receptor interpreta el mensaje SOLO si el
 * marcador va anclado al inicio y, si trae usuario embebido, coincide con el
 * remitente real (`m.username`, no falsificable). Si el input de chat libre no
 * sanea esto, cualquier jugador que escriba ese texto a mano (aposta o sin
 * querer) desincroniza su propio estado de listo y su mensaje desaparece de la
 * vista de chat normal (se trata como aviso de sistema). Se sanea SOLO aquí, en
 * el texto escrito a mano — `handleToggleReady` sigue mandando el tag real.
 */
export function sanitizeOutgoingChatText(text: string): string {
  return text.replace(/\[\s*NEXUS_(NOT_)?READY\s*\]/gi, '').replace(/[ \t]{2,}/g, ' ').trim()
}

export function formatChatTime(time?: number, lang?: SupportedLanguage): string {
  try {
    return new Date(time ?? Date.now()).toLocaleTimeString(toBcp47Locale(lang ?? getLanguage()), { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

interface ChatBoxProps {
  prefill?: string
  onPrefillUsed?: () => void
  onUserClick?: (username: string) => void
  onMessage?: () => void
  /** Canal propio (p. ej. chat de mesa en staging). Por defecto, el chat de sala. */
  chatIdOverride?: string | null
}

export default function ChatBox({ prefill, onPrefillUsed, onUserClick, onMessage, chatIdOverride }: ChatBoxProps = {}) {
  const { t, lang } = useTranslation()
  const roomChatId = useStore((s) => s.roomChatId)
  const myName = useStore((s) => s.conn?.username)
  const chatId = chatIdOverride ?? roomChatId
  const messages = useStore((s) => s.chatMessages)
  const [text, setText] = useState('')
  const [hideConnections, setHideConnections] = useState(false)
  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onMessage?.()
  }, [messages.length])

  useEffect(() => {
    if (prefill) {
      setText(prefill)
      inputRef.current?.focus()
      onPrefillUsed?.()
    }
  }, [prefill, onPrefillUsed])

  const handleHover = useCallback((card: CardView | null, rect?: DOMRect) => {
    setHoverCard(card)
    setHoverRect(rect ?? null)
  }, [])

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // If message specifies a chatId that doesn't match this room chat, exclude it
      if (m.chatId && chatId && m.chatId !== chatId) return false
      if (hideConnections && isConnectionEvent(m.message)) return false
      // Filter out talk and whisper messages from ignored players
      if (m.username && isUserIgnored(m.username) && (m.messageType === 'TALK' || m.messageType === 'WHISPER_FROM')) {
        return false
      }
      return true
    })
  }, [messages, chatId, hideConnections])

  useEffect(() => {
    if (listRef.current && typeof listRef.current.scrollTo === 'function') {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight })
    }
  }, [filteredMessages])

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (text.length > MAX_CHAT_MESSAGE_SIZE) {
      appendLocalChatMessage(t('lobby', 'chat_too_long'), chatId)
      return
    }

    // Intercept client-side ignore / unignore commands
    const ignoreResult = handleIgnoreCommand(text)
    if (ignoreResult?.handled) {
      appendLocalChatMessage(ignoreResult.message, chatId)
      setText('')
      return
    }

    if (!chatId) return
    const sanitized = sanitizeOutgoingChatText(text)
    if (!sanitized) return
    void cmds.sendChatMessage(chatId, sanitized)
    setText('')
  }

  return (
    <div className="chat">
      <div className="chat-toolbar">
        <button
          type="button"
          className={`chat-toggle-btn ${hideConnections ? 'active' : ''}`}
          onClick={() => setHideConnections(!hideConnections)}
          title={hideConnections ? t('lobby', 'show_system_msgs') : t('lobby', 'hide_system_msgs')}
        >
          {hideConnections ? (<><Icon name="mute" size={12} /> {t('lobby', 'hide_system_msgs')}</>) : (<><Icon name="eye" size={12} /> {t('lobby', 'show_system_msgs')}</>)}
        </button>
      </div>

      <div className="chat-list" ref={listRef}>
        {filteredMessages.map((m, i) => {
          const sys = isSystemMessage(m)
          const isWhisper =
            m.messageType === 'WHISPER_FROM' ||
            m.messageType === 'WHISPER_TO' ||
            m.message.toLowerCase().startsWith('whisper')
          const isOwn = !!myName && !!m.username && m.username.toLowerCase() === myName.toLowerCase()

          if (sys) {
            const parsed = parseSystemEvent(m.message, t)
            return (
              <div key={i} className="chat-msg system-msg">
                <span className="chat-time">{formatChatTime(m.time, lang)}</span>
                <span className="sys-icon"><Icon name={parsed.icon} size={12} /></span>
                <span className="sys-text">
                  <FormattedText text={parsed.text} onHover={handleHover} />
                </span>
              </div>
            )
          }
          return (
            <div key={i} className={`chat-msg user-msg${isWhisper ? ' whisper-msg' : ''}${isOwn ? ' own-msg' : ''}`}>
              <span className="chat-time">{formatChatTime(m.time, lang)}</span>
              <span
                className="chat-from"
                onClick={() => onUserClick?.(m.username)}
                style={{ cursor: 'pointer' }}
                title={`${t('lobby', 'view_profile_hint')} ${m.username}`}
              >
                {m.username}:
              </span>{' '}
              <FormattedText text={m.message} onHover={handleHover} />
            </div>
          )
        })}
        {filteredMessages.length === 0 && <p className="empty">{t('lobby', 'no_messages')}</p>}
      </div>

      <FloatingCardPreview
        card={hoverCard}
        anchorRect={hoverRect}
        fixedSide="left"
      />

      <form className="chat-input" onSubmit={send}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('lobby', 'chat_input_placeholder')}
          maxLength={MAX_CHAT_MESSAGE_SIZE + 1}
        />
        <Button variant="primary" disabled={!chatId} type="submit">
          {t('common', 'send')}
        </Button>
      </form>
    </div>
  )
}
