import { useEffect, useRef, useState } from 'react'
import type { UsersView } from '../net/types'
import ChatBox from './ChatBox'
import AvatarImage from './AvatarImage'
import CountryFlag from './CountryFlag'
import RankBadge from './RankBadge'
import PingBadge from './PingBadge'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { fallbackActionUser } from './lobbyUtils'
import './FloatingChat.css'

interface Props {
  users: UsersView[]
  chatPrefill: string
  onPrefillUsed: () => void
  unreadChat: number
  onMessageRead: () => void
  onSelectUser: (u: UsersView) => void
  onOpenRoomLeaderboard: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Pos {
  left: number
  top: number
}

const POS_KEY = 'floating_chat_pos'

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (typeof p?.left === 'number' && typeof p?.top === 'number') return p
    return null
  } catch { return null }
}

export default function FloatingChat({
  users, chatPrefill, onPrefillUsed, unreadChat, onMessageRead,
  onSelectUser, onOpenRoomLeaderboard, open, onOpenChange,
}: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'chat' | 'users'>('chat')
  const [pos, setPos] = useState<Pos | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null)

  useEffect(() => {
    const raw = loadPos()
    if (!raw || !Number.isFinite(raw.left) || !Number.isFinite(raw.top)) return
    const apply = () => {
      const el = panelRef.current
      const w = el?.offsetWidth || 360
      const h = el?.offsetHeight || 480
      setPos({
        left: Math.min(Math.max(8, raw.left), Math.max(8, window.innerWidth - w - 8)),
        top: Math.min(Math.max(8, raw.top), Math.max(8, window.innerHeight - Math.min(h, 120) - 8)),
      })
    }
    apply()
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const onResize = () => {
      setPos((prev) => {
        if (!prev) return prev
        const el = panelRef.current
        const w = el?.offsetWidth || 360
        const h = el?.offsetHeight || 480
        return {
          left: Math.min(Math.max(8, prev.left), Math.max(8, window.innerWidth - w - 8)),
          top: Math.min(Math.max(8, prev.top), Math.max(8, window.innerHeight - Math.min(h, 120) - 8)),
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (window.innerWidth <= 600) return
    const el = panelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const el = panelRef.current
    if (!drag || !el) return
    const w = el.offsetWidth || 360
    const h = el.offsetHeight || 480
    const left = Math.min(
      Math.max(8, drag.origLeft + (e.clientX - drag.startX)),
      Math.max(8, window.innerWidth - w - 8),
    )
    const top = Math.min(
      Math.max(8, drag.origTop + (e.clientY - drag.startY)),
      Math.max(8, window.innerHeight - Math.min(h, 120) - 8),
    )
    setPos({ left, top })
  }

  const endDrag = () => {
    if (dragRef.current && pos) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch {}
    } else if (dragRef.current) {
      try {
        const el = panelRef.current
        if (el) {
          const rect = el.getBoundingClientRect()
          localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }))
        }
      } catch {}
    }
    dragRef.current = null
  }

  if (!open) {
    return (
      <button
        type="button"
        className="floating-chat-fab"
        onClick={() => onOpenChange(true)}
        title={t('lobby', 'global_chat')}
        aria-label={t('lobby', 'global_chat')}
      >
        <Icon name="chat" size={18} />
        {unreadChat > 0 && (
          <span className="aside-unread-badge fab-unread">{unreadChat > 9 ? '9+' : unreadChat}</span>
        )}
      </button>
    )
  }

  return (
    <aside
      ref={panelRef}
      className="lobby-aside floating-chat"
      style={pos ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' } : undefined}
      aria-label={t('lobby', 'global_chat')}
    >
      <div
        className="floating-chat-header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="floating-chat-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chat'}
            className={`floating-tab ${tab === 'chat' ? 'active' : ''}`}
            onClick={() => setTab('chat')}
          >
            <Icon name="chat" size={13} /> {t('lobby', 'global_chat')}
            {unreadChat > 0 && (
              <span className="aside-unread-badge">{unreadChat > 9 ? '9+' : unreadChat}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            className={`floating-tab ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            <Icon name="users" size={13} /> {users.length}
          </button>
        </div>
        <div className="floating-chat-actions">
          <button
            type="button"
            className="view-leaderboard-btn"
            onClick={onOpenRoomLeaderboard}
            title={t('lobby', 'nav_ranking')}
          >
            <Icon name="trophy" size={13} />
          </button>
          <button
            type="button"
            className="floating-min-btn"
            onClick={() => onOpenChange(false)}
            title={t('common', 'close')}
            aria-label={t('common', 'close')}
          >
            <Icon name="chevronDown" size={15} />
          </button>
        </div>
      </div>

      {tab === 'chat' ? (
        <div className="aside-chat-body floating-chat-body">
          <ChatBox
            prefill={chatPrefill}
            onPrefillUsed={onPrefillUsed}
            onMessage={onMessageRead}
            onUserClick={(username) => {
              const found = users.find((u) => u.userName.toLowerCase() === username.toLowerCase())
              onSelectUser(found ?? fallbackActionUser(username))
            }}
          />
        </div>
      ) : (
        <ul className="users-list aside-users-list floating-users-list">
          {users.map((u) => (
            <li
              key={u.userName}
              className="user-list-item interactive"
              onClick={() => onSelectUser(u)}
              style={{ cursor: 'pointer' }}
              title={`${t('lobby', 'view_profile_hint')} ${u.userName}`}
            >
              <span className={`dot ${u.infoGames ? 'playing' : 'online'}`} />
              <AvatarImage avatarId={u.avatarId} username={u.userName} size="medium" />
              <div className="user-info-col">
                <div className="user-name-row">
                  {u.flagName && <CountryFlag flagName={u.flagName} className="user-list-flag" showTextFallback />}
                  <span className="user-name-text">{u.userName}</span>
                </div>
                <div className="user-name-row">
                  <RankBadge elo={u.constructedRating} compact />
                  {u.infoPing && <PingBadge infoPing={u.infoPing} compact />}
                </div>
              </div>
              {u.infoGames ? (
                <span className="game-info-badge"><Icon name="swords" size={13} /></span>
              ) : (
                <span className="lobby-idle-badge">{t('lobby.in_lobby')}</span>
              )}
            </li>
          ))}
          {users.length === 0 && (
            <li className="users-empty-item">
              <span className="empty">{t('lobby.waiting_players')}</span>
            </li>
          )}
        </ul>
      )}
    </aside>
  )
}
