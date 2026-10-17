import Button from '../ui/Button'
import CloseButton from '../ui/CloseButton'
import { useState, useMemo } from 'react'
import type { UsersView } from '../net/types'
import { getIgnoredUsers, removeIgnoredUser } from './ignoreList'
import { appendLocalChatMessage } from '../state/store'
import CountryFlag from './CountryFlag'
import AvatarImage from './AvatarImage'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import PingBadge from './PingBadge'
import RankBadge from './RankBadge'
import { playerRankRating } from './ranking'
import { parseMatchHistory } from './matchHistory'
import { useTranslation } from '../i18n'
import './PlayerProfileModal.css'
import './RankingView.css'

interface PlayerProfileModalProps {
  users: UsersView[]
  currentUsername: string
  targetUsername?: string
  onClose: () => void
}

export default function PlayerProfileModal({
  users,
  currentUsername,
  targetUsername,
  onClose,
}: PlayerProfileModalProps) {
  const { t } = useTranslation()
  const [viewingUsername, setViewingUsername] = useState<string>(targetUsername || currentUsername)
  const [ignoredList, setIgnoredList] = useState<string[]>(() => getIgnoredUsers())

  const handleUnignore = (username: string) => {
    const res = removeIgnoredUser(username)
    setIgnoredList(getIgnoredUsers())
    appendLocalChatMessage(res.message)
  }

  const targetUser = useMemo(() => {
    return (
      users.find((u) => u.userName.toLowerCase() === viewingUsername.toLowerCase()) ??
      users.find((u) => u.userName.toLowerCase() === currentUsername.toLowerCase())
    )
  }, [users, viewingUsername, currentUsername])

  const isMyProfile = (targetUser?.userName ?? '').toLowerCase() === currentUsername.toLowerCase()
  // One Glicko rating per format; null means unrated there (no tier, never a fake 1500).
  const constructedRating = targetUser ? playerRankRating(targetUser, false) : null
  const limitedRating = targetUser ? playerRankRating(targetUser, true) : null
  const displayedStats = parseMatchHistory(targetUser?.matchHistory)

  return (
    <DialogShell
      labelledBy="profile-modal-title"
      titleId="profile-modal-title"
      size="md"
      legacyBackdropClass="feedback-backdrop profile-backdrop"
      legacyPanelClass="profile-dialog"
      kickerIcon="user"
      kickerLabel={isMyProfile ? t('lobby', 'leaderboard_my_profile') : t('lobby', 'leaderboard_profile_of')}
      title={targetUser?.userName ?? viewingUsername}
      topRight={(
        <CloseButton variant="solid" size="lg" className="profile-close-btn" onClick={onClose} />
      )}
      onBackdropClick={onClose}
      onEscape={onClose}
    >
      <div className="profile-body">
        {!isMyProfile && (
          <div className="profile-inspect-banner">
            <span>
              {t('lobby', 'leaderboard_inspecting', { username: targetUser?.userName ?? '' })}
            </span>
            <Button variant="subtle" size="sm" onClick={() => setViewingUsername(currentUsername)}>
              <Icon name="user" size={12} /> {t('lobby', 'leaderboard_view_own')}
            </Button>
          </div>
        )}

        <div className="profile-card">
          <div className="profile-header">
            <AvatarImage
              avatarId={targetUser?.avatarId ?? 10}
              username={targetUser?.userName ?? ''}
              size="huge"
            />
            <div className="profile-identity">
              <div className="profile-name-row">
                {targetUser?.flagName && <CountryFlag flagName={targetUser.flagName} />}
                <h3 className="profile-username">{targetUser?.userName}</h3>
                {isMyProfile && <span className="me-badge">{t('game', 'you')}</span>}
                {targetUser?.infoPing && <PingBadge infoPing={targetUser.infoPing} compact />}
              </div>
              {constructedRating !== null && (
                <span className="profile-elo">
                  <Icon name="star" size={12} /> {t('lobby', 'leaderboard_official_elo', { elo: String(constructedRating) })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="profile-formats-grid">
          <div className="format-card">
            <div className="format-card-header">
              <span className="format-icon"><Icon name="star" size={13} /></span>
              <span className="format-title">{t('lobby', 'leaderboard_format_constructed')}</span>
            </div>
            <div className="format-card-body">
              <span className="format-elo">{constructedRating ?? '—'}</span>
              {constructedRating !== null && <RankBadge elo={constructedRating} />}
            </div>
          </div>

          <div className="format-card">
            <div className="format-card-header">
              <span className="format-icon"><Icon name="dice" size={13} /></span>
              <span className="format-title">{t('lobby', 'leaderboard_format_limited')}</span>
            </div>
            <div className="format-card-body">
              <span className="format-elo">{limitedRating ?? '—'}</span>
              {limitedRating !== null && <RankBadge elo={limitedRating} />}
            </div>
          </div>

          <div className="format-card">
            <div className="format-card-header">
              <span className="format-icon"><Icon name="trophy" size={13} /></span>
              <span className="format-title">{t('lobby', 'leaderboard_tournaments_played')}</span>
            </div>
            <div className="format-card-body">
              <span className="format-elo">
                {targetUser?.tourneyHistory && targetUser.tourneyHistory !== '0'
                  ? targetUser.tourneyHistory
                  : '0'}
              </span>
              <span className="format-tier text-muted">
                {t('lobby', 'leaderboard_quit_ratio', {
                  ratio: String(targetUser?.tourneyQuitRatio ?? 0),
                })}
              </span>
            </div>
          </div>

          <div className="format-card">
            <div className="format-card-header">
              <span className="format-icon"><Icon name="shield" size={13} /></span>
              <span className="format-title">{t('lobby', 'leaderboard_fair_play')}</span>
            </div>
            <div className="format-card-body">
              <span className="format-elo text-green">
                {Math.max(0, 100 - (targetUser?.matchQuitRatio ?? 0))}%
              </span>
              <span className="format-tier text-muted">
                {targetUser?.matchQuitRatio
                  ? t('lobby', 'leaderboard_quit_ratio', {
                      ratio: String(targetUser.matchQuitRatio),
                    })
                  : t('lobby', 'leaderboard_reliable')}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-stats-grid">
          <div className="stat-card">
            <span className="stat-value">{displayedStats.total}</span>
            <span className="stat-label">{t('lobby', 'leaderboard_stat_total')}</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-green">{displayedStats.wins ?? '—'}</span>
            <span className="stat-label">{t('lobby', 'leaderboard_stat_wins')}</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-red">{displayedStats.losses ?? '—'}</span>
            <span className="stat-label">{t('lobby', 'leaderboard_stat_losses')}</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-gold">
              {displayedStats.winrate !== null ? `${displayedStats.winrate}%` : '—'}
            </span>
            <span className="stat-label">{t('lobby', 'leaderboard_stat_winrate')}</span>
          </div>
        </div>

        {isMyProfile && (
          <div className="profile-ignored-box">
            <div className="profile-ignored-header">
              <h4><Icon name="ban" size={14} /> {t('lobby', 'leaderboard_ignored_title', { count: String(ignoredList.length) })}</h4>
              <span className="profile-ignored-hint">
                {t('lobby', 'leaderboard_ignored_hint')}
              </span>
            </div>
            {ignoredList.length > 0 ? (
              <div className="profile-ignored-list">
                {ignoredList.map((name) => (
                  <div key={name} className="profile-ignored-item">
                    <span className="ignored-item-name"><Icon name="ban" size={12} /> {name}</span>
                    <Button variant="subtle" size="sm"
                      onClick={() => handleUnignore(name)}
                      title={t('lobby', 'leaderboard_unblock') + ' ' + name}>
                      <Icon name="unlock" size={12} /> {t('lobby', 'leaderboard_unblock')}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="profile-ignored-empty">
                {t('lobby', 'leaderboard_no_ignored')}
              </p>
            )}
          </div>
        )}
      </div>
    </DialogShell>
  )
}
