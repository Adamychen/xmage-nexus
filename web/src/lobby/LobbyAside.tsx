import type { UsersView } from '../net/types'
import ChatBox from './ChatBox'
import AvatarImage from './AvatarImage'
import CountryFlag from './CountryFlag'
import RankBadge from './RankBadge'
import PingBadge from './PingBadge'
import { useTranslation } from '../i18n'
import { fallbackActionUser } from './lobbyUtils'

interface Props {
  users: UsersView[]
  chatPrefill: string
  onPrefillUsed: () => void
  unreadChat: number
  onMessageRead: () => void
  onSelectUser: (u: UsersView) => void
  mobileChatOpen: boolean
  onCloseMobile: () => void
  onOpenRoomLeaderboard: () => void
}

export default function LobbyAside({
  users, chatPrefill, onPrefillUsed, unreadChat, onMessageRead, onSelectUser,
  mobileChatOpen, onCloseMobile, onOpenRoomLeaderboard,
}: Props) {
  const { t } = useTranslation()
  return (
    <>
      {mobileChatOpen && <div className="lobby-aside-backdrop" onClick={onCloseMobile} aria-hidden="true" />}
      <aside className={`lobby-aside ${mobileChatOpen ? 'mobile-open' : ''}`}>
        <section className="aside-chat-section">
          <div className="aside-section-header">
            <span className="aside-section-title">💬 {t('lobby','global_chat')}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {unreadChat > 0 && (
                <span className="aside-unread-badge">{unreadChat > 9 ? '9+' : unreadChat}</span>
              )}
              <button type="button" className="view-leaderboard-btn" onClick={onCloseMobile} style={{ display: 'none' }} aria-hidden="true">✕</button>
            </div>
          </div>
          <div className="aside-chat-body">
            <ChatBox
              prefill={chatPrefill}
              onPrefillUsed={onPrefillUsed}
              onMessage={onMessageRead}
              onUserClick={(username) => {
                const found = users.find(
                  (u) => u.userName.toLowerCase() === username.toLowerCase(),
                )
                onSelectUser(found ?? fallbackActionUser(username))
              }}
            />
          </div>
        </section>

        <section className="aside-users-section">
          <div className="aside-section-header">
            <span className="aside-section-title">👥 {t('lobby.online_users')} ({users.length})</span>
            <button
              type="button"
              className="view-leaderboard-btn"
              onClick={onOpenRoomLeaderboard}
              title={t('lobby','nav_ranking')}
            >
              🏆
            </button>
          </div>
          <ul className="users-list aside-users-list">
            {users.map((u) => (
              <li
                key={u.userName}
                className="user-list-item interactive"
                onClick={() => onSelectUser(u)}
                style={{ cursor: 'pointer' }}
                title={`${t('lobby','view_profile_hint')} ${u.userName}`}
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
                  <span className="game-info-badge">⚔️</span>
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
        </section>
      </aside>
    </>
  )
}
