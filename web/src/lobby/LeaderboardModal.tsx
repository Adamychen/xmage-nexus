import { useState, useMemo } from 'react'
import type { UsersView } from '../net/types'
import { getRankInfo, RANK_TIERS_CONFIG } from './ranking'
import { getIgnoredUsers, removeIgnoredUser } from './ignoreList'
import { appendLocalChatMessage } from '../state/store'
import RankBadge from './RankBadge'
import CountryFlag from './CountryFlag'
import AvatarImage from './AvatarImage'
import PingBadge from './PingBadge'
import { useTranslation } from '../i18n'
import './LeaderboardModal.css'

interface LeaderboardModalProps {
  users: UsersView[]
  currentUsername: string
  initialTargetUsername?: string
  initialTab?: LeaderboardTab
  onClose: () => void
}

type LeaderboardTab = 'room' | 'profile' | 'tiers'

export default function LeaderboardModal({
  users,
  currentUsername,
  initialTargetUsername,
  initialTab = 'room',
  onClose,
}: LeaderboardModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<LeaderboardTab>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [targetUsername, setTargetUsername] = useState<string>(initialTargetUsername ?? currentUsername)
  const [ignoredList, setIgnoredList] = useState<string[]>(() => getIgnoredUsers())

  const handleUnignoreFromProfile = (username: string) => {
    const res = removeIgnoredUser(username)
    setIgnoredList(getIgnoredUsers())
    appendLocalChatMessage(res.message)
  }

  // Current user's stats
  const currentUser = useMemo(() => {
    return users.find((u) => u.userName.toLowerCase() === currentUsername.toLowerCase())
  }, [users, currentUsername])

  // Inspected user's stats
  const targetUser = useMemo(() => {
    return (
      users.find((u) => u.userName.toLowerCase() === targetUsername.toLowerCase()) ??
      currentUser
    )
  }, [users, targetUsername, currentUser])

  const isMyProfile = (targetUser?.userName ?? '').toLowerCase() === currentUsername.toLowerCase()

  const displayedElo = targetUser?.constructedRating ?? 1500
  const displayedRank = getRankInfo(displayedElo)

  // Compute wins / losses and winrate for user
  const parseStats = (historyStr?: string | null, elo?: number) => {
    if (!historyStr || historyStr === '0' || historyStr === '0-0') {
      return { wins: 0, losses: 0, total: 0, winrate: null, formattedHistory: '0-0' }
    }
    // W-L format like "12-4"
    const wlMatch = historyStr.match(/(\d+)\s*-\s*(\d+)/)
    if (wlMatch) {
      const wins = parseInt(wlMatch[1], 10)
      const losses = parseInt(wlMatch[2], 10)
      const total = wins + losses
      const winrate = total > 0 ? Math.round((wins / total) * 100) : null
      return { wins, losses, total, winrate, formattedHistory: `${wins}-${losses}` }
    }
    // Number format like "12" or "12 (Q:1)"
    const numMatch = historyStr.match(/^(\d+)/)
    if (numMatch) {
      const totalMatches = parseInt(numMatch[1], 10)
      if (totalMatches === 0) {
        return { wins: 0, losses: 0, total: 0, winrate: null, formattedHistory: '0-0' }
      }
      const effectiveElo = elo && elo > 0 ? elo : 1500
      const winProb = 1 / (1 + Math.pow(10, (1500 - effectiveElo) / 400))
      const wins = Math.round(totalMatches * winProb)
      const losses = Math.max(0, totalMatches - wins)
      const winrate = Math.round(winProb * 100)
      return {
        wins,
        losses,
        total: totalMatches,
        winrate,
        formattedHistory: `${wins}-${losses}`,
      }
    }
    return { wins: 0, losses: 0, total: 0, winrate: null, formattedHistory: historyStr }
  }

  const displayedStats = parseStats(targetUser?.matchHistory, displayedElo)

  // Sorted room leaderboard
  const sortedUsers = useMemo(() => {
    const list = [...users].map((u) => {
      const effectiveRating = u.constructedRating > 0 ? u.constructedRating : 1500
      const stats = parseStats(u.matchHistory, effectiveRating)
      return {
        ...u,
        effectiveRating,
        stats,
      }
    })

    // Sort by ELO descending, then by winrate descending
    list.sort((a, b) => {
      if (b.effectiveRating !== a.effectiveRating) {
        return b.effectiveRating - a.effectiveRating
      }
      return (b.stats.winrate ?? 0) - (a.stats.winrate ?? 0)
    })

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return list.filter((u) => u.userName.toLowerCase().includes(q))
    }

    return list
  }, [users, searchQuery])

  return (
    <div className="feedback-backdrop leaderboard-backdrop" role="presentation" onClick={onClose}>
      <section
        className="feedback-dialog leaderboard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lb-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="leaderboard-header">
          <div className="leaderboard-header-title">
            <h2 id="lb-modal-title">🏆 {t('lobby', 'nav_ranking')}</h2>
            <span className="leaderboard-subtitle">
              XMage Nexus Competitive Elo & Leaderboard
            </span>
          </div>
          <button type="button" className="leaderboard-close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        {/* Modal Tabs */}
        <nav className="leaderboard-tabs">
          <button
            type="button"
            className={`leaderboard-tab-btn ${activeTab === 'room' ? 'active' : ''}`}
            onClick={() => setActiveTab('room')}
          >
            <span>🏆 {t('lobby', 'leaderboard_top_room')} ({users.length})</span>
          </button>
          <button
            type="button"
            className={`leaderboard-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span>
              {isMyProfile
                ? `👤 ${t('lobby', 'leaderboard_my_profile')}`
                : `👤 ${t('lobby', 'leaderboard_profile_of')}: ${targetUser?.userName ?? targetUsername}`}
            </span>
          </button>
          <button
            type="button"
            className={`leaderboard-tab-btn ${activeTab === 'tiers' ? 'active' : ''}`}
            onClick={() => setActiveTab('tiers')}
          >
            <span>📖 {t('lobby', 'leaderboard_rank_guide')}</span>
          </button>
        </nav>

        {/* Tab Content */}
        <div className="leaderboard-body">
          {activeTab === 'room' && (
            <div className="leaderboard-tab-content">
              <div className="leaderboard-search-bar">
                <input
                  type="text"
                  placeholder={t('lobby', 'leaderboard_search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="leaderboard-table-wrap">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50, textAlign: 'center' }}>{t('lobby', 'leaderboard_col_pos')}</th>
                      <th>{t('lobby', 'leaderboard_col_player')}</th>
                      <th>{t('lobby', 'leaderboard_col_tier')}</th>
                      <th style={{ textAlign: 'center' }}>{t('lobby', 'leaderboard_col_elo')}</th>
                      <th style={{ textAlign: 'center' }}>{t('lobby', 'leaderboard_col_history')}</th>
                      <th style={{ textAlign: 'center' }}>{t('lobby', 'leaderboard_col_winrate')}</th>
                      <th>{t('lobby', 'leaderboard_col_status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((u, index) => {
                      const isMe = u.userName.toLowerCase() === currentUsername.toLowerCase()
                      const pos = index + 1
                      const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : null

                      return (
                        <tr
                          key={u.userName}
                          className={`leaderboard-row ${isMe ? 'is-me' : ''}`}
                          onClick={() => {
                            setTargetUsername(u.userName)
                            setActiveTab('profile')
                          }}
                          style={{ cursor: 'pointer' }}
                          title={`${t('lobby', 'view_profile_hint')} ${u.userName}`}
                        >
                          <td className="pos-cell">
                            {medal ? <span className="pos-medal">{medal}</span> : `#${pos}`}
                          </td>
                          <td className="user-cell">
                            <div className="user-cell-wrap">
                              <AvatarImage avatarId={u.avatarId} username={u.userName} size="small" />
                              <CountryFlag flagName={u.flagName} />
                              <span className="leaderboard-user-name">
                                {u.userName}
                                {isMe && <span className="me-badge">{t('game', 'you')}</span>}
                              </span>
                              {u.infoPing && <PingBadge infoPing={u.infoPing} compact />}
                            </div>
                          </td>
                          <td>
                            <RankBadge elo={u.effectiveRating} />
                          </td>
                          <td className="elo-cell">⭐ {u.effectiveRating}</td>
                          <td className="history-cell">{u.stats.formattedHistory}</td>
                          <td className="winrate-cell">
                            {u.stats.winrate !== null ? (
                              <div className="winrate-bar-container">
                                <span className="winrate-text">{u.stats.winrate}%</span>
                                <div className="winrate-mini-track">
                                  <div
                                    className="winrate-mini-fill"
                                    style={{ width: `${u.stats.winrate}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="winrate-na" title={t('lobby', 'leaderboard_no_games_hint')}>—</span>
                            )}
                          </td>
                          <td>
                            {u.infoGames ? (
                              <span className="status-playing">⚔️ {t('lobby', 'in_game')}</span>
                            ) : (
                              <span className="status-idle">{t('lobby', 'in_lobby')}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}

                    {sortedUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="leaderboard-empty-cell">
                          {t('lobby', 'leaderboard_no_results')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="leaderboard-tab-content profile-tab-content">
              {!isMyProfile && (
                <div className="profile-inspect-banner">
                  <span>
                    {t('lobby', 'leaderboard_inspecting', { username: targetUser?.userName ?? '' })}
                  </span>
                  <button
                    type="button"
                    className="profile-back-my-btn"
                    onClick={() => setTargetUsername(currentUsername)}
                  >
                    👤 {t('lobby', 'leaderboard_view_own')}
                  </button>
                </div>
              )}

              <div className="profile-rank-card" style={{ borderColor: displayedRank.border }}>
                <div className="profile-rank-header">
                  <AvatarImage
                    avatarId={targetUser?.avatarId ?? 10}
                    username={targetUser?.userName ?? ''}
                    size="huge"
                  />
                  <div className="profile-rank-title-col">
                    <div className="profile-rank-name-row">
                      {targetUser?.flagName && <CountryFlag flagName={targetUser.flagName} />}
                      <h3 className="profile-rank-username">{targetUser?.userName}</h3>
                      {isMyProfile && <span className="me-badge">{t('game', 'you')}</span>}
                      {targetUser?.infoPing && <PingBadge infoPing={targetUser.infoPing} compact />}
                    </div>
                    <span className="profile-rank-tier" style={{ color: displayedRank.color }}>
                      {displayedRank.label}
                    </span>
                    <span className="profile-rank-elo">⭐ {t('lobby', 'leaderboard_official_elo', { elo: String(displayedElo) })}</span>
                    <span className="profile-rank-desc">
                      {t('lobby', 'leaderboard_ranked_desc')}
                    </span>
                  </div>
                </div>

                {/* Progress to Next Tier */}
                {displayedRank.nextTierName && (
                  <div className="profile-progress-box">
                    <div className="progress-labels">
                      <span>{t('lobby', 'leaderboard_progress_to', { tier: displayedRank.nextTierName })}</span>
                      <span className="progress-value">
                        {t('lobby', 'leaderboard_progress_value', { elo: String(displayedElo), next: String(displayedRank.nextTierMinElo), percent: String(displayedRank.progressPercent) })}
                      </span>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${displayedRank.progressPercent}%`,
                          backgroundColor: displayedRank.color,
                        }}
                      />
                    </div>
                  </div>
                )}
                {!displayedRank.nextTierName && (
                  <div className="profile-mythic-badge">
                    <span>{t('lobby','leaderboard_col_tier')} {t('lobby', 'leaderboard_mythic_badge')}</span>
                  </div>
                )}
              </div>

              {/* Formats & Secondary Ratings Grid */}
              <div className="profile-formats-grid">
                <div className="format-card">
                  <div className="format-card-header">
                    <span className="format-icon">⭐</span>
                    <span className="format-title">{t('lobby', 'leaderboard_format_constructed')}</span>
                  </div>
                  <div className="format-card-body">
                    <span className="format-elo">{displayedElo} ELO</span>
                    <span className="format-tier" style={{ color: displayedRank.color }}>
                      {displayedRank.label}
                    </span>
                  </div>
                </div>

                <div className="format-card">
                  <div className="format-card-header">
                    <span className="format-icon">🎲</span>
                    <span className="format-title">{t('lobby', 'leaderboard_format_limited')}</span>
                  </div>
                  <div className="format-card-body">
                    <span className="format-elo">
                      {targetUser?.limitedRating && targetUser.limitedRating > 0
                        ? targetUser.limitedRating
                        : 1500}{' '}
                      ELO
                    </span>
                    <span
                      className="format-tier"
                      style={{
                        color: getRankInfo(
                          targetUser?.limitedRating && targetUser.limitedRating > 0
                            ? targetUser.limitedRating
                            : 1500,
                        ).color,
                      }}
                    >
                      {
                        getRankInfo(
                          targetUser?.limitedRating && targetUser.limitedRating > 0
                            ? targetUser.limitedRating
                            : 1500,
                        ).label
                      }
                    </span>
                  </div>
                </div>

                <div className="format-card">
                  <div className="format-card-header">
                    <span className="format-icon">🏆</span>
                    <span className="format-title">{t('lobby', 'leaderboard_tournaments_played')}</span>
                  </div>
                  <div className="format-card-body">
                    <span className="format-elo">
                      {targetUser?.tourneyHistory && targetUser.tourneyHistory !== '0'
                        ? targetUser.tourneyHistory
                        : '0'}
                    </span>
                    <span className="format-tier text-muted">
                      {targetUser?.tourneyQuitRatio
                        ? `${targetUser.tourneyQuitRatio}% aband.`
                        : '0% aband.'}
                    </span>
                  </div>
                </div>

                <div className="format-card">
                  <div className="format-card-header">
                    <span className="format-icon">🛡️</span>
                    <span className="format-title">{t('lobby', 'leaderboard_fair_play')}</span>
                  </div>
                  <div className="format-card-body">
                    <span className="format-elo text-green">
                      {Math.max(0, 100 - (targetUser?.matchQuitRatio ?? 0))}%
                    </span>
                    <span className="format-tier text-muted">
                      {targetUser?.matchQuitRatio
                        ? `${targetUser.matchQuitRatio}% aband.`
                        : '100% fiable'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Player Stats Grid */}
              <div className="profile-stats-grid">
                <div className="stat-card">
                  <span className="stat-value">{displayedStats.total}</span>
                  <span className="stat-label">{t('lobby', 'leaderboard_stat_total')}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value text-green">{displayedStats.wins}</span>
                  <span className="stat-label">{t('lobby', 'leaderboard_stat_wins')}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value text-red">{displayedStats.losses}</span>
                  <span className="stat-label">{t('lobby', 'leaderboard_stat_losses')}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value text-gold">
                    {displayedStats.winrate !== null ? `${displayedStats.winrate}%` : '—'}
                  </span>
                  <span className="stat-label">{t('lobby', 'leaderboard_stat_winrate')}</span>
                </div>
              </div>

              {/* Ignored Users Management (My Profile Only) */}
              {isMyProfile && (
                <div className="profile-ignored-box">
                  <div className="profile-ignored-header">
                    <h4>🚫 {t('lobby', 'leaderboard_ignored_title', { count: String(ignoredList.length) })}</h4>
                    <span className="profile-ignored-hint">
                      {t('lobby', 'leaderboard_ignored_hint')}
                    </span>
                  </div>
                  {ignoredList.length > 0 ? (
                    <div className="profile-ignored-list">
                      {ignoredList.map((name) => (
                        <div key={name} className="profile-ignored-item">
                          <span className="ignored-item-name">🚫 {name}</span>
                          <button
                            type="button"
                            className="unignore-action-btn"
                            onClick={() => handleUnignoreFromProfile(name)}
                            title={t('lobby', 'leaderboard_unblock') + ' ' + name}
                          >
                            🔓 {t('lobby', 'leaderboard_unblock')}
                          </button>
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
          )}

          {activeTab === 'tiers' && (
            <div className="leaderboard-tab-content">
              <div className="tiers-ladder-grid">
                {RANK_TIERS_CONFIG.map((tier) => (
                  <div
                    key={tier.tier}
                    className="tier-ladder-card"
                    style={{ borderColor: tier.border }}
                  >
                    <div className="tier-card-header">
                      <span className="tier-icon">{tier.icon}</span>
                      <span className="tier-name" style={{ color: tier.color }}>
                        {tier.name}
                      </span>
                    </div>
                    <div className="tier-elo-range">
                      {tier.tier === 'MYTHIC'
                        ? '≥ 2000 ELO'
                        : `${tier.minElo} – ${tier.maxElo} ELO`}
                    </div>
                    <p className="tier-desc">
                      {tier.tier === 'BRONZE' && t('lobby', 'tier_bronze_desc')}
                      {tier.tier === 'SILVER' && t('lobby', 'tier_silver_desc')}
                      {tier.tier === 'GOLD' && t('lobby', 'tier_gold_desc')}
                      {tier.tier === 'PLATINUM' && t('lobby', 'tier_platinum_desc')}
                      {tier.tier === 'DIAMOND' && t('lobby', 'tier_diamond_desc')}
                      {tier.tier === 'MYTHIC' && t('lobby', 'tier_mythic_desc')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
