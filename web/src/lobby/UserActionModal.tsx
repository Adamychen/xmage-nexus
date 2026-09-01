import { useState } from 'react'
import type { UsersView, TableView } from '../net/types'
import { isUserIgnored, addIgnoredUser, removeIgnoredUser } from './ignoreList'
import { appendLocalChatMessage } from '../state/store'
import RankBadge from './RankBadge'
import CountryFlag from './CountryFlag'
import AvatarImage from './AvatarImage'
import PingBadge from './PingBadge'
import { useTranslation } from '../i18n'
import './UserActionModal.css'

interface UserActionModalProps {
  user: UsersView
  currentUsername: string
  tables?: TableView[]
  onWhisper: (username: string) => void
  onViewLeaderboard: (username: string) => void
  onWatchTable?: (tableId: string) => void
  onClose: () => void
}

export default function UserActionModal({
  user,
  currentUsername,
  tables = [],
  onWhisper,
  onViewLeaderboard,
  onWatchTable,
  onClose,
}: UserActionModalProps) {
  const { t } = useTranslation()
  const [isIgnored, setIsIgnored] = useState(() => isUserIgnored(user.userName))
  const isMe = user.userName.toLowerCase() === currentUsername.toLowerCase()

  // Find table where player is currently playing, if any
  const currentTable = tables.find((t) =>
    t.seats.some((s) => s.playerName?.toLowerCase() === user.userName.toLowerCase())
  )

  const handleWhisper = () => {
    onWhisper(user.userName)
    onClose()
  }

  const handleToggleIgnore = () => {
    if (isIgnored) {
      const res = removeIgnoredUser(user.userName)
      appendLocalChatMessage(res.message)
      setIsIgnored(false)
    } else {
      const res = addIgnoredUser(user.userName)
      appendLocalChatMessage(res.message)
      setIsIgnored(true)
    }
    onClose()
  }

  const handleWatchGame = () => {
    if (currentTable && onWatchTable) {
      onWatchTable(currentTable.tableId)
      onClose()
    }
  }

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog panel user-action-dialog">
        <div className="user-action-header">
          <div className="user-action-avatar-col">
            <AvatarImage avatarId={user.avatarId} username={user.userName} size="large" />
          </div>

          <div className="user-action-identity-col">
            <div className="user-action-title-row">
              <CountryFlag flagName={user.flagName} />
              <h3 className="user-action-name">{user.userName}</h3>
              {isMe && <span className="me-badge">{t('game', 'you')}</span>}
            </div>

            <div className="user-action-badges-row">
              <RankBadge elo={user.constructedRating} compact showElo />
              {user.matchHistory && (
                <span className="user-action-history-pill">🏆 {user.matchHistory}</span>
              )}
              {user.infoPing && <PingBadge infoPing={user.infoPing} compact />}
            </div>

            <div className="user-action-status-row">
              {user.infoGames ? (
                <span className="user-status-playing">⚔️ {user.infoGames}</span>
              ) : (
                <span className="user-status-idle">🟢 {t('lobby', 'user_status_available')}</span>
              )}
            </div>
          </div>

          <button type="button" className="user-action-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Action Buttons Grid */}
        <div className="user-action-body">
          {!isMe && (
            <button type="button" className="user-action-btn primary" onClick={handleWhisper}>
              <span className="action-btn-icon">💬</span>
              <div className="action-btn-text">
                <span className="action-btn-title">{t('lobby', 'useraction_whisper')}</span>
                <span className="action-btn-desc">{t('lobby', 'useraction_whisper_hint', { username: user.userName })}</span>
              </div>
            </button>
          )}

          {currentTable && currentTable.spectatorsAllowed && onWatchTable && (
            <button type="button" className="user-action-btn spectate-btn" onClick={handleWatchGame}>
              <span className="action-btn-icon">👁️</span>
              <div className="action-btn-text">
                <span className="action-btn-title">{t('lobby', 'useraction_spectate')}</span>
                <span className="action-btn-desc">{t('lobby', 'useraction_spectate_hint', { tableName: currentTable.tableName })}</span>
              </div>
            </button>
          )}

          <button
            type="button"
            className="user-action-btn"
            onClick={() => {
              onViewLeaderboard(user.userName)
              onClose()
            }}
          >
            <span className="action-btn-icon">🏆</span>
            <div className="action-btn-text">
              <span className="action-btn-title">{t('lobby', 'useraction_profile_title')}</span>
              <span className="action-btn-desc">{t('lobby', 'useraction_profile_desc')}</span>
            </div>
          </button>

          {!isMe && (
            <button
              type="button"
              className={`user-action-btn ${isIgnored ? 'unignore-btn' : 'ignore-btn'}`}
              onClick={handleToggleIgnore}
            >
              <span className="action-btn-icon">{isIgnored ? '🔓' : '🚫'}</span>
              <div className="action-btn-text">
                <span className="action-btn-title">
                  {isIgnored ? t('lobby', 'useraction_unignore_title') : t('lobby', 'useraction_ignore_full')}
                </span>
                <span className="action-btn-desc">
                  {isIgnored
                    ? t('lobby', 'useraction_unignore_desc')
                    : t('lobby', 'useraction_ignore_desc')}
                </span>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
