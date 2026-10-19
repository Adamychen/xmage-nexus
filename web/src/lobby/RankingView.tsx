import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import Tabs from '../ui/Tabs'
import { useMemo, useState } from 'react'
import type { UsersView } from '../net/types'
import { getRankInfo, getTierName, playerRankRating, RANK_TIERS_CONFIG, type RankTier } from './ranking'
import { parseMatchHistory } from './matchHistory'
import RankBadge from './RankBadge'
import RankEmblem from './RankEmblem'
import RankingHistory from './RankingHistory'
import CountryFlag from './CountryFlag'
import AvatarImage from './AvatarImage'
import PingBadge from './PingBadge'
import { isUserInGame } from './lobbyUtils'
import { useTranslation } from '../i18n'
import './RankingView.css'

interface RankingViewProps {
  users: UsersView[]
  currentUsername: string
  onInspectUser: (username: string) => void
}

const TIER_DESC_KEYS = {
  BRONZE: 'tier_bronze_desc',
  SILVER: 'tier_silver_desc',
  GOLD: 'tier_gold_desc',
  PLATINUM: 'tier_platinum_desc',
  DIAMOND: 'tier_diamond_desc',
  MYTHIC: 'tier_mythic_desc',
} as const satisfies Record<RankTier, string>

type RankFormat = 'constructed' | 'limited'
type RankSource = 'room' | 'history'

export default function RankingView({ users, currentUsername, onInspectUser }: RankingViewProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [format, setFormat] = useState<RankFormat>('constructed')
  const [source, setSource] = useState<RankSource>('room')
  const limited = format === 'limited'

  // Each player has one ELO per format; unrated players (null) have no tier
  // and sort last instead of being shown as a made-up 1500.
  const myUser = users.find((u) => u.userName.toLowerCase() === currentUsername.toLowerCase())
  const myElo = myUser ? playerRankRating(myUser, limited) : null
  const myTier = myElo ? getRankInfo(myElo).tier : null

  const sortedUsers = useMemo(() => {
    const list = users.map((u) => {
      const tourneyRaw = u.tourneyHistory && u.tourneyHistory !== '0' ? u.tourneyHistory : null
      const historyStr = limited ? (tourneyRaw ?? u.matchHistory) : u.matchHistory
      const quitRatio = limited && u.tourneyQuitRatio !== undefined && u.tourneyQuitRatio > 0
        ? u.tourneyQuitRatio
        : (u.matchQuitRatio ?? 0)

      return {
        ...u,
        rating: playerRankRating(u, limited),
        stats: parseMatchHistory(historyStr),
        fairPlay: Math.max(0, 100 - quitRatio),
      }
    })

    list.sort((a, b) => {
      const ra = a.rating ?? -1
      const rb = b.rating ?? -1
      if (rb !== ra) {
        return rb - ra
      }
      return b.fairPlay - a.fairPlay
    })

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return list.filter((u) => u.userName.toLowerCase().includes(q))
    }

    return list
  }, [users, searchQuery, limited])

  return (
    <div className="ranking-view">
      <section className="panel rank-guide" aria-labelledby="rank-guide-title">
        <div className="rank-guide-hero">
          <span className="rank-guide-hero-emblem" aria-hidden="true">
            <Icon name="trophy" size={40} />
          </span>
          <div className="rank-guide-hero-text">
            <span className="rank-guide-kicker">{t('lobby', 'leaderboard_subtitle')}</span>
            <h2 id="rank-guide-title">{t('lobby', 'nav_ranking')}</h2>
            <p>{t('lobby', 'leaderboard_ranked_desc')}</p>
          </div>
          <Tabs<RankFormat>
            variant="segmented"
            size="sm"
            className="rank-format-tabs"
            value={format}
            onChange={setFormat}
            items={[
              { id: 'constructed', label: t('lobby', 'leaderboard_format_constructed') },
              { id: 'limited', label: t('lobby', 'leaderboard_format_limited') },
            ]}
          />
        </div>

        <ol className="rank-guide-ladder" aria-label={t('lobby', 'leaderboard_rank_guide')}>
          {RANK_TIERS_CONFIG.map((tier) => (
            <li key={tier.tier} className={`rank-guide-tier${myTier === tier.tier ? ' is-mine' : ''}`}>
              <span
                className={`rank-guide-emblem${tier.tier === 'MYTHIC' ? ' is-mythic' : ''}`}
                style={{ color: tier.color }}
              >
                <RankEmblem tier={tier.tier} />
              </span>
              <span className="rank-guide-name" style={{ color: tier.color }}>
                {getTierName(tier.tier, t)}
              </span>
              <span className="rank-guide-range">
                {tier.tier === 'MYTHIC' ? `≥ ${tier.minElo}` : `${tier.minElo} – ${tier.maxElo}`}
              </span>
              <span className="rank-guide-desc">{t('lobby', TIER_DESC_KEYS[tier.tier])}</span>
              {myTier === tier.tier && <span className="me-badge">{t('game', 'you')}</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel rank-table-panel">
        <div className="rank-table-header">
          <Tabs<RankSource>
            variant="segmented"
            size="sm"
            value={source}
            onChange={setSource}
            items={[
              { id: 'room', label: `${t('lobby', 'leaderboard_top_room')} (${users.length})` },
              { id: 'history', label: t('lobby', 'leaderboard_source_history') },
            ]}
          />
          <div className="leaderboard-search-bar">
            <input
              type="text"
              placeholder={t('lobby', 'leaderboard_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {source === 'history' ? (
          <RankingHistory format={format} searchQuery={searchQuery} />
        ) : (
          <>
            {__DEMO__ && (
              <p className="leaderboard-demo-note" data-testid="leaderboard-demo-note">
                {t('lobby', 'demo_sample_data')}
              </p>
            )}

            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th className="col-pos">{t('lobby', 'leaderboard_col_pos')}</th>
                    <th>{t('lobby', 'leaderboard_col_player')}</th>
                    <th>{t('lobby', 'leaderboard_col_tier')}</th>
                    <th className="col-center">{t('lobby', 'leaderboard_col_elo')}</th>
                    <th className="col-center">{t('lobby', 'leaderboard_col_history')}</th>
                    <th className="col-center">{t('lobby', 'leaderboard_fair_play')}</th>
                    <th>{t('lobby', 'leaderboard_col_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u, index) => {
                    const isMe = u.userName.toLowerCase() === currentUsername.toLowerCase()
                    const pos = index + 1
                    const medalRank = u.rating !== null && pos <= 3 ? pos : null

                    return (
                      <tr
                        key={u.userName}
                        className={`leaderboard-row ${isMe ? 'is-me' : ''}${medalRank ? ` is-podium is-podium-${medalRank}` : ''}`}
                        onClick={() => onInspectUser(u.userName)}
                        title={`${t('lobby', 'view_profile_hint')} ${u.userName}`}
                      >
                        <td className="pos-cell">
                          {medalRank ? <span className={`pos-medal pos-medal--${medalRank}`}><Icon name="medal" size={14} /></span> : u.rating === null ? '—' : `#${pos}`}
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
                          {u.rating !== null ? (
                            <RankBadge elo={u.rating} />
                          ) : (
                            <span className="winrate-na" title={t('lobby', 'leaderboard_no_games_hint')}>—</span>
                          )}
                        </td>
                        <td className="elo-cell">
                          {u.rating !== null ? <><Icon name="star" size={12} /> {u.rating}</> : '—'}
                        </td>
                        <td className="history-cell">{u.stats.formattedHistory}</td>
                        <td className="winrate-cell">
                          {u.stats.total > 0 ? (
                            <div
                              className="winrate-bar-container"
                              title={t('lobby', 'leaderboard_fair_play_hint', { ratio: String(u.matchQuitRatio ?? 0) })}
                            >
                              <span className="winrate-text">{u.fairPlay}%</span>
                              <div className="winrate-mini-track">
                                <div className="winrate-mini-fill" style={{ width: `${u.fairPlay}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="winrate-na" title={t('lobby', 'leaderboard_no_games_hint')}>—</span>
                          )}
                        </td>
                        <td>
                          {isUserInGame(u.infoGames) ? (
                            <span className="status-playing"><Icon name="swords" size={12} /> {t('lobby', 'in_game')}</span>
                          ) : (
                            <span className="status-idle">{t('lobby', 'in_lobby')}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {sortedUsers.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState italic>{t('lobby', 'leaderboard_no_results')}</EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
